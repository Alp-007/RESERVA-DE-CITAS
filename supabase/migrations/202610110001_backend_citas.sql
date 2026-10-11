-- Reserva de citas psicológicas. Ejecutar en Supabase SQL Editor.
-- Supabase usa PostgreSQL. Nunca guardar la clave service_role en VITE_*.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null check (char_length(trim(nombre_completo)) between 2 and 120),
  tipo_usuario text not null default 'externo' check (tipo_usuario in ('estudiante', 'externo')),
  rol text not null default 'usuario' check (rol in ('usuario', 'profesional', 'administrador')),
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);

create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(), nombre text not null unique,
  descripcion text not null default '', duracion_minutos integer not null default 45 check (duracion_minutos between 15 and 120),
  precio_cop integer not null default 0 check (precio_cop >= 0), activo boolean not null default true,
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
insert into public.servicios (nombre, descripcion, duracion_minutos, precio_cop)
values ('Consulta psicológica', 'Espacio de atención psicológica individual.', 45, 0)
on conflict (nombre) do nothing;

create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete restrict,
  profesional_id uuid references public.perfiles(id) on delete set null,
  servicio_id uuid not null references public.servicios(id) on delete restrict,
  inicio timestamptz not null, fin timestamptz not null,
  valor_cop integer not null default 0 check (valor_cop >= 0),
  motivo text not null check (char_length(trim(motivo)) between 5 and 1000),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'cancelada', 'completada')),
  notas_administrativas text, creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
  constraint citas_intervalo_valido check (fin > inicio)
);
create index if not exists citas_usuario_inicio_idx on public.citas (usuario_id, inicio desc);
create index if not exists citas_profesional_inicio_idx on public.citas (profesional_id, inicio desc);
create index if not exists citas_estado_inicio_idx on public.citas (estado, inicio);
do $$ begin
  alter table public.citas add constraint citas_usuario_sin_cruce
    exclude using gist (usuario_id with =, tstzrange(inicio, fin, '[)') with &&)
    where (estado in ('pendiente','confirmada'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.citas add constraint citas_profesional_sin_cruce
    exclude using gist (profesional_id with =, tstzrange(inicio, fin, '[)') with &&)
    where (profesional_id is not null and estado in ('pendiente','confirmada'));
exception when duplicate_object then null; end $$;

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(), cita_id uuid not null references public.citas(id) on delete restrict,
  usuario_id uuid not null references public.perfiles(id) on delete restrict,
  monto_cop integer not null check (monto_cop > 0),
  estado text not null default 'en_revision' check (estado in ('en_revision','aprobado','rechazado')),
  archivo_path text not null, ocr_texto text, ocr_referencia text, ocr_monto_cop integer,
  ocr_fecha timestamptz, ocr_confianza numeric(5,4) check (ocr_confianza between 0 and 1),
  revisado_por uuid references public.perfiles(id) on delete set null, nota_revision text,
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create index if not exists pagos_usuario_creado_idx on public.pagos (usuario_id, creado_en desc);
create index if not exists pagos_estado_creado_idx on public.pagos (estado, creado_en desc);
create unique index if not exists pagos_uno_pendiente_o_aprobado_por_cita
  on public.pagos (cita_id) where estado in ('en_revision','aprobado');

create table if not exists public.historial_pagos (
  id bigint generated always as identity primary key, pago_id uuid not null references public.pagos(id) on delete cascade,
  estado_anterior text, estado_nuevo text not null, actor_id uuid, nota text,
  ocurrido_en timestamptz not null default now()
);

create or replace function public.es_administrador()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'); $$;
create or replace function public.es_personal()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('profesional','administrador')); $$;

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre_completo, tipo_usuario)
  values (new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre_completo'), ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'tipo_usuario' = 'estudiante' then 'estudiante' else 'externo' end)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists auth_usuario_crea_perfil on auth.users;
create trigger auth_usuario_crea_perfil after insert on auth.users for each row execute procedure public.crear_perfil_nuevo_usuario();

-- Backfill Auth accounts that existed before this migration was installed.
insert into public.perfiles (id, nombre_completo, tipo_usuario)
select u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'nombre_completo'), ''), split_part(u.email, '@', 1)),
  case when u.raw_user_meta_data ->> 'tipo_usuario' = 'estudiante' then 'estudiante' else 'externo' end
from auth.users u
on conflict (id) do nothing;

create or replace function public.actualizar_fecha_modificacion()
returns trigger language plpgsql set search_path = public
as $$ begin new.actualizado_en = now(); return new; end; $$;
create or replace function public.proteger_rol_perfil()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.rol is distinct from old.rol and auth.uid() is not null and not public.es_administrador() then
    raise exception 'Solo un administrador puede cambiar roles.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists perfiles_proteger_rol on public.perfiles;
