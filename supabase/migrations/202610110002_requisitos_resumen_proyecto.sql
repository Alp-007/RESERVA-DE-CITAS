-- Amplía el MVP según resumen proyecto.docx. Ejecutar después de 202610110001.
-- Los documentos de remisión quedan en un bucket privado; no se guardan URLs públicas.

alter table public.perfiles add column if not exists tipo_documento text;
alter table public.perfiles add column if not exists numero_documento text;
alter table public.perfiles add column if not exists fecha_nacimiento date;
alter table public.perfiles add column if not exists telefono text;
alter table public.perfiles add column if not exists direccion text;
alter table public.perfiles add column if not exists horario_preferido text;
alter table public.perfiles add column if not exists documento_remision_path text;
alter table public.perfiles add column if not exists consentimiento_datos_en timestamptz;
alter table public.perfiles add column if not exists estudiante_validado boolean not null default false;
alter table public.perfiles add column if not exists activo boolean not null default true;
alter table public.perfiles add column if not exists profesional_asignado_id uuid references public.perfiles(id) on delete set null;
create unique index if not exists perfiles_numero_documento_unico
  on public.perfiles (numero_documento) where numero_documento is not null and trim(numero_documento) <> '';
create index if not exists perfiles_profesional_asignado_idx on public.perfiles(profesional_asignado_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.perfiles'::regclass and conname = 'perfiles_horario_preferido_valido') then
    alter table public.perfiles add constraint perfiles_horario_preferido_valido
      check (horario_preferido is null or horario_preferido in ('manana','tarde','indiferente'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.perfiles'::regclass and conname = 'perfiles_tipo_documento_valido') then
    alter table public.perfiles add constraint perfiles_tipo_documento_valido check (
      tipo_documento is null or tipo_documento in ('Cédula de ciudadanía','Tarjeta de identidad','Cédula de extranjería','Pasaporte','Otro'));
  end if;
end $$;

-- Mantiene los campos de registro enviados a Supabase Auth en el perfil privado.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public
as $$
declare fecha date; consentimiento timestamptz;
begin
  begin
    fecha := nullif(new.raw_user_meta_data ->> 'fecha_nacimiento', '')::date;
  exception when others then
    fecha := null;
  end;
  begin
    consentimiento := nullif(new.raw_user_meta_data ->> 'consentimiento_datos_en', '')::timestamptz;
  exception when others then
    consentimiento := null;
  end;
  if consentimiento is null then raise exception 'El registro requiere consentimiento para el tratamiento de los datos.' using errcode = '23514'; end if;
  insert into public.perfiles (
    id, nombre_completo, tipo_usuario, correo, tipo_documento, numero_documento,
    fecha_nacimiento, telefono, direccion, horario_preferido, consentimiento_datos_en
  ) values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre_completo'), ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'tipo_usuario' = 'estudiante' then 'estudiante' else 'externo' end,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'tipo_documento', ''),
    nullif(trim(new.raw_user_meta_data ->> 'numero_documento'), ''),
    fecha,
    nullif(trim(new.raw_user_meta_data ->> 'telefono'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'direccion'), ''),
    nullif(new.raw_user_meta_data ->> 'horario_preferido', ''),
    consentimiento
  ) on conflict (id) do update set
    nombre_completo = excluded.nombre_completo,
    tipo_usuario = excluded.tipo_usuario,
    correo = excluded.correo,
    tipo_documento = coalesce(excluded.tipo_documento, public.perfiles.tipo_documento),
    numero_documento = coalesce(excluded.numero_documento, public.perfiles.numero_documento),
    fecha_nacimiento = coalesce(excluded.fecha_nacimiento, public.perfiles.fecha_nacimiento),
    telefono = coalesce(excluded.telefono, public.perfiles.telefono),
    direccion = coalesce(excluded.direccion, public.perfiles.direccion),
    horario_preferido = coalesce(excluded.horario_preferido, public.perfiles.horario_preferido),
    consentimiento_datos_en = coalesce(excluded.consentimiento_datos_en, public.perfiles.consentimiento_datos_en);
  return new;
end;
$$;

-- Un correo institucional verificado habilita la marca de verificación; no sustituye
-- una comprobación de matrícula en los sistemas académicos de la institución.
create or replace function public.validar_correo_institucional()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.email_confirmed_at is distinct from old.email_confirmed_at or new.email is distinct from old.email then
    update public.perfiles p set estudiante_validado = (
      p.tipo_usuario = 'estudiante'
      and new.email_confirmed_at is not null
      and lower(coalesce(new.email, '')) ~ '@uniminuto\.edu(\.co)?$'
    ), correo = coalesce(new.email, '')
    where p.id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists auth_validar_correo_institucional on auth.users;
create trigger auth_validar_correo_institucional after update of email, email_confirmed_at on auth.users
for each row execute procedure public.validar_correo_institucional();
update public.perfiles p set estudiante_validado = (
  p.tipo_usuario = 'estudiante' and u.email_confirmed_at is not null
  and lower(coalesce(u.email, '')) ~ '@uniminuto\.edu(\.co)?$'
), correo = coalesce(u.email, p.correo)
from auth.users u where u.id = p.id;

-- El profesional no puede consultar el perfil ni los documentos privados del paciente.
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated
using (id = auth.uid() or public.es_administrador());

create or replace function public.proteger_campos_perfil()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.es_administrador() then
    if new.estudiante_validado is distinct from old.estudiante_validado
      or new.activo is distinct from old.activo
      or new.profesional_asignado_id is distinct from old.profesional_asignado_id
      or new.tipo_usuario is distinct from old.tipo_usuario
      or new.correo is distinct from old.correo
      or new.consentimiento_datos_en is distinct from old.consentimiento_datos_en then
      raise exception 'No puedes cambiar el rol, estado, correo, tipo de usuario, consentimiento, validación o profesional asignado.' using errcode = '42501';
    end if;
    if new.documento_remision_path is distinct from old.documento_remision_path
      and new.documento_remision_path is not null
      and split_part(new.documento_remision_path, '/', 1) <> auth.uid()::text then
      raise exception 'La remisión debe pertenecer a la carpeta privada de tu cuenta.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists perfiles_proteger_campos on public.perfiles;
create trigger perfiles_proteger_campos before update on public.perfiles
for each row execute procedure public.proteger_campos_perfil();

-- Repositorio privado para remisiones. Los usuarios pueden cargar a su carpeta;
-- solo el administrador puede leer los objetos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-remision', 'documentos-remision', false, 8388608,
  array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists remision_subir_propio on storage.objects;
create policy remision_subir_propio on storage.objects for insert to authenticated
with check (bucket_id = 'documentos-remision' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists remision_admin_leer on storage.objects;
create policy remision_admin_leer on storage.objects for select to authenticated
using (bucket_id = 'documentos-remision' and public.es_administrador());
drop policy if exists remision_admin_eliminar on storage.objects;
create policy remision_admin_eliminar on storage.objects for delete to authenticated
using (bucket_id = 'documentos-remision' and public.es_administrador());

create table if not exists public.horarios_profesionales (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.perfiles(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint horarios_profesionales_intervalo check (hora_fin > hora_inicio),
  constraint horarios_profesionales_inicio_nocturno check (hora_inicio >= time '08:00' and hora_fin <= time '18:00')
);
create unique index if not exists horarios_profesionales_sin_duplicados
  on public.horarios_profesionales(profesional_id, dia_semana, hora_inicio, hora_fin);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.horarios_profesionales'::regclass and conname = 'horarios_profesionales_sin_cruce') then
    alter table public.horarios_profesionales add constraint horarios_profesionales_sin_cruce
      exclude using gist (
        profesional_id with =,
        dia_semana with =,
        tsrange(date '2000-01-03' + hora_inicio, date '2000-01-03' + hora_fin, '[)') with &&
      ) where (activo);
  end if;
end $$;
alter table public.horarios_profesionales enable row level security;
drop policy if exists horarios_profesionales_leer on public.horarios_profesionales;
create policy horarios_profesionales_leer on public.horarios_profesionales for select to authenticated
using (public.es_administrador() or profesional_id = auth.uid());
drop policy if exists horarios_profesionales_admin on public.horarios_profesionales;
create policy horarios_profesionales_admin on public.horarios_profesionales for all to authenticated
using (public.es_administrador()) with check (public.es_administrador());
grant select, insert, update, delete on public.horarios_profesionales to authenticated;
drop policy if exists citas_solicitar on public.citas;
create policy citas_solicitar on public.citas for insert to authenticated
with check (usuario_id = auth.uid() and estado = 'pendiente' and profesional_id =
  (select p.profesional_asignado_id from public.perfiles p where p.id = auth.uid()));

-- Solo expone nombre e identificador del personal activo, nunca su perfil completo.
create or replace view public.profesionales_publicos as
select id, nombre_completo from public.perfiles where rol = 'profesional' and activo = true;
grant select on public.profesionales_publicos to authenticated;

create table if not exists public.configuracion_aportes (
  id boolean primary key default true check (id),
  aporte_estudiante integer not null default 5000 check (aporte_estudiante >= 0),
  aporte_otros integer not null default 12000 check (aporte_otros >= 0),
  actualizado_en timestamptz not null default now()
);
insert into public.configuracion_aportes(id, aporte_estudiante, aporte_otros)
values (true, 5000, 12000) on conflict (id) do nothing;
alter table public.configuracion_aportes enable row level security;
drop policy if exists aportes_leer_autenticado on public.configuracion_aportes;
create policy aportes_leer_autenticado on public.configuracion_aportes for select to authenticated using (true);
drop policy if exists aportes_admin_actualizar on public.configuracion_aportes;
create policy aportes_admin_actualizar on public.configuracion_aportes for update to authenticated
using (public.es_administrador()) with check (public.es_administrador());
grant select, update on public.configuracion_aportes to authenticated;

alter table public.citas add column if not exists reprogramada_en timestamptz;
alter table public.pagos add column if not exists referencia_transaccion text;
alter table public.citas drop constraint if exists citas_estado_check;
alter table public.citas add constraint citas_estado_check
  check (estado in ('pendiente','confirmada','cancelada','completada','no_asistio'));

create table if not exists public.historial_citas (
  id bigint generated always as identity primary key,
  cita_id uuid not null references public.citas(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete restrict,
  profesional_id uuid references public.perfiles(id) on delete set null,
  inicio_anterior timestamptz,
  inicio_nuevo timestamptz,
  estado_anterior text,
  estado_nuevo text,
  actor_id uuid,
  ocurrido_en timestamptz not null default now()
);
create table if not exists public.solicitudes_cambio_profesional (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  motivo text not null check (char_length(trim(motivo)) between 5 and 1000),
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  nota_administrativa text,
  revisado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index if not exists solicitudes_cambio_unica_pendiente_usuario
  on public.solicitudes_cambio_profesional(usuario_id) where estado = 'pendiente';
create table if not exists public.bonos_cita (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null unique references public.citas(id) on delete restrict,
  usuario_id uuid not null references public.perfiles(id) on delete restrict,
  valor_cop integer not null check (valor_cop >= 0),
  motivo text not null default 'Cancelación administrativa',
  creado_en timestamptz not null default now()
);
create table if not exists public.notificaciones (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  tipo text not null,
  mensaje text not null,
  leida_en timestamptz,
  creado_en timestamptz not null default now()
);
create index if not exists notificaciones_usuario_creado_idx on public.notificaciones(usuario_id, creado_en desc);

alter table public.historial_citas enable row level security;
alter table public.solicitudes_cambio_profesional enable row level security;
alter table public.bonos_cita enable row level security;
alter table public.notificaciones enable row level security;
drop policy if exists historial_citas_admin_leer on public.historial_citas;
create policy historial_citas_admin_leer on public.historial_citas for select to authenticated using (public.es_administrador());
drop policy if exists solicitudes_cambio_leer on public.solicitudes_cambio_profesional;
create policy solicitudes_cambio_leer on public.solicitudes_cambio_profesional for select to authenticated
using (usuario_id = auth.uid() or public.es_administrador());
drop policy if exists solicitudes_cambio_crear on public.solicitudes_cambio_profesional;
create policy solicitudes_cambio_crear on public.solicitudes_cambio_profesional for insert to authenticated
with check (usuario_id = auth.uid() and estado = 'pendiente');
drop policy if exists solicitudes_cambio_admin on public.solicitudes_cambio_profesional;
create policy solicitudes_cambio_admin on public.solicitudes_cambio_profesional for update to authenticated
using (public.es_administrador()) with check (public.es_administrador());
drop policy if exists bonos_cita_leer on public.bonos_cita;
create policy bonos_cita_leer on public.bonos_cita for select to authenticated
using (usuario_id = auth.uid() or public.es_administrador());
drop policy if exists notificaciones_leer on public.notificaciones;
create policy notificaciones_leer on public.notificaciones for select to authenticated
using (usuario_id = auth.uid() or public.es_administrador());
drop policy if exists notificaciones_marcar_leida on public.notificaciones;
create policy notificaciones_marcar_leida on public.notificaciones for update to authenticated
using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create or replace function public.proteger_notificacion()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.usuario_id is distinct from old.usuario_id or new.tipo is distinct from old.tipo
    or new.mensaje is distinct from old.mensaje or new.creado_en is distinct from old.creado_en then
    raise exception 'Solo puedes marcar tu notificación como leída.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists notificaciones_proteger on public.notificaciones;
create trigger notificaciones_proteger before update on public.notificaciones
for each row execute procedure public.proteger_notificacion();
create or replace function public.marcar_notificacion_leida(p_notificacion bigint)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.notificaciones set leida_en = coalesce(leida_en, now())
  where id = p_notificacion and usuario_id = auth.uid();
  if not found then raise exception 'Notificación no encontrada.' using errcode = 'P0002'; end if;
end;
$$;
grant select on public.historial_citas, public.bonos_cita to authenticated;
grant select, insert, update on public.solicitudes_cambio_profesional to authenticated;
grant select, update on public.notificaciones to authenticated;
revoke all on function public.marcar_notificacion_leida(bigint) from public, anon;
grant execute on function public.marcar_notificacion_leida(bigint) to authenticated;

create or replace function public.validar_cita()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  minutos integer;
  activo_servicio boolean;
  tipo_cliente text;
  estudiante_valido boolean;
  aporte integer;
  perfil_activo boolean;
  asignado uuid;
  dia integer;
  hora_inicio_local time;
  hora_fin_local time;
begin
  select s.duracion_minutos, s.activo into minutos, activo_servicio
  from public.servicios s where s.id = new.servicio_id;
  if minutos is null or ((tg_op = 'INSERT' or new.servicio_id is distinct from old.servicio_id) and not activo_servicio) then
    raise exception 'El servicio seleccionado no está disponible.' using errcode = '23514';
  end if;

  select p.tipo_usuario, p.estudiante_validado, p.activo, p.profesional_asignado_id into tipo_cliente, estudiante_valido, perfil_activo, asignado
  from public.perfiles p where p.id = new.usuario_id;
  if perfil_activo is distinct from true then raise exception 'La cuenta está inactiva.' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then
    if new.profesional_id is null then new.profesional_id := asignado; end if;
    if new.profesional_id is null or new.profesional_id is distinct from asignado then
      raise exception 'El administrador debe asignarte un profesional antes de solicitar la cita.' using errcode = '23514';
    end if;
  elsif new.profesional_id is null and asignado is not null then
    new.profesional_id := asignado;
  end if;
  if new.profesional_id is null then raise exception 'La cita debe tener un profesional asignado.' using errcode = '23514'; end if;
  if (tg_op = 'INSERT' or new.profesional_id is distinct from old.profesional_id) and not exists (select 1 from public.perfiles p where p.id = new.profesional_id and p.rol = 'profesional' and p.activo) then
    raise exception 'El profesional asignado no está activo.' using errcode = '23514';
  end if;

  select case when tipo_cliente = 'estudiante' and estudiante_valido then aporte_estudiante else aporte_otros end
  into aporte from public.configuracion_aportes where id = true;
  if aporte is null then aporte := case when tipo_cliente = 'estudiante' and estudiante_valido then 5000 else 12000 end; end if;
  if tg_op = 'INSERT' then
    new.fin := new.inicio + make_interval(mins => minutos);
    new.valor_cop := aporte;
  elsif new.servicio_id is distinct from old.servicio_id then
    new.fin := new.inicio + make_interval(mins => minutos);
    new.valor_cop := aporte;
  elsif new.inicio is distinct from old.inicio then
    new.fin := new.inicio + (old.fin - old.inicio);
    new.valor_cop := old.valor_cop;
    new.reprogramada_en := now();
  else
    new.fin := old.fin;
    new.valor_cop := old.valor_cop;
  end if;

  if new.estado in ('pendiente','confirmada') then
    if new.inicio <= now() then raise exception 'La cita debe programarse para una fecha futura.' using errcode = '23514'; end if;
    dia := extract(isodow from (new.inicio at time zone 'America/Bogota'))::integer;
    hora_inicio_local := (new.inicio at time zone 'America/Bogota')::time;
    hora_fin_local := (new.fin at time zone 'America/Bogota')::time;
    if dia not between 1 and 6 or hora_inicio_local < time '08:00' or hora_fin_local > time '18:00' then
      raise exception 'Horario disponible: lunes a sábado, 08:00 a 18:00 (hora de Bogotá).' using errcode = '23514';
    end if;
    if exists (select 1 from public.citas c where c.usuario_id = new.usuario_id and c.estado = 'no_asistio' and c.inicio > now() - interval '8 days') then
      raise exception 'Después de una inasistencia debes esperar 8 días para solicitar otra cita.' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.horarios_profesionales h
      where h.profesional_id = new.profesional_id and h.activo and h.dia_semana = dia
        and hora_inicio_local >= h.hora_inicio and hora_fin_local <= h.hora_fin
    ) then raise exception 'El profesional no tiene disponibilidad configurada para esa hora.' using errcode = '23514'; end if;
  end if;
  if new.estado = 'confirmada' and (tg_op = 'INSERT' or old.estado is distinct from 'confirmada')
    and not exists (select 1 from public.pagos p where p.cita_id = new.id and p.estado = 'aprobado') then
    raise exception 'La cita solo se confirma cuando el administrador aprueba el pago.' using errcode = '42501';
  end if;
  if new.estado = 'completada' and (tg_op = 'INSERT' or old.estado is distinct from 'completada') and now() < new.fin then
    raise exception 'La atención solo puede marcarse como completada después de la hora de finalización.' using errcode = '23514';
  end if;
  if new.estado = 'no_asistio' and now() < new.inicio + interval '15 minutes' then
    raise exception 'La inasistencia solo puede marcarse después de 15 minutos de la hora programada.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists citas_validar on public.citas;
create trigger citas_validar before insert or update on public.citas
for each row execute procedure public.validar_cita();

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
      or old.estado <> 'confirmada' or new.estado not in ('completada','no_asistio') then
      raise exception 'El profesional solo puede registrar la asistencia de una cita confirmada que tiene asignada.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists citas_restringir_profesional on public.citas;
create trigger citas_restringir_profesional before update on public.citas
for each row execute procedure public.restringir_cambios_profesional();

create or replace function public.obtener_horarios_disponibles(servicio uuid, fecha date)
returns table(inicio timestamptz, fin timestamptz)
language sql stable security definer set search_path = public
as $$
  select (slots.hora_local at time zone 'America/Bogota') as inicio,
         ((slots.hora_local + make_interval(mins => s.duracion_minutos)) at time zone 'America/Bogota') as fin
  from public.perfiles cliente
  join public.perfiles profesional on profesional.id = cliente.profesional_asignado_id and profesional.rol = 'profesional' and profesional.activo
  join public.horarios_profesionales h on h.profesional_id = profesional.id and h.activo
  join public.servicios s on s.id = servicio and s.activo
  cross join lateral generate_series(
    fecha + h.hora_inicio,
    fecha + h.hora_fin - make_interval(mins => s.duracion_minutos),
    make_interval(mins => s.duracion_minutos)
  ) as slots(hora_local)
  where cliente.id = auth.uid() and cliente.activo and h.dia_semana = extract(isodow from fecha)::integer
    and (slots.hora_local at time zone 'America/Bogota') > now()
    and not exists (select 1 from public.citas c where c.profesional_id = profesional.id
      and c.estado in ('pendiente','confirmada')
      and tstzrange(c.inicio, c.fin, '[)') && tstzrange(
        slots.hora_local at time zone 'America/Bogota',
        (slots.hora_local + make_interval(mins => s.duracion_minutos)) at time zone 'America/Bogota', '[)'))
    and not exists (select 1 from public.citas c where c.usuario_id = cliente.id and c.estado = 'no_asistio' and c.inicio > now() - interval '8 days')
  order by inicio;
$$;

create or replace function public.reprogramar_cita(cita uuid, nuevo_inicio timestamptz)
returns void language plpgsql security definer set search_path = public
as $$
declare actual public.citas%rowtype;
begin
  select * into actual from public.citas where id = cita and usuario_id = auth.uid() for update;
  if not found or actual.estado not in ('pendiente','confirmada') then raise exception 'La cita no existe o no se puede reprogramar.' using errcode = '42501'; end if;
  if actual.inicio < now() + interval '24 hours' then raise exception 'Puedes cambiar la cita hasta 24 horas antes.' using errcode = '23514'; end if;
  update public.citas set inicio = nuevo_inicio where id = cita;
end;
$$;

create or replace function public.asignar_profesional_usuario(p_usuario uuid, p_profesional uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_administrador() then raise exception 'Solo el administrador puede asignar profesionales.' using errcode = '42501'; end if;
  if p_profesional is not null and not exists (select 1 from public.perfiles where id = p_profesional and rol = 'profesional' and activo) then
    raise exception 'Selecciona un profesional activo.' using errcode = '23514';
  end if;
  if p_profesional is null and exists (select 1 from public.citas where usuario_id = p_usuario and estado in ('pendiente','confirmada') and inicio > now()) then
    raise exception 'No puedes quitar la asignación mientras haya citas activas futuras.' using errcode = '23514';
  end if;
  update public.perfiles set profesional_asignado_id = p_profesional where id = p_usuario and rol = 'usuario';
  if not found then raise exception 'No se encontró el perfil de usuario.' using errcode = 'P0002'; end if;
  if p_profesional is not null then
    update public.citas set profesional_id = p_profesional
      where usuario_id = p_usuario and estado in ('pendiente','confirmada') and inicio > now();
  end if;
end;
$$;

create or replace function public.cancelar_cita(cita uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.citas set estado = 'cancelada'
  where id = cita and usuario_id = auth.uid() and estado in ('pendiente','confirmada') and inicio >= now() + interval '24 hours';
  if not found then raise exception 'Solo puedes cancelar con 24 horas de anticipación.' using errcode = '42501'; end if;
end;
$$;

create or replace function public.cancelar_cita_administrador(cita uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare fila public.citas%rowtype; valor integer;
begin
  if not public.es_administrador() then raise exception 'Solo el administrador puede cancelar citas desde el panel.' using errcode = '42501'; end if;
  select * into fila from public.citas where id = cita for update;
  if not found or fila.estado not in ('pendiente','confirmada') then raise exception 'La cita no se puede cancelar.' using errcode = '23514'; end if;
  select p.monto_cop into valor from public.pagos p where p.cita_id = cita and p.estado = 'aprobado' order by p.creado_en desc limit 1;
  update public.citas set estado = 'cancelada' where id = cita;
  if valor is not null then
    insert into public.bonos_cita(cita_id, usuario_id, valor_cop) values (cita, fila.usuario_id, valor)
    on conflict (cita_id) do nothing;
  end if;
end;
$$;

create or replace function public.solicitar_cambio_profesional(motivo text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare salida uuid;
begin
  if auth.uid() is null or char_length(trim(motivo)) not between 5 and 1000 then raise exception 'Escribe el motivo de tu solicitud.' using errcode = '23514'; end if;
  insert into public.solicitudes_cambio_profesional(usuario_id, motivo) values (auth.uid(), trim(motivo)) returning id into salida;
  return salida;
end;
$$;

create or replace function public.resolver_solicitud_cambio_profesional(
  p_solicitud uuid, p_estado text, p_profesional uuid default null, p_nota text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare solicitud public.solicitudes_cambio_profesional%rowtype;
begin
  if not public.es_administrador() then raise exception 'Solo el administrador puede resolver solicitudes.' using errcode = '42501'; end if;
  if p_estado not in ('aprobada','rechazada') then raise exception 'Estado de resolución no válido.' using errcode = '23514'; end if;
  select * into solicitud from public.solicitudes_cambio_profesional where id = p_solicitud and estado = 'pendiente' for update;
  if not found then raise exception 'La solicitud ya fue revisada o no existe.' using errcode = 'P0002'; end if;
  if p_estado = 'aprobada' then
    if p_profesional is null or not exists (
      select 1 from public.perfiles where id = p_profesional and rol = 'profesional' and activo
    ) then raise exception 'Selecciona un profesional activo para aprobar el cambio.' using errcode = '23514'; end if;
    perform public.asignar_profesional_usuario(solicitud.usuario_id, p_profesional);
  end if;
  update public.solicitudes_cambio_profesional
    set estado = p_estado, nota_administrativa = nullif(trim(p_nota), ''), revisado_por = auth.uid(), actualizado_en = now()
    where id = p_solicitud;
  insert into public.notificaciones(usuario_id, tipo, mensaje)
  values (solicitud.usuario_id, 'solicitud_cambio_resuelta',
    case when p_estado = 'aprobada' then 'Tu solicitud de cambio de profesional fue aprobada.'
      else 'Tu solicitud de cambio de profesional fue revisada y no fue aprobada.' end);
end;
$$;

create or replace function public.registrar_historial_cita()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.inicio is distinct from old.inicio or new.estado is distinct from old.estado or new.profesional_id is distinct from old.profesional_id then
    insert into public.historial_citas(cita_id, usuario_id, profesional_id, inicio_anterior, inicio_nuevo, estado_anterior, estado_nuevo, actor_id)
    values (new.id, new.usuario_id, new.profesional_id, case when tg_op = 'INSERT' then null else old.inicio end,
      new.inicio, case when tg_op = 'INSERT' then null else old.estado end, new.estado, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists citas_historial on public.citas;
create trigger citas_historial after insert or update on public.citas for each row execute procedure public.registrar_historial_cita();

create or replace function public.notificar_cambio_cita()
returns trigger language plpgsql security definer set search_path = public
as $$
declare texto text; tipo text;
begin
  if tg_op = 'INSERT' then texto := 'Recibimos tu solicitud de cita.'; tipo := 'cita_solicitada';
  elsif new.estado is distinct from old.estado then texto := 'El estado de tu cita cambió a ' || new.estado || '.'; tipo := 'estado_cita';
  elsif new.inicio is distinct from old.inicio then texto := 'La fecha de tu cita fue modificada.'; tipo := 'cita_reprogramada';
  else return new; end if;
  insert into public.notificaciones(usuario_id, tipo, mensaje) values (new.usuario_id, tipo, texto);
  return new;
end;
$$;
drop trigger if exists citas_notificar on public.citas;
create trigger citas_notificar after insert or update on public.citas for each row execute procedure public.notificar_cambio_cita();

create or replace function public.notificar_cambio_pago()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    insert into public.notificaciones(usuario_id, tipo, mensaje)
    values (new.usuario_id, 'estado_pago', 'El estado de tu pago cambió a ' || new.estado || '.');
  end if;
  return new;
end;
$$;
drop trigger if exists pagos_notificar on public.pagos;
create trigger pagos_notificar after insert or update on public.pagos for each row execute procedure public.notificar_cambio_pago();

create or replace function public.notificar_solicitud_cambio_profesional()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notificaciones(usuario_id, tipo, mensaje)
  select id, 'solicitud_cambio_profesional', 'Un usuario solicitó cambiar de profesional.'
  from public.perfiles where rol = 'administrador' and activo;
  return new;
end;
$$;
drop trigger if exists solicitud_cambio_notificar_admin on public.solicitudes_cambio_profesional;
create trigger solicitud_cambio_notificar_admin after insert on public.solicitudes_cambio_profesional
for each row execute procedure public.notificar_solicitud_cambio_profesional();

-- La cita solo se confirma tras aprobación administrativa, sin reactivar canceladas.
create or replace function public.registrar_historial_pago()
returns trigger language plpgsql security definer set search_path = public
as $$
declare estado_cita text;
begin
  if tg_op = 'INSERT' then
    insert into public.historial_pagos(pago_id, estado_anterior, estado_nuevo, actor_id)
    values (new.id, null, new.estado, auth.uid());
  elsif new.estado is distinct from old.estado then
    insert into public.historial_pagos(pago_id, estado_anterior, estado_nuevo, actor_id, nota)
    values (new.id, old.estado, new.estado, auth.uid(), new.nota_revision);
    if new.estado = 'aprobado' then
      select estado into estado_cita from public.citas where id = new.cita_id for update;
      if estado_cita not in ('pendiente','confirmada') then
        raise exception 'No se puede aprobar un pago de una cita cancelada o finalizada.' using errcode = '23514';
      end if;
      update public.citas set estado = 'confirmada' where id = new.cita_id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.obtener_horarios_disponibles(uuid, date) from public, anon;
revoke all on function public.reprogramar_cita(uuid, timestamptz) from public, anon;
revoke all on function public.asignar_profesional_usuario(uuid, uuid) from public, anon;
revoke all on function public.cancelar_cita(uuid) from public, anon;
revoke all on function public.cancelar_cita_administrador(uuid) from public, anon;
revoke all on function public.solicitar_cambio_profesional(text) from public, anon;
grant execute on function public.obtener_horarios_disponibles(uuid, date) to authenticated;
grant execute on function public.reprogramar_cita(uuid, timestamptz) to authenticated;
grant execute on function public.asignar_profesional_usuario(uuid, uuid) to authenticated;
grant execute on function public.cancelar_cita(uuid) to authenticated;
grant execute on function public.cancelar_cita_administrador(uuid) to authenticated;
grant execute on function public.solicitar_cambio_profesional(text) to authenticated;
revoke all on function public.resolver_solicitud_cambio_profesional(uuid, text, uuid, text) from public, anon;
grant execute on function public.resolver_solicitud_cambio_profesional(uuid, text, uuid, text) to authenticated;
grant select on public.historial_citas to authenticated;
notify pgrst, 'reload schema';
