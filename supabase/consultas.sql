-- Consultas de soporte y verificación. Ejecutar en SQL Editor con rol postgres.

-- 1. Perfiles registrados y roles (no muestra contraseñas).
select p.id, u.email, p.nombre_completo, p.tipo_usuario, p.rol, p.creado_en
from public.perfiles p join auth.users u on u.id = p.id
order by p.creado_en desc;

-- 2. Solicitudes de citas con usuario, profesional y servicio.
select c.id, c.inicio, c.fin, c.estado, c.valor_cop, s.nombre as servicio,
       cliente.nombre_completo as usuario, profesional.nombre_completo as profesional
from public.citas c
join public.servicios s on s.id = c.servicio_id
join public.perfiles cliente on cliente.id = c.usuario_id
left join public.perfiles profesional on profesional.id = c.profesional_id
order by c.inicio desc;

-- 3. Pagos y lectura OCR en espera de validación humana.
select p.id, p.cita_id, p.estado, p.monto_cop, p.ocr_monto_cop,
       p.ocr_referencia, p.ocr_confianza, p.creado_en
from public.pagos p order by p.creado_en desc;

-- 4. Historial de cambios de estados.
select h.pago_id, h.estado_anterior, h.estado_nuevo, h.actor_id, h.nota, h.ocurrido_en
from public.historial_pagos h order by h.ocurrido_en desc;

-- 5. Citas próximas por profesional.
select p.nombre_completo as profesional, c.inicio, c.fin, c.estado,
       cliente.nombre_completo as usuario, c.motivo
from public.citas c
join public.perfiles p on p.id = c.profesional_id
join public.perfiles cliente on cliente.id = c.usuario_id
where c.inicio >= now() and c.estado in ('pendiente','confirmada')
order by p.nombre_completo, c.inicio;

-- 6. Aprobar un profesional. Reemplaza el correo de prueba.
-- update public.perfiles p set rol = 'profesional'
-- from auth.users u where u.id = p.id and u.email = 'profesional@ejemplo.com';

-- 7. Asignar un administrador inicial después de crear y confirmar su cuenta.
-- Ejecutar solo con el correo acordado como administrador del proyecto.
-- update public.perfiles p set rol = 'administrador'
-- from auth.users u where u.id = p.id and u.email = 'admin@ejemplo.com';
