export const TIPOS_COMPROBANTE = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

export const MAXIMO_COMPROBANTE_BYTES = 8 * 1024 * 1024

export function validarArchivoComprobante(archivo) {
  if (!archivo) return 'Selecciona una imagen o PDF del comprobante.'
  if (archivo.size > MAXIMO_COMPROBANTE_BYTES) return 'El comprobante debe pesar máximo 8 MB.'
  if (!TIPOS_COMPROBANTE.includes(archivo.type)) return 'Formato no permitido. Usa JPG, PNG, WEBP o PDF.'
  return null
}

export function compararMontosComprobante(leido, esperado) {
  if (leido === null || leido === undefined || esperado === null || esperado === undefined) return 'sin_dato'
  return Number(leido) === Number(esperado) ? 'coincide' : 'no_coincide'
}
