# Manual de usuario y puesta en marcha

## 1. Preparar el proyecto

### Requisitos

- Node.js LTS y npm instalados.
- Cuenta Supabase y un proyecto de desarrollo.
- Git opcional para colaborar.

### Configurar Supabase

1. En Supabase, abre **SQL Editor** y ejecuta primero `supabase/migrations/202610110001_backend_citas.sql` y después `supabase/migrations/202610110002_requisitos_resumen_proyecto.sql`, en ese orden.
2. En **Project Settings → API**, copia la URL del proyecto y la clave pública `anon`/`publishable`.
3. Copia `.env.example` como `.env` en la raíz del proyecto y rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. `VITE_NEQUI_DESTINO` queda vacío hasta que el equipo confirme el número receptor. No inventes un número.
5. En **Authentication → URL Configuration**, registra la URL de desarrollo `http://localhost:5173` y la URL de producción al desplegar.
6. Nunca pegues `service_role`, claves privadas, contraseñas de base de datos ni datos reales de pago en `.env` del frontend o GitHub.

### Ejecutar localmente en PowerShell

```powershell
npm.cmd install
npm.cmd run dev
```

Abre la URL local que muestra Vite, normalmente `http://localhost:5173/`. Mantén la terminal activa. En `.env` no compartido, el navegador muestra la vista previa sin activar Auth o consultas.

Para revisar la lógica local de lectura/formatos y archivos, ejecuta `npm.cmd test`; para estilo, `npm.cmd run lint`; para compilar, `npm.cmd run build`.

## 2. Crear cuentas y asignar roles

1. Usa **Crear cuenta** y completa los datos solicitados, acepta el tratamiento de datos y crea una contraseña de mínimo ocho caracteres.
2. Si Supabase solicita confirmar el correo, usa el código o el enlace recibido para activar la cuenta.
3. Toda cuenta inicia con rol `usuario`. La selección de tipo no concede permisos de profesional ni administrador.
4. Para registrar estudiantes, usa el correo institucional. El precio de estudiante se habilita cuando Supabase confirma el correo institucional; esto no verifica la matrícula académica. La validación de matrícula requiere conexión autorizada con el sistema institucional.
5. Para el primer administrador, confirma su cuenta y ejecuta en SQL Editor, reemplazando el correo:

```sql
update public.perfiles p
set rol = 'administrador'
from auth.users u
where u.id = p.id and u.email = 'admin@ejemplo.com';
```

6. Inicia sesión con la cuenta administradora. En **Usuarios y roles**, cambia perfiles existentes a `profesional` cuando el equipo lo autorice y asigna cada profesional a los usuarios que atenderá. Configura sus horarios antes de habilitar solicitudes.

## 3. Flujo de usuario

1. Inicia sesión y desde el menú abre **Solicitar una cita**.
2. Elige un servicio, fecha desde hoy y horario libre de tu profesional asignado; escribe el motivo y envía.
3. La disponibilidad configurada por el administrador es de lunes a sábado, 08:00–18:00 (Bogotá). La base impide cruces, calcula duración y conserva el aporte vigente.
4. Transfiere el aporte mostrado al número Nequi que el equipo haya configurado y adjunta JPG, PNG, WEBP o PDF de máximo 8 MB.
5. En imágenes, Tesseract.js intenta OCR en español dentro del navegador para sugerir monto, fecha y referencia. Es una ayuda; la administración confirma manualmente la transferencia.
6. Consulta el estado del pago en **Mis citas**. Si se rechaza, lee la nota y vuelve a enviar un comprobante.
7. Puedes cancelar o reprogramar con al menos 24 horas de anticipación. Si no asistes, el profesional puede registrar la inasistencia después de 15 minutos; entonces el sistema bloquea nuevas solicitudes durante 8 días.
8. Si necesitas otro profesional, envía una solicitud desde **Mi perfil**. El administrador revisa y, si la aprueba, cambia la asignación.

## 4. Flujo profesional

En **Agenda asignada**, la persona profesional ve solo citas asignadas a su perfil. Al terminar el horario puede marcarla como atendida; tras 15 minutos desde la hora de inicio puede registrar la inasistencia. La base impide cambiar el horario, el precio o los datos del paciente desde este rol.

## 5. Flujo administrador

El panel permite gestionar cuentas y roles, asignar profesionales y sus horarios, revisar documentos privados, ajustar los aportes, resolver cambios de profesional, revisar comprobantes, aprobar/rechazar pagos y revisar reportes e historiales. Al aprobar un pago, la cita pasa a confirmada. Una cancelación administrativa genera un bono por el valor pagado aprobado.

El OCR solo ayuda a leer; no verifica que el dinero haya llegado a Nequi. El administrador debe cotejar el comprobante y confirmar la transacción en el canal acordado antes de aprobar.

## 6. Solución de problemas

- **La página no abre o queda en blanco:** verifica que `npm.cmd run dev` siga activo y revisa la primera línea roja de la terminal/navegador.
- **Dice que falta conectar Supabase:** completa `.env` y reinicia Vite para que lea las variables.
- **No aparece el perfil tras login:** confirma que la migración se ejecutó después de crear el proyecto; cerrar y volver a iniciar sesión.
- **El aporte aparece en cero o no corresponde:** un administrador debe revisar los valores en **Aportes económicos** y confirmar si el correo institucional está validado.
- **No se puede subir un recibo:** comprueba tipo de archivo, tamaño (≤8 MB), internet y bucket `comprobantes-pago` privado.
- **No funciona el OCR:** habilita conexión para descargar el motor/modelo de idioma; puedes enviar un recibo para revisión manual si el OCR no carga.

## Alcance de la versión

Esta versión modela pago por comprobante Nequi y revisión administrativa. No inicia transferencias Nequi ni consulta sus sistemas. Las notificaciones se muestran dentro de la aplicación; enviar correo/SMS requiere configurar un proveedor externo. El beneficio de estudiante se activa por correo institucional confirmado, pero no consulta el sistema de matrículas. La lectura OCR ocurre en el navegador y requiere confirmar sus resultados.
