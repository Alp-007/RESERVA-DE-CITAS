# Plan de pruebas

## Alcance y estado

Incluye autenticación, roles, agenda, reglas de acceso, flujo de comprobantes, OCR y responsive. Las pruebas unitarias del parser OCR, comparación de montos y archivos se ejecutan con `npm.cmd test`. Las pruebas contra una instancia real de Supabase quedan pendientes de configurar credenciales, ejecutar la migración y crear cuentas de prueba. No aprobar pagos reales durante las pruebas.

## Preparación

1. Crear un proyecto de Supabase de desarrollo y configurar `.env`.
2. Ejecutar `supabase/migrations/202610110001_backend_citas.sql` y luego `supabase/migrations/202610110002_requisitos_resumen_proyecto.sql`.
3. Crear tres cuentas distintas desde Registro: usuario, profesional y administrador. Asignar los roles de profesional/administrador con las consultas del SQL.
4. Asignar un profesional al usuario, configurar horarios en el panel y usar comprobantes ficticios; no mover dinero real.
5. Registrar capturas sin datos personales reales en `docs/evidencias/`.

## Casos funcionales

| ID | Área | Acción | Resultado esperado | Estado |
|---|---|---|---|---|
| F-01 | Registro | Crear cuenta con datos, consentimiento y contraseña válida | Auth crea la cuenta y perfil con rol `usuario`; la edad se calcula en el formulario | Pendiente de Supabase |
| F-02 | Registro | Confirmar contraseñas diferentes | El formulario muestra error y no llama al servicio | Pendiente de ejecución |
| F-03 | Login | Iniciar con credenciales válidas | Se abre el panel correspondiente al rol del perfil | Pendiente de Supabase |
| F-04 | Login | Iniciar con clave incorrecta | Se muestra un mensaje; no se abre un panel privado | Pendiente de Supabase |
| F-05 | Citas | Solicitar un horario libre dentro de la disponibilidad asignada | Cita pendiente creada con duración y aporte de $5.000/$12.000 COP según validación | Pendiente de Supabase |
| F-06 | Citas | Seleccionar fecha pasada, domingo o fuera de horario | Base de datos rechaza la cita y muestra error | Pendiente de Supabase |
| F-07 | Citas | Crear citas que se cruzan para el mismo usuario/profesional | La restricción de exclusión rechaza el cruce, incluso en solicitudes simultáneas | Pendiente de Supabase |
| F-08 | Usuario | Cancelar o reprogramar antes de 24 horas | RPC permite cambio; dentro de 24 horas lo rechaza | Pendiente de Supabase |
| F-09 | Profesional | Ver agenda asignada y registrar atención/inasistencia | Solo profesional asignado puede registrar resultado; inasistencia espera 15 minutos | Pendiente de Supabase |
| F-10 | Admin | Asignar profesional y cambiar roles | Asignación y roles se actualizan solo con permiso administrador | Pendiente de Supabase |
| F-11 | Precio | Configurar precio de servicio | Nuevas citas copian el precio vigente; las antiguas conservan su valor | Pendiente de Supabase |
| F-12 | Pago | Cargar comprobante de imagen/PDF permitido | Archivo privado, fila del pago en revisión e historial creado | Pendiente de Supabase |
| F-13 | OCR | Procesar imagen con texto en español | Extrae candidatos de valor, fecha y referencia; muestra confianza y comparación | Pendiente de ejecución |
| F-14 | Pago | Administrador rechaza comprobante | Motivo queda guardado y usuario puede reenviar | Pendiente de Supabase |
| F-15 | Pago | Administrador aprueba comprobante válido | Historial registra decisión y cita queda confirmada | Pendiente de Supabase |
| F-16 | Responsive | Abrir home y paneles en móvil/escritorio | Controles legibles, tarjetas adaptan ancho y tabla permite desplazamiento | Pendiente de ejecución |
| F-17 | Inasistencia | Registrar no asistencia y pedir una nueva cita en los 8 días siguientes | Sistema bloquea la solicitud hasta que termine el plazo | Pendiente de Supabase |
| F-18 | Cambio de profesional | Aprobar una solicitud con profesional seleccionado | Se actualizan asignación y citas futuras, y el usuario recibe aviso | Pendiente de Supabase |
| F-19 | Cancelación administrativa | Cancelar una cita con pago aprobado | Se crea un bono equivalente al pago aprobado | Pendiente de Supabase |
| F-20 | Perfil | Editar datos, calcular edad y subir remisión privada | Propietario actualiza su perfil y el documento solo es visible para administración | Pendiente de Supabase |

## Casos de seguridad

| ID | Prueba | Resultado esperado | Estado |
|---|---|---|---|
| S-01 | Usuario A consulta/modifica perfil o citas de usuario B por REST | RLS deniega o devuelve cero filas | Pendiente de Supabase |
| S-02 | Usuario cambia `rol` a administrador mediante REST | Trigger rechaza la operación | Pendiente de Supabase |
| S-03 | Usuario crea cita asignándose profesional o estado confirmada | Política RLS rechaza la inserción | Pendiente de Supabase |
| S-04 | Profesional consulta pagos o cita no asignada | RLS no expone esos registros | Pendiente de Supabase |
| S-05 | Profesional actualiza fecha, precio, usuario u horario de cita | Trigger de servidor rechaza cambios; solo deja completar cita asignada | Pendiente de Supabase |
| S-06 | Usuario lee recibo de otra persona o intenta usar URL pública | Bucket privado y RLS deniegan lectura | Pendiente de Supabase |
| S-07 | Subir ejecutable, archivo >8 MB o ruta de otro usuario | Storage rechaza el archivo | Pendiente de Supabase |
| S-08 | Intentar inventar monto de pago en REST | Trigger reemplaza monto por el valor congelado en la cita | Pendiente de Supabase |
| S-09 | Buscar `service_role` y `.env` en el repositorio | No se encuentra secreto; `.env` ignorado por Git | Revisar antes de publicar |
| S-10 | Usuario intenta cambiar asignación, rol, estado de cuenta o validación de estudiante | Trigger rechaza editar campos protegidos | Pendiente de Supabase |

## Registro de evidencias

Guardar una captura por caso ejecutado con identificador, fecha, versión/commit, resultado (aprobado/no aprobado), observación y datos de prueba anonimizados. Aún no hay evidencias de integración real mientras falten credenciales y migración.

## Validación local registrada

- Compilación Vite en esta actualización: **aprobada**.
- Oxlint: **aprobado sin diagnósticos**.
- Las pruebas de OCR/importe/tipos de archivo constan como ejecutadas en el registro previo; no se repitieron en esta actualización.
- Pruebas funcionales del navegador, Auth, RLS, Storage y paneles con Supabase: **pendientes**.
