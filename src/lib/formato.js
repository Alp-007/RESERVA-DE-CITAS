export const formatoCOP = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor || 0)

export const formatoFecha = (valor) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(valor))

export const etiquetaEstado = (estado) => ({
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  completada: 'Completada',
  no_asistio: 'No asistió',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
}[estado] || estado)

export const FECHA_HOY_BOGOTA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
