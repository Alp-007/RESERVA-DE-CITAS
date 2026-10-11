# Reserva de Citas Psicológicas

Aplicación web React/Vite para atención psicológica universitaria. Backend con Supabase Auth, PostgreSQL, API REST, RLS y Storage privado. La documentación de modelo, uso y pruebas está en `docs/`.

## Iniciar localmente

```powershell
npm.cmd install
npm.cmd run dev
```

Validación local: `npm.cmd test`, `npm.cmd run lint` y `npm.cmd run build`.

Consulta [el manual de puesta en marcha](docs/manual-usuario.md) para configurar Supabase, crear roles y ejecutar los flujos. Requiere `.env` local; `.env.example` es solo una plantilla.

## Funciones

- Página pública responsive con servicios.
- Registro e inicio/cierre de sesión con correo y contraseña.
- Perfiles con roles `usuario`, `profesional`, `administrador`; rol inicial y elevación protegidos en base.
- Paneles diferenciados: solicitud/cancelación y seguimiento de citas; agenda profesional asignada; administración de perfiles, precios, agenda y pagos.
- Datos ampliados del registro, verificación institucional por correo confirmado, consentimiento, perfil editable y recuperación de contraseña.
- Regla de 24 horas para cancelar/reprogramar, espera de 8 días tras inasistencia, bonos por cancelación administrativa y solicitudes de cambio de profesional.
- Notificaciones dentro de la aplicación, auditoría de citas y pagos, horarios profesionales, tarifas de $5.000 COP y $12.000 COP configurables.
- API REST Supabase desde el SDK; políticas RLS en todas las tablas y reglas de negocio en PostgreSQL.
- Reglas de agenda lunes-sábado, 08:00–18:00 hora de Bogotá; duración según servicio; no permitir cruces.
- Pago por transferencia Nequi con carga de comprobante privado, OCR local orientativo en imágenes, revisión humana y trazabilidad.

## Backend y base de datos

- `supabase/migrations/202610110001_backend_citas.sql`: tablas, relaciones, triggers, RLS, funciones y Storage privado.
- `supabase/migrations/202610110002_requisitos_resumen_proyecto.sql`: campos y reglas ampliadas del documento del proyecto. Debe ejecutarse después de la migración 001.
- `supabase/seed.sql`: servicio de demostración y ejemplo de datos para desarrollo.
- `supabase/consultas.sql`: consultas de control y ejemplos de administración.
- `src/supabase.js`: cliente; permanece desactivado si faltan las variables para que la vista pública no quede en blanco.
- `docs/modelo-er-relacional.md`: diagrama ER y esquema relacional.
- `docs/api.md`: recursos REST, permisos y ejemplos del SDK.

Supabase genera los endpoints REST `/rest/v1` para las tablas. Las políticas se aplican a cada solicitud autenticada. No se expone una clave `service_role` en el cliente.

## Seguridad y pagos

- Nunca subas `.env`, contraseñas, claves privadas, números de prueba reales ni `service_role`.
- `perfiles.rol` no se toma de metadatos del cliente; el trigger de perfil asigna `usuario`.
- Los recibos están en un bucket privado y solo propietario/administrador pueden leerlos.
- OCR corre en el navegador y solo sugiere datos. La aplicación no se conecta al sistema de Nequi ni verifica una transferencia real; la aprobación debe ser humana.
- El aporte inicial es $5.000 COP para estudiantes con correo institucional confirmado y $12.000 COP para otros usuarios; un administrador puede ajustar los valores. Cada cita conserva una copia del aporte vigente al solicitarla.
- Número receptor Nequi está vacío a propósito en `.env.example`; el equipo debe confirmarlo y configurar `VITE_NEQUI_DESTINO`.

## Estructura

```text
src/
  pages/                 Registro, panel usuario/profesional/administrador
  lib/                   Formato COP/fechas y OCR de comprobantes
  App.jsx                Auth, navegación, landing y selección de panel
  supabase.js            Cliente Supabase configurable
supabase/
  migrations/            Backend PostgreSQL/RLS/Storage
  seed.sql               Datos de demostración
  consultas.sql          Consultas SQL para equipo y administrador
docs/
  modelo-er-relacional.md
  api.md
  plan-pruebas.md
  manual-usuario.md
  registro-errores.md
```

## Entrega y validación

Casos funcionales y de seguridad en `docs/plan-pruebas.md`. Deben ejecutarse contra Supabase con cuentas de desarrollo y completarse las evidencias. No aprobar transacciones reales desde este sistema sin validarlas manualmente en Nequi.