create trigger perfiles_proteger_rol before update on public.perfiles for each row execute procedure public.proteger_rol_perfil();

create or replace function public.validar_cita()
returns trigger language plpgsql security definer set search_path = public
as $$
declare minutos integer; activo_servicio boolean; precio integer;
begin
  select duracion_minutos, activo, precio_cop into minutos, activo_servicio, precio from public.servicios where id = new.servicio_id;
  if minutos is null or ((tg_op = 'INSERT' or new.servicio_id is distinct from old.servicio_id) and not activo_servicio) then
    raise exception 'El servicio seleccionado no está disponible.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.fin := new.inicio + make_interval(mins => minutos);
    new.valor_cop := precio;
  elsif new.servicio_id is distinct from old.servicio_id then
    new.fin := new.inicio + make_interval(mins => minutos);
    new.valor_cop := precio;
  elsif new.inicio is distinct from old.inicio then
    new.fin := new.inicio + (old.fin - old.inicio);
    new.valor_cop := old.valor_cop;
  else
    new.fin := old.fin;
    new.valor_cop := old.valor_cop;
  end if;
  if new.estado in ('pendiente','confirmada') then
    if new.inicio <= now() then raise exception 'La cita debe programarse para una fecha futura.' using errcode = '23514'; end if;
    if extract(isodow from (new.inicio at time zone 'America/Bogota')) not between 1 and 6
      or (new.inicio at time zone 'America/Bogota')::time < time '08:00'
      or (new.fin at time zone 'America/Bogota')::time > time '18:00' then
      raise exception 'Horario disponible: lunes a sábado, 08:00 a 18:00 (hora de Bogotá).' using errcode = '23514';
    end if;
  end if;
  if new.profesional_id is not null and not exists
    (select 1 from public.perfiles where id = new.profesional_id and rol in ('profesional','administrador')) then
    raise exception 'El profesional asignado no tiene un rol válido.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists citas_validar on public.citas;
create trigger citas_validar before insert or update on public.citas for each row execute procedure public.validar_cita();

create or replace function public.restringir_cambios_profesional()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and exists (select 1 from public.perfiles where id = auth.uid() and rol = 'profesional') then
    if old.profesional_id is distinct from auth.uid()
      or new.usuario_id is distinct from old.usuario_id
      or new.profesional_id is distinct from old.profesional_id
      or new.servicio_id is distinct from old.servicio_id
      or new.inicio is distinct from old.inicio
      or new.fin is distinct from old.fin
      or new.valor_cop is distinct from old.valor_cop
      or new.motivo is distinct from old.motivo
      or new.notas_administrativas is distinct from old.notas_administrativas
      or old.estado <> 'confirmada' or new.estado <> 'completada' then
      raise exception 'El profesional solo puede marcar como completada una cita ya confirmada y asignada.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists citas_restringir_profesional on public.citas;
create trigger citas_restringir_profesional before update on public.citas
for each row execute procedure public.restringir_cambios_profesional();

create or replace function public.preparar_pago()
returns trigger language plpgsql security definer set search_path = public
as $$
declare propietario uuid; valor integer; estado_cita text;
begin
  select c.usuario_id, c.valor_cop, c.estado into propietario, valor, estado_cita
  from public.citas c where c.id = new.cita_id;
  if propietario is null or propietario <> auth.uid() or estado_cita not in ('pendiente','confirmada') then
    raise exception 'No puedes registrar un pago para esta cita.' using errcode = '42501';
  end if;
  if valor <= 0 then raise exception 'El administrador debe configurar el precio del servicio antes de recibir pagos.' using errcode = '23514'; end if;
  new.usuario_id := propietario; new.monto_cop := valor; new.estado := 'en_revision';
  new.revisado_por := null; new.nota_revision := null;
  if split_part(new.archivo_path, '/', 1) <> auth.uid()::text then raise exception 'Ruta de comprobante no válida.' using errcode = '42501'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'comprobantes-pago' and name = new.archivo_path) then
    raise exception 'Carga el comprobante privado antes de registrar el pago.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists pagos_preparar on public.pagos;
create trigger pagos_preparar before insert on public.pagos for each row execute procedure public.preparar_pago();

create or replace function public.registrar_historial_pago()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historial_pagos (pago_id, estado_anterior, estado_nuevo, actor_id) values (new.id, null, new.estado, auth.uid());
  elsif new.estado is distinct from old.estado then
    insert into public.historial_pagos (pago_id, estado_anterior, estado_nuevo, actor_id, nota)
    values (new.id, old.estado, new.estado, auth.uid(), new.nota_revision);
    if new.estado = 'aprobado' then update public.citas set estado = 'confirmada' where id = new.cita_id; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists pagos_historial on public.pagos;
create trigger pagos_historial after insert or update on public.pagos for each row execute procedure public.registrar_historial_pago();

