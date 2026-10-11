# Plan de pruebas

## Alcance y estado

Incluye autenticación, roles, agenda, reglas de acceso, flujo de comprobantes, OCR y responsive. Las pruebas unitarias del parser OCR, comparación de montos y archivos se ejecutan con `npm.cmd test`. Las pruebas contra una instancia real de Supabase quedan pendientes de configurar credenciales, ejecutar la migración y crear cuentas de prueba. No aprobar pagos reales durante las pruebas.

## Preparación

1. Crear un proyecto de Supabase de desarrollo y configurar `.env`.
2. Ejecutar `supabase/migrations/202610110001_backend_citas.sql`.
3. Crear tres cuentas distintas desde Registro: usuario, profesional y administrador. Asignar los roles de profesional/administrador con las consultas del SQL.
4. Definir un precio de prueba bajo en `servicios`; usar comprobantes ficticios y no dinero real.
5. Registrar capturas sin datos personales reales en `docs/evidencias/`.

## Casos funcionales

| ID | Área | Acción | Resultado esperado | Estado |
|---|---|---|---|---|
| F-01 | Registro | Crear cuenta con correo, nombre, tipo y contraseña válida | Supabase Auth crea la cuenta y el trigger genera perfil con rol `usuario` | Pendiente de Supabase |
| F-02 | Registro | Confirmar contraseñas diferentes | El formulario muestra error y no llama al servicio | Pendiente de ejecución |
| F-03 | Login | Iniciar con credenciales válidas | Se abre el panel correspondiente al rol del perfil | Pendiente de Supabase |
| F-04 | Login | Iniciar con clave incorrecta | Se muestra un mensaje; no se abre un panel privado | Pendiente de Supabase |
| F-05 | Citas | Solicitar servicio en fecha futura, lunes-sábado 08:00–18:00 | Cita pendiente creada con duración y precio del servicio | Pendiente de Supabase |
| F-06 | Citas | Seleccionar fecha pasada, domingo o fuera de horario | Base de datos rechaza la cita y muestra error | Pendiente de Supabase |
| F-07 | Citas | Crear citas que se cruzan para el mismo usuario/profesional | La restricción de exclusión rechaza el cruce, incluso en solicitudes simultáneas | Pendiente de Supabase |
| F-08 | Usuario | Cancelar una cita pendiente propia | RPC cambia estado a cancelada y libera el horario | Pendiente de Supabase |
| F-09 | Profesional | Ver agenda asignada y marcar cita confirmada como completada | Solo el profesional asignado actualiza estado permitido | Pendiente de Supabase |
| F-10 | Admin | Asignar profesional y cambiar roles | Asignación y roles se actualizan; nuevo perfil conserva su rol | Pendiente de Supabase |
| F-11 | Precio | Configurar precio de servicio | Nuevas citas copian el precio vigente; las antiguas conservan su valor | Pendiente de Supabase |
| F-12 | Pago | Cargar comprobante de imagen/PDF permitido | Archivo privado, fila del pago en revisión e historial creado | Pendiente de Supabase |
| F-13 | OCR | Procesar imagen con texto en español | Extrae candidatos de valor, fecha y referencia; muestra confianza y comparación | Pendiente de ejecución |
| F-14 | Pago | Administrador rechaza comprobante | Motivo queda guardado y usuario puede reenviar | Pendiente de Supabase |
| F-15 | Pago | Administrador aprueba comprobante válido | Historial registra decisión y cita queda confirmada | Pendiente de Supabase |
| F-16 | Responsive | Abrir home y paneles en móvil/escritorio | Controles legibles, tarjetas adaptan ancho y tabla permite desplazamiento | Pendiente de ejecución |

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

## Registro de evidencias

Guardar una captura por caso ejecutado con identificador, fecha, versión/commit, resultado (aprobado/no aprobado), observación y datos de prueba anonimizados. Aún no hay evidencias de integración real mientras falten credenciales y migración.

## Validación local completada

- Pruebas unitarias de OCR/importe/tipos de archivo: **6 aprobadas**.
- Compilación Vite: **aprobada**.
- Oxlint: **aprobado sin advertencias**.
- Pruebas funcionales del navegador, Auth, RLS, Storage y paneles con Supabase: **pendientes**.
