# Modelo ER y relacional

La base usa PostgreSQL en Supabase. Las cuentas y contraseñas las gestiona `auth.users`; el resto de tablas conserva únicamente datos funcionales. Ejecuta las migraciones `202610110001` y `202610110002`, en ese orden.

## Diagrama entidad-relación

```mermaid
erDiagram
    AUTH_USERS ||--|| PERFILES : tiene
    PERFILES ||--o{ CITAS : solicita
    PERFILES o|--o{ CITAS : atiende
    SERVICIOS ||--o{ CITAS : define
    CITAS ||--o{ PAGOS : recibe
    PERFILES ||--o{ PAGOS : envia
    PAGOS ||--o{ HISTORIAL_PAGOS : registra
    PERFILES ||--o{ HORARIOS_PROFESIONALES : dispone
    PERFILES ||--o{ NOTIFICACIONES : recibe
    PERFILES ||--o{ SOLICITUDES_CAMBIO_PROFESIONAL : solicita
    CITAS ||--o{ HISTORIAL_CITAS : audita
    CITAS ||--o| BONOS_CITA : compensa

    AUTH_USERS {
        uuid id PK
        text email
    }
    PERFILES {
        uuid id PK,FK
        text nombre_completo
        text tipo_usuario
        text rol
        text tipo_documento
        text numero_documento
        date fecha_nacimiento
        text telefono
        text direccion
        text horario_preferido
        boolean estudiante_validado
        boolean activo
        uuid profesional_asignado_id FK
        timestamptz consentimiento_datos_en
    }
    SERVICIOS {
        uuid id PK
        text nombre UK
        int duracion_minutos
        int precio_cop
        boolean activo
    }
    CITAS {
        uuid id PK
        uuid usuario_id FK
        uuid profesional_id FK
        uuid servicio_id FK
        timestamptz inicio
        timestamptz fin
        int valor_cop
        text motivo
        text estado
        timestamptz reprogramada_en
    }
    PAGOS {
        uuid id PK
        uuid cita_id FK
        uuid usuario_id FK
        int monto_cop
        text estado
        text archivo_path
        text referencia_transaccion
        int ocr_monto_cop
    }
    HISTORIAL_PAGOS {
        bigint id PK
        uuid pago_id FK
        text estado_anterior
        text estado_nuevo
        uuid actor_id
        timestamptz ocurrido_en
    }
    HORARIOS_PROFESIONALES {
        uuid id PK
        uuid profesional_id FK
        int dia_semana
        time hora_inicio
        time hora_fin
        boolean activo
    }
    CONFIGURACION_APORTES {
        boolean id PK
        int aporte_estudiante
        int aporte_otros
    }
    HISTORIAL_CITAS {
        bigint id PK
        uuid cita_id FK
        uuid usuario_id FK
        timestamptz inicio_anterior
        timestamptz inicio_nuevo
        text estado_anterior
        text estado_nuevo
    }
    SOLICITUDES_CAMBIO_PROFESIONAL {
        uuid id PK
        uuid usuario_id FK
        text motivo
        text estado
        uuid revisado_por FK
    }
    BONOS_CITA {
        uuid id PK
        uuid cita_id FK
        uuid usuario_id FK
        int valor_cop
        text motivo
    }
    NOTIFICACIONES {
        bigint id PK
        uuid usuario_id FK
        text tipo
        text mensaje
        timestamptz leida_en
    }
```

## Relaciones y reglas

- `PERFILES.id` referencia una cuenta Auth. El rol inicial es `usuario`; un administrador autorizado puede promover perfiles existentes.
- `PERFILES.profesional_asignado_id` vincula cada paciente con su profesional. La vista `profesionales_publicos` solo expone el nombre y el ID de profesionales activos.
- `CITAS` vincula paciente, profesional y servicio. Solo se muestran los espacios configurados por el administrador para el profesional asignado. PostgreSQL calcula duración y aporte, evita cruces y aplica reglas de horario.
- `CONFIGURACION_APORTES` comienza en $5.000 COP para estudiante con correo institucional confirmado y $12.000 COP para otros usuarios. No valida matrícula; eso requeriría integración institucional.
- Un paciente puede cancelar o reprogramar con al menos 24 horas. Luego de registrar una inasistencia, debe esperar ocho días para solicitar otra cita.
- `PAGOS` permite nuevos envíos cuando un pago fue rechazado, pero solo uno puede estar en revisión o aprobado por cita. El monto lo calcula la base a partir de la cita.
- Un administrador que cancela una cita con pago aprobado crea un bono por el monto aprobado.
- Los documentos de remisión y los comprobantes usan buckets privados de Storage; no se guardan URLs públicas.
- `HISTORIAL_PAGOS` y `HISTORIAL_CITAS` son auditorías escritas por triggers. Las notificaciones se almacenan en `NOTIFICACIONES`.
- RLS limita perfiles privados a su dueño y administración; profesionales solo ven las citas asignadas y no obtienen acceso a pagos o documentos.
