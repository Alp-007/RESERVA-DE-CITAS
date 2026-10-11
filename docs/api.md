# API de la aplicación

La API REST la genera Supabase/PostgREST sobre las tablas `public`. En el frontend se consume con `@supabase/supabase-js`, que adjunta la clave pública y la sesión autenticada. Todas las lecturas y escrituras siguen RLS; conocer una URL o un UUID no concede acceso.

La API REST la genera Supabase/PostgREST sobre las tablas `public`. El alcance requiere aplicar las migraciones `202610110001` y `202610110002` en ese orden.

## Operaciones principales

| Uso | Recurso | Acceso |
|---|---|---|
| Registrar e iniciar/cerrar sesión | Supabase Auth (`supabase.auth.signUp`, `signInWithPassword`, `signOut`) | Público para registro; sesión autenticada para operaciones privadas |
| Consultar servicios | `GET /rest/v1/servicios?select=*` | Sesión autenticada; servicios activos. Administrador ve todos |
| Consultar horarios | `POST /rest/v1/rpc/obtener_horarios_disponibles` | Usuario autenticado con profesional asignado |
| Solicitar cita | `POST /rest/v1/citas` | Usuario autenticado; solo propia, profesional asignado y estado pendiente |
| Consultar citas | `GET /rest/v1/citas?select=*` | Propias, asignadas al profesional o todas para administrador |
| Cancelar cita propia | `POST /rest/v1/rpc/cancelar_cita` | Usuario dueño; cita pendiente/confirmada, con 24 horas de anticipación |
| Reprogramar cita | `POST /rest/v1/rpc/reprogramar_cita` | Usuario dueño; mínimo 24 horas, disponibilidad y reglas verificadas por PostgreSQL |
| Consultar perfiles/roles | `GET /rest/v1/perfiles?select=*` | Usuario propio o administración; profesionales no leen datos privados de los usuarios |
| Asignar profesional | `POST /rest/v1/rpc/asignar_profesional_usuario` | Solo administración; propaga asignación a citas futuras |
| Resolver cambio de profesional | `POST /rest/v1/rpc/resolver_solicitud_cambio_profesional` | Solo administración; aprobación asigna profesional y notifica al usuario |
| Cargar comprobante | `POST /storage/v1/object/comprobantes-pago/<uid>/<nombre>` | Propietario autenticado; bucket privado, 8 MB máximo y MIME autorizado |
| Registrar pago | `POST /rest/v1/pagos` | Dueño de la cita; trigger toma el precio congelado y estado de revisión |
| Revisar pago | `PATCH /rest/v1/pagos?id=eq.<uuid>` | Administrador solamente; auditoría automática y aprobación confirma la cita |
| Revisar horarios, aportes, bonos e historiales | Tablas `horarios_profesionales`, `configuracion_aportes`, `bonos_cita`, `historial_citas`, `historial_pagos` | Solo las políticas RLS correspondientes; edición administrativa |
| Consultar notificaciones | `GET /rest/v1/notificaciones` | Solo propietario o administración |
| Marcar notificación leída | `POST /rest/v1/rpc/marcar_notificacion_leida` | Solo la cuenta propietaria de esa notificación |
| Cambiar roles/asignaciones | `PATCH /rest/v1/perfiles` o RPC de asignación | Administrador solamente; las funciones SQL protegen campos sensibles |

## Ejemplos de SDK

```js
const { data: servicios, error } = await supabase
  .from('servicios')
  .select('id,nombre,duracion_minutos,precio_cop')
  .eq('activo', true)

const { data: nuevaCita, error: errorCita } = await supabase
  .from('citas')
  .insert({
    usuario_id: usuario.id,
    servicio_id: servicioId,
    inicio: fechaHora.toISOString(),
    motivo: 'Solicitud de acompañamiento',
  })
  .select()
  .single()

const { data: citas, error: errorConsulta } = await supabase
  .from('citas')
  .select('id,inicio,fin,estado,valor_cop,servicios(nombre)')
  .order('inicio')

const { error: errorCancelacion } = await supabase
  .rpc('cancelar_cita', { cita: idCita })

const { data: espacios, error: errorHorarios } = await supabase
  .rpc('obtener_horarios_disponibles', { servicio: servicioId, fecha: '2026-10-12' })
```

No se incluye una clave `service_role` en React. Esa clave evita RLS y solo debe usarse en procesos confiables del servidor, no en esta aplicación.
