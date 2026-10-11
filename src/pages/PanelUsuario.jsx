import { useEffect, useState } from 'react'
import { reconocerComprobante } from '../lib/ocrComprobante'
import { etiquetaEstado, formatoCOP, formatoFecha } from '../lib/formato'
import { compararMontosComprobante, TIPOS_COMPROBANTE, validarArchivoComprobante } from '../lib/pagos'

export default function PanelUsuario({ supabase, usuario }) {
  const [servicios, setServicios] = useState([])
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [archivoPorCita, setArchivoPorCita] = useState({})
  const [ocrPorCita, setOcrPorCita] = useState({})
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let activo = true
    Promise.all([
      supabase.from('servicios').select('id,nombre,descripcion,duracion_minutos,precio_cop').eq('activo', true).order('nombre'),
      supabase.from('citas')
        .select('id,inicio,fin,motivo,estado,servicio_id,valor_cop,servicios(nombre,duracion_minutos,precio_cop),pagos(id,estado,monto_cop,archivo_path,creado_en)')
        .eq('usuario_id', usuario.id).order('inicio', { ascending: false }),
    ]).then(([serviciosResp, citasResp]) => {
      if (!activo) return
      if (serviciosResp.error) setError(serviciosResp.error.message)
      else setServicios(serviciosResp.data || [])
      if (citasResp.error) setError(citasResp.error.message)
      else setCitas(citasResp.data || [])
      setCargando(false)
    })
    return () => { activo = false }
  }, [supabase, usuario.id, revision])

  async function solicitarCita(evento) {
    evento.preventDefault()
    setMensaje('')
    setError('')
    setEnviando(true)
    const formulario = evento.currentTarget
    const fechaLocal = formulario.inicio.value
    try {
      if (!fechaLocal) throw new Error('Selecciona fecha y hora.')
      const { error: insertError } = await supabase.from('citas').insert({
        usuario_id: usuario.id,
        servicio_id: formulario.servicio_id.value,
        inicio: new Date(fechaLocal).toISOString(),
        motivo: formulario.motivo.value.trim(),
      })
      if (insertError) throw insertError
      formulario.reset()
      setMensaje('Solicitud creada. El equipo revisará la disponibilidad y te indicará cómo continuar con el pago.')
      setCargando(true)
      setRevision((value) => value + 1)
    } catch (err) {
      setError(err.message || 'No fue posible solicitar la cita.')
    } finally {
      setEnviando(false)
    }
  }

  async function cancelarCita(id) {
    setMensaje('')
    setError('')
    const { error: cancelError } = await supabase.rpc('cancelar_cita', { cita: id })
    if (cancelError) setError(cancelError.message)
    else {
      setMensaje('La solicitud de cita fue cancelada.')
      setCargando(true)
      setRevision((value) => value + 1)
    }
  }

  async function analizarComprobante(citaId, archivo) {
    if (!archivo || archivo.type === 'application/pdf') return
    setOcrPorCita((actual) => ({ ...actual, [citaId]: { estado: 'Analizando imagen en este navegador…' } }))
    try {
      const resultado = await reconocerComprobante(archivo, (progreso) => {
        setOcrPorCita((actual) => ({ ...actual, [citaId]: { ...actual[citaId], estado: `Reconociendo texto: ${progreso}%` } }))
      })
      setOcrPorCita((actual) => ({ ...actual, [citaId]: { estado: 'Listo; revisa los datos reconocidos.', resultado } }))
    } catch {
      setOcrPorCita((actual) => ({ ...actual, [citaId]: { estado: 'No se pudo reconocer automáticamente. Puedes enviar el comprobante para revisión manual.' } }))
    }
  }

  async function enviarComprobante(cita) {
    const archivo = archivoPorCita[cita.id]
    const errorArchivo = validarArchivoComprobante(archivo)
    if (errorArchivo) return setError(errorArchivo)
    const precio = Number(cita.valor_cop || 0)
    if (precio <= 0) return setError('El administrador todavía debe configurar el precio del servicio.')

    setError('')
    setMensaje('')
    setEnviando(true)
    let ruta
    try {
      const extension = archivo.name.split('.').pop()?.toLowerCase() || 'bin'
      ruta = `${usuario.id}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('comprobantes-pago').upload(ruta, archivo, {
        upsert: false,
        contentType: archivo.type,
      })
      if (uploadError) throw uploadError

      const reconocido = ocrPorCita[cita.id]?.resultado
      const { error: pagoError } = await supabase.from('pagos').insert({
        cita_id: cita.id,
        usuario_id: usuario.id,
        monto_cop: precio,
        estado: 'en_revision',
        archivo_path: ruta,
        ocr_texto: reconocido?.texto || null,
        ocr_referencia: reconocido?.referencia || null,
        ocr_monto_cop: reconocido?.montoCop || null,
        ocr_fecha: reconocido?.fecha || null,
        ocr_confianza: reconocido?.confianza || null,
      })
      if (pagoError) throw pagoError

      setMensaje('Comprobante enviado al administrador para revisión. La lectura automática es orientativa.')
      setArchivoPorCita((actual) => ({ ...actual, [cita.id]: null }))
      setOcrPorCita((actual) => ({ ...actual, [cita.id]: null }))
      setCargando(true)
      setRevision((value) => value + 1)
    } catch (err) {
      setError(err.message || 'No se pudo enviar el comprobante.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="panel-contenedor">
      <div className="panel-titulo">
        <div><span className="etiqueta">ESPACIO PERSONAL</span><h1>Mis citas</h1><p>Solicita atención y consulta el estado de tus citas y pagos.</p></div>
        <button className="boton-secundario" onClick={() => { setCargando(true); setError(''); setRevision((value) => value + 1) }} disabled={cargando}>Actualizar</button>
      </div>
      {mensaje && <p className="alerta alerta-exito" role="status">{mensaje}</p>}
      {error && <p className="alerta alerta-error" role="alert">{error}</p>}

      <section className="panel-tarjeta">
        <h2>Solicitar una cita</h2>
        <form className="formulario-cita" onSubmit={solicitarCita}>
          <label>Servicio
            <select name="servicio_id" required defaultValue="">
              <option value="" disabled>Selecciona un servicio</option>
              {servicios.map((servicio) => <option key={servicio.id} value={servicio.id}>{servicio.nombre} · {servicio.duracion_minutos} min · {servicio.precio_cop > 0 ? formatoCOP(servicio.precio_cop) : 'Precio por configurar'}</option>)}
            </select>
          </label>
          <label>Fecha y hora <input type="datetime-local" name="inicio" required /></label>
          <label className="campo-ancho">Motivo de consulta
            <textarea name="motivo" minLength={5} maxLength={1000} rows={3} placeholder="Cuéntanos brevemente qué tipo de acompañamiento buscas" required />
          </label>
          <p className="ayuda campo-ancho">Las citas deben ser futuras, de lunes a sábado entre 8:00 a. m. y 6:00 p. m. (hora de Bogotá).</p>
          <button className="boton-principal" type="submit" disabled={enviando || !servicios.length}>{enviando ? 'Enviando…' : 'Solicitar cita'}</button>
        </form>
      </section>

      <section className="panel-seccion">
        <h2>Solicitudes y citas</h2>
        {cargando ? <p>Cargando…</p> : citas.length === 0 ? <p className="vacio">Aún no tienes citas. Puedes solicitar una arriba.</p> : (
          <div className="lista-tarjetas">
            {citas.map((cita) => {
              const pagos = [...(cita.pagos || [])].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
              const pagoActivo = pagos.find((p) => ['en_revision', 'aprobado'].includes(p.estado))
              const ultimoPago = pagos[0]
              return <article className="cita-tarjeta" key={cita.id}>
                <div className="cita-cabecera"><div><h3>{cita.servicios?.nombre || 'Consulta psicológica'}</h3><p>{formatoFecha(cita.inicio)}</p></div><span className={`estado estado-${cita.estado}`}>{etiquetaEstado(cita.estado)}</span></div>
                <p className="cita-motivo">{cita.motivo}</p>
                {ultimoPago && <p className="pago-resumen">Pago: <strong>{etiquetaEstado(ultimoPago.estado)}</strong>{ultimoPago.monto_cop ? ` · ${formatoCOP(ultimoPago.monto_cop)}` : ''}</p>}
                {cita.estado === 'pendiente' && <button className="boton-texto peligro" onClick={() => cancelarCita(cita.id)}>Cancelar solicitud</button>}
                {cita.estado !== 'cancelada' && !pagoActivo && Number(cita.valor_cop) > 0 && <details className="pago-formulario">
                  <summary>{ultimoPago?.estado === 'rechazado' ? 'Volver a enviar comprobante' : 'Pagar con Nequi'}</summary>
                  <div className="pago-contenido">
                    <p>Valor: <strong>{formatoCOP(cita.valor_cop)}</strong>. Número de Nequi: <strong>{import.meta.env.VITE_NEQUI_DESTINO || 'pendiente de configurar'}</strong>.</p>
                    <p className="ayuda">Transfiere en Nequi y adjunta aquí el comprobante. La validación definitiva la realiza un administrador.</p>
                    <label>Comprobante (JPG, PNG, WEBP o PDF, máx. 8 MB)
                      <input type="file" accept={TIPOS_COMPROBANTE.join(',')} onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setArchivoPorCita((actual) => ({ ...actual, [cita.id]: file }))
                        setOcrPorCita((actual) => ({ ...actual, [cita.id]: null }))
                        if (file?.type.startsWith('image/')) analizarComprobante(cita.id, file)
                      }} />
                    </label>
                    {ocrPorCita[cita.id]?.estado && <div className="ocr-resumen"><strong>Reconocimiento del comprobante</strong><p>{ocrPorCita[cita.id].estado}</p>{ocrPorCita[cita.id].resultado && <dl><dt>Valor leído</dt><dd>{ocrPorCita[cita.id].resultado.montoCop ? formatoCOP(ocrPorCita[cita.id].resultado.montoCop) : 'No detectado'}</dd><dt>Referencia</dt><dd>{ocrPorCita[cita.id].resultado.referencia || 'No detectada'}</dd><dt>Fecha</dt><dd>{ocrPorCita[cita.id].resultado.fecha || 'No detectada'}</dd><dt>Coincide con el valor</dt><dd>{compararMontosComprobante(ocrPorCita[cita.id].resultado.montoCop, cita.valor_cop) === 'coincide' ? 'Sí' : 'Requiere revisión manual'}</dd></dl>}</div>}
                    <button className="boton-principal" disabled={enviando || !archivoPorCita[cita.id]} onClick={() => enviarComprobante(cita)}>{enviando ? 'Enviando…' : 'Enviar comprobante'}</button>
                  </div>
                </details>}
                {cita.estado !== 'cancelada' && Number(cita.valor_cop) === 0 && <p className="ayuda">El pago aparecerá cuando el administrador configure el precio del servicio.</p>}
              </article>
            })}
          </div>
        )}
      </section>
    </main>
  )
}
