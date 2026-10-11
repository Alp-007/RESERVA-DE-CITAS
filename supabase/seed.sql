-- Semillas seguras para Supabase. No crea usuarios falsos en auth.users.
-- Crea el usuario de prueba desde Registro y luego usa su UUID en la consulta
-- comentada al final, o usa la pantalla de solicitud de citas.

insert into public.servicios (nombre, descripcion, duracion_minutos, precio_cop, activo)
values
  ('Consulta psicológica', 'Espacio de atención psicológica individual.', 45, 0, true),
  ('Orientación inicial de prueba', 'Servicio de demostración para validar el flujo.', 30, 0, true)
on conflict (nombre) do nothing;

-- Configura un precio de prueba solo en desarrollo:
-- update public.servicios set precio_cop = 1000 where nombre = 'Orientación inicial de prueba';

-- Ejemplo de cita de prueba (reemplaza el UUID por el perfil creado en el formulario
-- y la fecha por un lunes-sábado futuro entre 08:00 y 18:00, hora de Bogotá):
-- insert into public.citas (usuario_id, servicio_id, inicio, fin, motivo)
-- select 'UUID_DEL_PERFIL'::uuid, id,
--        (date_trunc('week', now() at time zone 'America/Bogota') + interval '7 days 10 hours') at time zone 'America/Bogota',
--        (date_trunc('week', now() at time zone 'America/Bogota') + interval '7 days 10 hours 45 minutes') at time zone 'America/Bogota',
--        'Cita de prueba del sistema'
-- from public.servicios where nombre = 'Consulta psicológica';
