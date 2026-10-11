# API de la aplicación

La API REST la genera Supabase/PostgREST sobre las tablas `public`. En el frontend se consume con `@supabase/supabase-js`, que adjunta la clave pública y la sesión autenticada. Todas las lecturas y escrituras siguen RLS; conocer una URL o un UUID no concede acceso.

## Operaciones principales

| Uso | Recurso | Acceso |
|---|---|---|
| Registrar e iniciar/cerrar sesión | Supabase Auth (`supabase.auth.signUp`, `signInWithPassword`, `signOut`) | Público para registro; sesión autenticada para operaciones privadas |
| Consultar servicios | `GET /rest/v1/servicios?select=*` | Sesión autenticada; servicios activos. Administrador ve todos |
| Solicitar cita | `POST /rest/v1/citas` | Usuario autenticado; solo propia, sin asignar y pendiente |
| Consultar citas | `GET /rest/v1/citas?select=*` | Propias, asignadas al profesional o todas para administrador |
| Cancelar solicitud propia | `POST /rest/v1/rpc/cancelar_cita` | Usuario dueño; solamente cita pendiente |
| Consultar perfiles/roles | `GET /rest/v1/perfiles?select=*` | Usuario propio; profesional ve paciente asignado; administrador ve todos |
| Cargar comprobante | `POST /storage/v1/object/comprobantes-pago/<uid>/<nombre>` | Propietario autenticado; bucket privado, 8 MB máximo y MIME autorizado |
| Registrar pago | `POST /rest/v1/pagos` | Dueño de la cita; trigger toma el precio congelado y estado de revisión |
| Revisar pago | `PATCH /rest/v1/pagos?id=eq.<uuid>` | Administrador solamente; auditoría automática y aprobación confirma la cita |
| Cambiar roles/precios/asignaciones | `PATCH /rest/v1/perfiles`, `servicios` o `citas` | Administrador solamente |

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
```

No se incluye una clave `service_role` en React. Esa clave evita RLS y solo debe usarse en procesos confiables del servidor, no en esta aplicación.
