import test from 'node:test'
import assert from 'node:assert/strict'
import { compararMontosComprobante, MAXIMO_COMPROBANTE_BYTES, validarArchivoComprobante } from '../src/lib/pagos.js'

test('acepta tipos de comprobante permitidos', () => {
  assert.equal(validarArchivoComprobante({ type: 'image/jpeg', size: 1024 }), null)
  assert.equal(validarArchivoComprobante({ type: 'application/pdf', size: 1024 }), null)
})

test('rechaza comprobante ausente, tipo no permitido o mayor a 8 MB', () => {
  assert.match(validarArchivoComprobante(null), /Selecciona/)
  assert.match(validarArchivoComprobante({ type: 'application/x-msdownload', size: 100 }), /Formato/)
  assert.match(validarArchivoComprobante({ type: 'image/png', size: MAXIMO_COMPROBANTE_BYTES + 1 }), /8 MB/)
})

test('compara el valor OCR con el precio esperado y deja el dato faltante para revisión', () => {
  assert.equal(compararMontosComprobante(50000, 50000), 'coincide')
  assert.equal(compararMontosComprobante(49000, 50000), 'no_coincide')
  assert.equal(compararMontosComprobante(null, 50000), 'sin_dato')
})
