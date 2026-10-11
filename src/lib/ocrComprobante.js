function convertirMonto(valor) {
  const limpio = valor.replace(/[^\d.,]/g, '')
  if (!limpio) return null
  const ultimoSeparador = Math.max(limpio.lastIndexOf('.'), limpio.lastIndexOf(','))
  const decimales = ultimoSeparador >= 0 ? limpio.length - ultimoSeparador - 1 : 0
  const digitos = limpio.replace(/\D/g, '')
  if (!digitos) return null
  const numero = Number(digitos)
  if (!Number.isFinite(numero)) return null
  // COP se compara en pesos enteros; normaliza importes con centavos.
  return Math.round(decimales === 2 ? numero / 100 : numero)
}

export function extraerDatosComprobante(texto, confianza = 0) {
  const contenido = texto.trim()
  const matchMonto = contenido.match(/(?:valor(?:\s+de\s+la\s+transferencia)?|monto|total|cop)\s*[:-]?\s*\$?\s*([\d.,]{4,})/i)
  const matchReferencia = contenido.match(/(?:referencia|ref\.?|transacci[oó]n|aprobaci[oó]n)\s*(?:(?:n[uú]mero|no\.?|#)\s*)?[:#-]?\s*([a-z0-9-]{6,32})/i)
    || contenido.match(/comprobante\s*(?:n[uú]mero|no\.?|#)\s*[:#-]?\s*([a-z0-9-]{6,32})/i)
  const matchFecha = contenido.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/)
  let fecha = null
  if (matchFecha) {
    const [, dia, mes, anio] = matchFecha
    fecha = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  }

  return {
    texto: contenido,
    montoCop: matchMonto ? convertirMonto(matchMonto[1]) : null,
    referencia: matchReferencia?.[1] || null,
    fecha,
    confianza: Math.max(0, Math.min(1, confianza / 100)),
  }
}

export async function reconocerComprobante(archivo, onProgress = () => {}) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa', 1, {
    logger: (evento) => {
      if (evento.status === 'recognizing text') onProgress(Math.round((evento.progress || 0) * 100))
    },
  })

  try {
    const { data } = await worker.recognize(archivo)
    return extraerDatosComprobante(data.text, data.confidence || 0)
  } finally {
    await worker.terminate()
  }
}
