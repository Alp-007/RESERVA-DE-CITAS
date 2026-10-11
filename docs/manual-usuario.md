# Manual de usuario y puesta en marcha

## 1. Preparar el proyecto

### Requisitos

- Node.js LTS y npm instalados.
- Cuenta Supabase y un proyecto de desarrollo.
- Git opcional para colaborar.

### Configurar Supabase

1. En Supabase, abre **SQL Editor** y ejecuta `supabase/migrations/202610110001_backend_citas.sql`.
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

1. Usa **Crear cuenta** con correo, nombre, tipo de usuario y contraseña de mínimo ocho caracteres.
2. Si Supabase solicita confirmar el correo, abre el mensaje de confirmación y vuelve al login.
3. Toda cuenta inicia con rol `usuario`. La selección de tipo no concede permisos de profesional ni administrador.
4. Para el primer administrador, confirma su cuenta y ejecuta en SQL Editor, reemplazando el correo:

```sql
update public.perfiles p
set rol = 'administrador'
from auth.users u
where u.id = p.id and u.email = 'admin@ejemplo.com';
```

5. Inicia sesión con la cuenta administradora. En **Usuarios y roles**, cambia otros perfiles a `profesional` cuando el equipo lo autorice.

## 3. Flujo de usuario

1. Inicia sesión y abre **Mis citas**.
2. Elige un servicio, fecha futura y hora de lunes a sábado de 08:00 a 18:00 (Bogotá); escribe el motivo y envía.
3. La base calcula duración y conserva el precio vigente cuando se crea la solicitud. La base también rechaza cruces de horario.
4. Si el precio es cero, el administrador debe definirlo en su panel antes de mostrar el pago.
5. Cuando haya valor y número receptor configurados, realiza la transferencia Nequi y adjunta JPG, PNG, WEBP o PDF de máximo 8 MB.
6. En imágenes, Tesseract.js intenta OCR en español dentro del navegador para sugerir monto, fecha y referencia. El archivo no se envía a un servicio de OCR; el navegador descarga el motor/modelo de idioma cuando lo necesita. Revisa lo detectado; para PDF o si OCR falla, la administración hace revisión manual.
7. Consulta el estado del pago en **Mis citas**. Si se rechaza, lee la nota y vuelve a enviar un comprobante.
8. Puedes cancelar una cita pendiente; las confirmadas o completadas requieren gestionar el cambio con el equipo.

## 4. Flujo profesional

En **Agenda asignada**, la persona profesional ve solo citas asignadas a su perfil. Después de una cita confirmada, puede marcarla como completada. La base impide cambiar el horario, el precio o los datos del paciente desde este rol.

## 5. Flujo administrador

El panel permite asignar profesionales, cambiar roles, definir precios, revisar comprobantes privados, aprobar/rechazar pagos con una nota y actualizar el estado de la cita. Al aprobar un pago, la cita pasa a confirmada y se crea registro de auditoría.

El OCR solo ayuda a leer; no verifica que el dinero haya llegado a Nequi. El administrador debe cotejar el comprobante y confirmar la transacción en el canal acordado antes de aprobar.

## 6. Solución de problemas

- **La página no abre o queda en blanco:** verifica que `npm.cmd run dev` siga activo y revisa la primera línea roja de la terminal/navegador.
- **Dice que falta conectar Supabase:** completa `.env` y reinicia Vite para que lea las variables.
- **No aparece el perfil tras login:** confirma que la migración se ejecutó después de crear el proyecto; cerrar y volver a iniciar sesión.
- **El precio sigue en cero:** un administrador debe guardar el precio desde su panel.
- **No se puede subir un recibo:** comprueba tipo de archivo, tamaño (≤8 MB), internet y bucket `comprobantes-pago` privado.
- **No funciona el OCR:** habilita conexión para descargar el motor/modelo de idioma; puedes enviar un recibo para revisión manual si el OCR no carga.

## Alcance de la versión

Esta versión modela pago por comprobante Nequi y revisión administrativa. No inicia transferencias Nequi, no consulta sus sistemas y no prueba recepción de dinero automáticamente. No incluye todavía correos/WhatsApp de recordatorio ni un servicio externo OCR; la lectura de imagen ocurre en el navegador y requiere confirmar sus resultados.
