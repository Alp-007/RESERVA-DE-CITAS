# Reserva de Citas — Backend Supabase

Aplicación React/Vite para solicitud de citas de atención psicológica. El backend usa Supabase Auth, PostgreSQL y la API REST generada por Supabase. La migración crea perfiles, roles, citas, validaciones y políticas de seguridad a nivel de fila (RLS).

## Configuración

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, ejecuta `supabase/migrations/202610110001_backend_citas.sql`.
3. En **Project Settings → API**, copia la Project URL y la clave pública `anon`/`publishable` a un archivo `.env` en la raíz, usando `.env.example` como referencia.
4. En **Authentication → URL Configuration**, configura la URL local y la URL de producción permitidas para redirección. Ajusta la confirmación por correo según el despliegue.
5. Instala y ejecuta la aplicación con `npm install` y `npm run dev`.

La clave pública se usa en el navegador; nunca agregues una clave `service_role` a variables `VITE_*` o al frontend. La clave privilegiada solo debe usarse desde un servidor de confianza.

## Autenticación y roles

- El registro crea una cuenta en Supabase Auth y el trigger crea su fila en `public.perfiles`.
- `tipo_usuario` puede ser `estudiante` o `externo`; se recoge en el formulario de registro.
- `rol` se establece siempre en `usuario` en el servidor. No se confía en metadatos enviados por el navegador para asignar privilegios.
- Roles soportados: `usuario`, `psicologo` y `administrador`.
- Un administrador asigna un rol desde el SQL Editor:

```sql
update public.perfiles
set rol = 'psicologo'
where id = 'UUID_DEL_USUARIO';
```

La cuenta administradora inicial puede establecerse del mismo modo con `rol = 'administrador'`. La protección del trigger impide que una persona cambie su propio rol.

## Reglas de citas

- Una cita pertenece al usuario que la solicita y puede tener un profesional asignado por el personal.
- Duración permitida: de 15 minutos a 2 horas.
- El inicio debe ser futuro; atención de lunes a sábado entre 08:00 y 18:00, hora de Bogotá.
- Citas pendientes o confirmadas no pueden cruzarse para el mismo usuario o profesional.
- Un usuario solo puede solicitar sus citas y cancelar las que sigan pendientes.
- Psicólogos y administradores pueden consultar y gestionar citas según su rol; usuarios solo ven las propias.
- Las reglas se ejecutan en PostgreSQL para que también apliquen a las llamadas directas a la API.

## API REST

Supabase expone las tablas mediante PostgREST en `/rest/v1`. El SDK adjunta la sesión y aplica RLS:

```js
// Crear solicitud: inicio y fin son fechas ISO con zona horaria.
const { data, error } = await supabase
  .from('citas')
  .insert({
    usuario_id: usuario.id,
    inicio: '2026-11-02T14:00:00-05:00',
    fin: '2026-11-02T14:45:00-05:00',
    motivo: 'Quiero solicitar acompañamiento',
  })
  .select()
  .single()

// Listar las citas visibles para la sesión actual.
const { data: citas, error: errorConsulta } = await supabase
  .from('citas')
  .select('id, inicio, fin, motivo, estado, profesional_id')
  .order('inicio', { ascending: true })

// Consultar el perfil propio.
const { data: perfil, error: errorPerfil } = await supabase
  .from('perfiles')
  .select('id, nombre_completo, tipo_usuario, rol')
  .single()
```

Autenticación se ofrece mediante `supabase.auth.signUp`, `supabase.auth.signInWithPassword` y `supabase.auth.signOut`. Los endpoints base y las credenciales públicas se configuran en `.env`.

## Estructura backend

- `supabase/migrations/202610110001_backend_citas.sql`: tablas, índices, trigger de perfil, validaciones de agenda, roles, grants y políticas RLS.
- `src/supabase.js`: conexión del cliente con variables de entorno.
- `src/App.jsx`: registro e inicio/cierre de sesión conectados a Supabase Auth.

## Límites de esta entrega

La reserva está implementada como solicitud pendiente y los endpoints de tablas quedan disponibles vía API REST de Supabase. El proyecto aún no contiene una pantalla de calendario/asignación administrativa ni notificaciones de confirmación de cita; se pueden construir sobre las tablas y reglas ya preparadas.
