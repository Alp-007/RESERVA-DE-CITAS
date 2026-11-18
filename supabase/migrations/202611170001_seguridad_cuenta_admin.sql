-- Verificación de cambios sensibles de administradores.
-- Los códigos se guardan solo como hash y nunca quedan disponibles al cliente.

alter table public.perfiles add column if not exists usuario text;
create unique index if not exists perfiles_usuario_unico
  on public.perfiles (lower(usuario)) where usuario is not null and trim(usuario) <> '';

create table if not exists public.verificaciones_cuenta (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  canal text not null check (canal in ('email', 'sms', 'bootstrap')),
  destino text not null,
  codigo_hash text not null,
  correo_propuesto text,
  telefono_propuesto text,
  usuario_propuesto text,
  nombre_propuesto text,
  verificada_en timestamptz,
  intentos smallint not null default 0 check (intentos between 0 and 5),
  expira_en timestamptz not null,
  creado_en timestamptz not null default now()
);
-- La tabla puede existir si se ejecutó una versión anterior de esta migración.
alter table public.verificaciones_cuenta drop constraint if exists verificaciones_cuenta_canal_check;
alter table public.verificaciones_cuenta add constraint verificaciones_cuenta_canal_check
  check (canal in ('email', 'sms', 'bootstrap'));
create index if not exists verificaciones_cuenta_usuario_solicitud_idx
  on public.verificaciones_cuenta(usuario_id, solicitud_id, creado_en desc);

alter table public.verificaciones_cuenta enable row level security;
revoke all on table public.verificaciones_cuenta from public, anon, authenticated;

-- Evita que el cliente cambie directamente correo, teléfono o usuario.
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
      or new.usuario is distinct from old.usuario
      or new.consentimiento_datos_en is distinct from old.consentimiento_datos_en then
      raise exception 'Los datos de acceso y contacto se actualizan mediante verificación segura.' using errcode = '42501';
    end if;
  end if;
  -- Incluso un administrador autenticado no puede alterar directamente sus
  -- propios canales de recuperación: debe pasar por la Edge Function.
  if auth.uid() = old.id and old.rol = 'administrador' and (
    new.correo is distinct from old.correo
    or new.telefono is distinct from old.telefono
    or new.usuario is distinct from old.usuario
  ) then
    raise exception 'Usa el flujo de verificación para cambiar correo, teléfono o usuario.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Activa la protección: definir la función sin este trigger deja los campos
-- sensibles editables desde el cliente.
drop trigger if exists perfiles_proteger_campos on public.perfiles;
create trigger perfiles_proteger_campos
before update on public.perfiles
for each row execute procedure public.proteger_campos_perfil();

-- La Edge Function usa service_role; ningún rol de cliente accede a esta tabla.
grant select, insert, update, delete on public.verificaciones_cuenta to service_role;
