-- Separa la verificación de cambio de contraseña de los cambios de perfil.
alter table public.verificaciones_cuenta
  add column if not exists proposito text not null default 'perfil';

alter table public.verificaciones_cuenta
  drop constraint if exists verificaciones_cuenta_proposito_check;
alter table public.verificaciones_cuenta
  add constraint verificaciones_cuenta_proposito_check
  check (proposito in ('perfil', 'contrasena'));

create index if not exists verificaciones_cuenta_proposito_idx
  on public.verificaciones_cuenta(usuario_id, proposito, creado_en desc);
