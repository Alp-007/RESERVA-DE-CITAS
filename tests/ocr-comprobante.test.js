import test from 'node:test'
import assert from 'node:assert/strict'
import { extraerDatosComprobante } from '../src/lib/ocrComprobante.js'

test('extrae monto, referencia y fecha de un recibo en español', () => {
  const datos = extraerDatosComprobante(
    'Nequi\nValor de la transferencia: $ 50.000\nReferencia: 1234567890\nFecha: 10/10/2026',
    84,
  )
  assert.equal(datos.montoCop, 50000)
  assert.equal(datos.referencia, '1234567890')
  assert.equal(datos.fecha, '2026-10-10')
  assert.equal(datos.confianza, 0.84)
})

test('normaliza formatos de miles y centavos', () => {
  assert.equal(extraerDatosComprobante('Total: $ 80,000.00').montoCop, 80000)
  assert.equal(extraerDatosComprobante('Monto: COP 80.000,00').montoCop, 80000)
})

test('deja en blanco los campos que no puede reconocer y limita la confianza', () => {
  const datos = extraerDatosComprobante('Comprobante borroso sin importe', 150)
  assert.equal(datos.montoCop, null)
  assert.equal(datos.referencia, null)
  assert.equal(datos.fecha, null)
  assert.equal(datos.confianza, 1)
})
