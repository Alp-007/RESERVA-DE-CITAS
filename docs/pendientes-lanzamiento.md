# Pendientes para completar y publicar

Este estado se basa en los archivos del repositorio. Las tareas marcadas como pendientes requieren datos, decisiones o accesos del equipo.

## Ya implementado en el repositorio

- Registro, inicio y recuperación de contraseña con Supabase Auth; verificación de correo mediante el flujo configurado en Supabase.
- Roles y paneles de usuario, profesional y administrador con reglas de acceso en PostgreSQL/RLS.
- Solicitud, consulta, cancelación y reprogramación de citas, agendas profesionales, historial y notificaciones dentro de la aplicación.
- Tarifas editables, carga privada de comprobantes Nequi, lectura OCR orientativa y revisión humana por el administrador.
- Panel administrativo para usuarios, profesionales, horarios, citas y pagos.
- Asistente informativo con preguntas frecuentes sobre el uso del sitio. No recopila texto libre ni datos clínicos.

## Requiere materiales oficiales del equipo

- **Marca:** reemplazar el monograma provisional “BU”, confirmar los colores institucionales y entregar los logos en SVG o PNG. El azul y amarillo actuales son una aproximación visual al diagrama compartido, no una guía oficial de marca.
- **Contenido institucional:** entregar el texto aprobado de misión, visión, “quiénes somos” y las imágenes de fondo que se quieran publicar.
- **Políticas:** entregar las versiones aprobadas de protección de datos, tratamiento de datos y seguridad de la información. Con esos textos se pueden crear sus páginas y enlaces visibles en el registro y el pie de página.
- **Consentimiento:** el formulario actual guarda una fecha de consentimiento y exige marcar una casilla; la verificación de correo confirma la dirección de la cuenta, pero por sí sola no es una firma digital del consentimiento. Hace falta acordar el texto y versión legal que se aceptarán antes de guardar un comprobante de aceptación más completo.

## Requiere configuración o decisión operativa

- **Administrador inicial:** escoger la cuenta institucional autorizada y asignarle el rol desde Supabase siguiendo el procedimiento de `supabase/consultas.sql`. No elevar cuentas sin confirmar quién debe administrar el sistema.
- **Correo:** revisar remitente, plantillas y límites de envío de Supabase. Para producción conviene configurar un proveedor SMTP institucional verificado y probar registro, códigos y recuperación.
- **Pagos:** el flujo actual es transferencia Nequi con comprobante y aprobación manual. No consulta Nequi ni confirma transferencias automáticamente. Para PSE o recaudo automático se necesita escoger un proveedor y contar con su cuenta, credenciales y URL de retorno/webhook.
- **Publicación:** definir dominio, alojamiento, variables de entorno de producción, responsables de soporte y procedimiento de respaldo.

## Validación pendiente

- Ejecutar el plan funcional y de seguridad contra el proyecto Supabase compartido con cuentas de prueba de cada rol.
- Guardar capturas y resultados en `docs/evidencias/`, corregir los hallazgos y repetir los casos afectados.
- Revisar el flujo completo de registro, consentimiento, agenda, pago manual, aprobación/rechazo, cancelación e inasistencia antes de usar datos reales.
