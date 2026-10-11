-- Backend inicial para Reserva de Citas (Supabase / PostgreSQL).
-- Ejecutar en el SQL Editor de Supabase o con `supabase db push`.

create extension if not exists pgcrypto;

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null check (char_length(trim(nombre_completo)) between 2 and 120),
  tipo_usuario text not null default 'externo' check (tipo_usuario in ('estudiante', 'externo')),
  rol text not null default 'usuario' check (rol in ('usuario', 'psicologo', 'administrador')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete restrict,
  profesional_id uuid references public.perfiles(id) on delete set null,
  inicio timestamptz not null,
  fin timestamptz not null,
  motivo text not null check (char_length(trim(motivo)) between 5 and 1000),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'cancelada', 'completada')),
  notas_administrativas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint citas_intervalo_valido check (fin > inicio),
  constraint citas_duracion_valida check (fin - inicio between interval '15 minutes' and interval '2 hours')
);

create index if not exists citas_usuario_inicio_idx on public.citas (usuario_id, inicio desc);
create index if not exists citas_profesional_inicio_idx on public.citas (profesional_id, inicio desc);
create index if not exists citas_estado_inicio_idx on public.citas (estado, inicio);

create or replace function public.es_personal()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol in ('psicologo', 'administrador')
  );
$$;

create or replace function public.es_administrador()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles where id = auth.uid() and rol = 'administrador'
  );
$$;

-- El rol nunca se toma de los metadatos enviados por el cliente. El registro
-- solo puede declarar estudiante/externo; todo usuario nuevo tiene rol usuario.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre_completo, tipo_usuario)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre_completo'), ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'tipo_usuario' = 'estudiante' then 'estudiante' else 'externo' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario_auth on auth.users;
create trigger al_crear_usuario_auth
  after insert on auth.users
  for each row execute procedure public.crear_perfil_nuevo_usuario();

create or replace function public.actualizar_fecha_modificacion()
returns trigger language plpgsql set search_path = public as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists perfiles_actualizado_en on public.perfiles;
create trigger perfiles_actualizado_en before update on public.perfiles
for each row execute procedure public.actualizar_fecha_modificacion();

create or replace function public.proteger_rol_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rol is distinct from old.rol and auth.uid() is not null and not public.es_administrador() then
    raise exception 'Solo un administrador puede cambiar roles.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists proteger_rol_perfil_trigger on public.perfiles;
create trigger proteger_rol_perfil_trigger before update on public.perfiles
for each row execute procedure public.proteger_rol_perfil();
drop trigger if exists citas_actualizado_en on public.citas;
create trigger citas_actualizado_en before update on public.citas
for each row execute procedure public.actualizar_fecha_modificacion();

-- Evita cruces de horario para el usuario y profesional asignados. La regla
-- se valida en base de datos para que también aplique a todas las llamadas API.
create or replace function public.validar_horario_cita()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado in ('pendiente', 'confirmada') then
    if new.inicio <= now() then
      raise exception 'La cita debe programarse para una fecha futura.' using errcode = '23514';
    end if;
    if extract(isodow from (new.inicio at time zone 'America/Bogota')) not between 1 and 6
       or (new.inicio at time zone 'America/Bogota')::time < time '08:00'
       or (new.fin at time zone 'America/Bogota')::time > time '18:00' then
      raise exception 'La atención está disponible de lunes a sábado, de 08:00 a 18:00 (hora de Bogotá).' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.citas c
      where c.id is distinct from new.id
        and c.estado in ('pendiente', 'confirmada')
        and tstzrange(c.inicio, c.fin, '[)') && tstzrange(new.inicio, new.fin, '[)')
        and (c.usuario_id = new.usuario_id
          or (new.profesional_id is not null and c.profesional_id = new.profesional_id))
    ) then
      raise exception 'Ese horario ya está ocupado para el usuario o profesional.' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validar_horario_cita_trigger on public.citas;
create trigger validar_horario_cita_trigger before insert or update on public.citas
for each row execute procedure public.validar_horario_cita();

alter table public.perfiles enable row level security;
alter table public.citas enable row level security;

drop policy if exists "Leer perfil propio o de personal" on public.perfiles;
create policy "Leer perfil propio o de personal" on public.perfiles
  for select to authenticated using (id = auth.uid() or public.es_personal());
drop policy if exists "Editar perfil propio sin cambiar rol" on public.perfiles;
create policy "Editar perfil propio sin cambiar rol" on public.perfiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid());
drop policy if exists "Administrador gestiona perfiles" on public.perfiles;
create policy "Administrador gestiona perfiles" on public.perfiles
  for all to authenticated using (public.es_administrador()) with check (public.es_administrador());

drop policy if exists "Leer citas propias o asignadas" on public.citas;
create policy "Leer citas propias o asignadas" on public.citas
  for select to authenticated using (
    usuario_id = auth.uid() or profesional_id = auth.uid() or public.es_administrador()
  );
drop policy if exists "Usuario solicita cita propia" on public.citas;
create policy "Usuario solicita cita propia" on public.citas
  for insert to authenticated with check (usuario_id = auth.uid() and profesional_id is null and estado = 'pendiente');
drop policy if exists "Usuario cancela su cita pendiente" on public.citas;
create policy "Usuario cancela su cita pendiente" on public.citas
  for update to authenticated using (usuario_id = auth.uid() and estado = 'pendiente')
  with check (usuario_id = auth.uid() and estado = 'cancelada');
drop policy if exists "Personal gestiona citas" on public.citas;
create policy "Personal gestiona citas" on public.citas
  for all to authenticated using (public.es_personal()) with check (public.es_personal());

grant usage on schema public to authenticated;
grant select, update on public.perfiles to authenticated;
grant select, insert, update on public.citas to authenticated;
grant execute on function public.es_personal() to authenticated;
grant execute on function public.es_administrador() to authenticated;

comment on table public.perfiles is 'Perfil de cada cuenta de Auth; el rol se asigna administrativamente.';
comment on table public.citas is 'Solicitudes de atención. Disponible por API REST de Supabase con RLS.';
