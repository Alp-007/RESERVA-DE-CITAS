# Registro de errores

Formato para incidencias: identificador, fecha, versión/commit, entorno, pasos, resultado esperado/obtenido, severidad, responsable, estado y evidencia (sin datos personales).

| ID | Incidencia | Estado | Evidencia/nota |
|---|---|---|---|
| BUG-001 | `src/App.jsx` tenía un `import` duplicado dentro del JSX tras separar Registro en componente | Resuelto | Se removió el bloque duplicado y se conservó `src/pages/Registro.jsx`; la compilación de producción posterior pasó. |
| BUG-002 | JSX del pie de página sin etiqueta `<footer>` de apertura después de reparar el bloque duplicado | Resuelto | Se añadió el elemento de apertura; compilación posterior correcta. |
| BUG-003 | OCR no reconocía la frase “Valor de la transferencia” y podía tomar texto genérico como referencia | Resuelto | Se añadieron pruebas de regresión para el parser OCR. |
| PEND-001 | Autenticación, reglas nuevas y RLS aún no probados con la instancia compartida | Pendiente | Requiere ejecutar ambas migraciones en orden y probar con cuentas de desarrollo. |
| PEND-002 | Recepción/validación automática de Nequi no existe | Fuera de integración automática | En esta versión verifica un administrador manualmente; requiere proveedor/API aprobada para automatizar. |

## Validación técnica local

- `npm.cmd run build`: aprobado (Vite transformó los módulos y generó `dist/`).
- `npm.cmd run lint`: aprobado sin advertencias después de corregir los hallazgos.
- Las pruebas unitarias existentes cubren OCR, comparación de monto y tipo/tamaño de comprobante; no se repitieron en esta actualización.
- Migración, Auth, RLS, Storage, OCR de recibos y paneles con datos: pendientes de integración con el proyecto Supabase y cuentas de prueba.

Al agregar incidencias nuevas, cambia `PENDIENTE` a `EN CURSO`, `CORREGIDO` o `CERRADO` y enlaza una captura anonimizada dentro de `docs/evidencias/`.