create or replace function public.cancelar_cita(cita uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.citas set estado = 'cancelada' where id = cita and usuario_id = auth.uid() and estado = 'pendiente';
  if not found then raise exception 'La cita no existe o ya no se puede cancelar.' using errcode = '42501'; end if;
end;
$$;

do $$ declare tabla text; begin
  foreach tabla in array array['perfiles','servicios','citas','pagos'] loop
    execute format('drop trigger if exists %I_actualizado_en on public.%I', tabla, tabla);
    execute format('create trigger %I_actualizado_en before update on public.%I for each row execute procedure public.actualizar_fecha_modificacion()', tabla, tabla);
  end loop;
end $$;

alter table public.perfiles enable row level security;
alter table public.servicios enable row level security;
alter table public.citas enable row level security;
alter table public.pagos enable row level security;
alter table public.historial_pagos enable row level security;

drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated
using (id = auth.uid() or public.es_administrador() or exists (
  select 1 from public.citas c where c.usuario_id = perfiles.id and c.profesional_id = auth.uid()
));
drop policy if exists perfiles_editar_propio on public.perfiles;
create policy perfiles_editar_propio on public.perfiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists perfiles_admin on public.perfiles;
create policy perfiles_admin on public.perfiles for all to authenticated
using (public.es_administrador()) with check (public.es_administrador());

drop policy if exists servicios_leer on public.servicios;
create policy servicios_leer on public.servicios for select to authenticated
using (activo or public.es_administrador());
drop policy if exists servicios_admin on public.servicios;
create policy servicios_admin on public.servicios for all to authenticated
using (public.es_administrador()) with check (public.es_administrador());

drop policy if exists citas_leer on public.citas;
create policy citas_leer on public.citas for select to authenticated
using (usuario_id = auth.uid() or profesional_id = auth.uid() or public.es_administrador());
drop policy if exists citas_solicitar on public.citas;
create policy citas_solicitar on public.citas for insert to authenticated
with check (usuario_id = auth.uid() and profesional_id is null and estado = 'pendiente');
drop policy if exists citas_profesional_gestionar on public.citas;
create policy citas_profesional_gestionar on public.citas for update to authenticated
using (profesional_id = auth.uid() or public.es_administrador())
with check (profesional_id = auth.uid() or public.es_administrador());
drop policy if exists citas_admin_eliminar on public.citas;
create policy citas_admin_eliminar on public.citas for delete to authenticated
using (public.es_administrador());

drop policy if exists pagos_leer on public.pagos;
create policy pagos_leer on public.pagos for select to authenticated
using (usuario_id = auth.uid() or public.es_administrador());
drop policy if exists pagos_crear on public.pagos;
create policy pagos_crear on public.pagos for insert to authenticated
with check (usuario_id = auth.uid() and estado = 'en_revision');
drop policy if exists pagos_admin_actualizar on public.pagos;
create policy pagos_admin_actualizar on public.pagos for update to authenticated
using (public.es_administrador()) with check (public.es_administrador());
drop policy if exists historial_pago_admin_leer on public.historial_pagos;
create policy historial_pago_admin_leer on public.historial_pagos for select to authenticated
using (public.es_administrador());

grant usage on schema public to authenticated;
grant select, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.servicios to authenticated;
grant select, insert, update, delete on public.citas to authenticated;
grant select, insert, update on public.pagos to authenticated;
grant select on public.historial_pagos to authenticated;
revoke all on function public.es_administrador() from public, anon;
revoke all on function public.es_personal() from public, anon;
revoke all on function public.cancelar_cita(uuid) from public, anon;
grant execute on function public.es_administrador() to authenticated;
grant execute on function public.es_personal() to authenticated;
grant execute on function public.cancelar_cita(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes-pago','comprobantes-pago',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];
drop policy if exists comprobantes_subir_propios on storage.objects;
create policy comprobantes_subir_propios on storage.objects for insert to authenticated
with check (bucket_id = 'comprobantes-pago' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists comprobantes_leer_propios_admin on storage.objects;
create policy comprobantes_leer_propios_admin on storage.objects for select to authenticated
using (bucket_id = 'comprobantes-pago' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_administrador()));
drop policy if exists comprobantes_admin_eliminar on storage.objects;
create policy comprobantes_admin_eliminar on storage.objects for delete to authenticated
using (bucket_id = 'comprobantes-pago' and public.es_administrador());

comment on table public.perfiles is 'Perfil autenticado; el rol no se admite desde el formulario de registro.';
comment on table public.servicios is 'El administrador configura el precio antes de activar pagos.';
comment on table public.citas is 'Agenda protegida por RLS, jornada Bogotá y prevención de cruces GiST.';
comment on table public.pagos is 'Comprobantes privados; OCR orientativo y decisión final administrativa.';
