import { useEffect, useState } from 'react'
import { reconocerComprobante } from '../lib/ocrComprobante'
import { etiquetaEstado, FECHA_HOY_BOGOTA, formatoCOP, formatoFecha } from '../lib/formato'
import { compararMontosComprobante, TIPOS_COMPROBANTE, validarArchivoComprobante } from '../lib/pagos'

export default function PanelUsuario({ supabase, usuario, perfil, vista = 'mis-citas' }) {
  const [servicios, setServicios] = useState([])
  const [citas, setCitas] = useState([])
  const [profesionales, setProfesionales] = useState([])
  const [bonos, setBonos] = useState([])
  const [aporte, setAporte] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [archivoPorCita, setArchivoPorCita] = useState({})
  const [ocrPorCita, setOcrPorCita] = useState({})
  const [referenciaPorCita, setReferenciaPorCita] = useState({})
  const [servicioElegido, setServicioElegido] = useState('')
  const [fechaElegida, setFechaElegida] = useState('')
  const [horariosDisponibles, setHorariosDisponibles] = useState([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [fechaCambio, setFechaCambio] = useState({})
  const [horariosCambio, setHorariosCambio] = useState({})
  const [revision, setRevision] = useState(0)
  const [ahoraMs] = useState(() => Date.now())

  useEffect(() => {
    let activo = true
    Promise.all([
      supabase.from('servicios').select('id,nombre,descripcion,duracion_minutos,precio_cop').eq('activo', true).order('nombre'),
      supabase.from('citas')
        .select('id,inicio,fin,motivo,estado,servicio_id,profesional_id,valor_cop,servicios(nombre,duracion_minutos,precio_cop),pagos(id,estado,monto_cop,archivo_path,creado_en)')
        .eq('usuario_id', usuario.id).order('inicio', { ascending: false }),
      supabase.from('bonos_cita').select('id,valor_cop,motivo,creado_en').eq('usuario_id', usuario.id).order('creado_en', { ascending: false }),
      supabase.from('profesionales_publicos').select('id,nombre_completo'),
      supabase.from('configuracion_aportes').select('aporte_estudiante,aporte_otros').eq('id', true).single(),
    ]).then(([serviciosResp, citasResp, bonosResp, profesionalesResp, aporteResp]) => {
      if (!activo) return
      if (serviciosResp.error) setError(serviciosResp.error.message)
      else setServicios(serviciosResp.data || [])
      if (citasResp.error) setError(citasResp.error.message)
      else setCitas(citasResp.data || [])
      if (bonosResp.error) setError(bonosResp.error.message)
      else setBonos(bonosResp.data || [])
      if (profesionalesResp.error) setError(profesionalesResp.error.message)
      else setProfesionales(profesionalesResp.data || [])
      if (aporteResp.data) setAporte(perfil.tipo_usuario === 'estudiante' && perfil.estudiante_validado ? aporteResp.data.aporte_estudiante : aporteResp.data.aporte_otros)
      setCargando(false)
    })
    return () => { activo = false }
  }, [supabase, usuario.id, revision, perfil.tipo_usuario, perfil.estudiante_validado])

  useEffect(() => {
    if (vista !== 'solicitar-cita' || !servicioElegido || !fechaElegida) return undefined
    let activo = true
    supabase.rpc('obtener_horarios_disponibles', { servicio: servicioElegido, fecha: fechaElegida })
      .then(({ data, error: horariosError }) => {
        if (!activo) return
        if (horariosError) setError(horariosError.message)
        else setHorariosDisponibles(data || [])
      }).finally(() => { if (activo) setCargandoHorarios(false) })
    return () => { activo = false }
  }, [supabase, usuario.id, vista, servicioElegido, fechaElegida])

  async function cargarHorariosCambio(cita, fecha) {
    setFechaCambio((actual) => ({ ...actual, [cita.id]: fecha }))
    if (!fecha) { setHorariosCambio((actual) => ({ ...actual, [cita.id]: [] })); return }
    const { data, error: horariosError } = await supabase.rpc('obtener_horarios_disponibles', { servicio: cita.servicio_id, fecha })
    if (horariosError) setError(horariosError.message)
    else setHorariosCambio((actual) => ({ ...actual, [cita.id]: data || [] }))
  }

  async function reprogramarCita(cita, inicio) {
    if (!inicio) return setError('Selecciona un horario disponible.')
    setError(''); setMensaje('')
    const { error: cambioError } = await supabase.rpc('reprogramar_cita', { cita: cita.id, nuevo_inicio: inicio })
    if (cambioError) setError(cambioError.message)
    else { setMensaje('Cita reprogramada.'); setCargando(true); setRevision((value) => value + 1) }
  }

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
      setServicioElegido('')
      setFechaElegida('')
      setHorariosDisponibles([])
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
      if (resultado.referencia) setReferenciaPorCita((actual) => ({ ...actual, [citaId]: resultado.referencia }))
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
    const reconocido = ocrPorCita[cita.id]?.resultado
    const referencia = referenciaPorCita[cita.id]?.trim() || reconocido?.referencia
    if (!referencia) return setError('Escribe la referencia que aparece en la transferencia de Nequi.')

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
        referencia_transaccion: referencia,
      })
      if (pagoError) throw pagoError

      setMensaje('Comprobante enviado al administrador para revisión. La lectura automática es orientativa.')
      setArchivoPorCita((actual) => ({ ...actual, [cita.id]: null }))
      setOcrPorCita((actual) => ({ ...actual, [cita.id]: null }))
      setReferenciaPorCita((actual) => ({ ...actual, [cita.id]: '' }))
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
        <div><span className="etiqueta">ESPACIO PERSONAL</span><h1>{vista === 'solicitar-cita' ? 'Solicitar una cita' : 'Mis citas'}</h1><p>{vista === 'solicitar-cita' ? 'Cuéntanos qué atención necesitas y elige un horario.' : 'Consulta el estado de tus solicitudes, citas y pagos.'}</p></div>
        <button className="boton-secundario" onClick={() => { setCargando(true); setError(''); setRevision((value) => value + 1) }} disabled={cargando}>Actualizar</button>
      </div>
      {mensaje && <p className="alerta alerta-exito" role="status">{mensaje}</p>}
      {error && <p className="alerta alerta-error" role="alert">{error}</p>}

      {vista === 'solicitar-cita' && <section className="panel-tarjeta">
        <h2>Solicitar una cita</h2>
        {aporte !== null && <p className="monto-aporte">Aporte para tu cuenta: <strong>{formatoCOP(aporte)}</strong>{perfil.tipo_usuario === 'estudiante' && !perfil.estudiante_validado && <small> · Se aplica el valor de usuario externo hasta verificar el correo institucional.</small>}</p>}
        <form className="formulario-cita" onSubmit={solicitarCita}>
          <label>Servicio
            <select name="servicio_id" required value={servicioElegido} onChange={(e) => { setServicioElegido(e.target.value); setHorariosDisponibles([]); setCargandoHorarios(Boolean(fechaElegida && e.target.value)) }}>
              <option value="" disabled>Selecciona un servicio</option>
              {servicios.map((servicio) => <option key={servicio.id} value={servicio.id}>{servicio.nombre} · {servicio.duracion_minutos} min</option>)}
            </select>
          </label>
          <label>Fecha <input type="date" name="fecha" min={FECHA_HOY_BOGOTA} value={fechaElegida} onChange={(e) => { setFechaElegida(e.target.value); setHorariosDisponibles([]); setCargandoHorarios(Boolean(servicioElegido && e.target.value)) }} required /></label>
          <label className="campo-ancho">Horario disponible
            <select name="inicio" required defaultValue="" disabled={!fechaElegida || !servicioElegido || cargandoHorarios || !horariosDisponibles.length}>
              <option value="" disabled>{!fechaElegida || !servicioElegido ? 'Selecciona servicio y fecha' : cargandoHorarios ? 'Buscando horarios…' : horariosDisponibles.length ? 'Selecciona un horario' : 'No hay horarios disponibles'}</option>
              {horariosDisponibles.map((h) => <option key={h.inicio} value={h.inicio}>{new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(h.inicio))}</option>)}
            </select>
          </label>
          <label className="campo-ancho">Motivo de consulta
            <textarea name="motivo" minLength={5} maxLength={1000} rows={3} placeholder="Cuéntanos brevemente qué tipo de acompañamiento buscas" required />
          </label>
          <p className="ayuda campo-ancho">Solo aparecen horarios libres de tu profesional asignado. Si no ves horarios, solicita al administrador que te asigne un profesional o configure su agenda. Las citas son de lunes a sábado, de 8:00 a. m. a 6:00 p. m. (hora de Bogotá).</p>
          <button className="boton-principal" type="submit" disabled={enviando || !servicios.length || !horariosDisponibles.length}>{enviando ? 'Enviando…' : 'Solicitar cita'}</button>
        </form>
      </section>}

      {vista === 'mis-citas' && <section className="panel-seccion">
        <h2>Solicitudes y citas</h2>
        {bonos.length > 0 && <section className="panel-tarjeta"><h2>Bonos disponibles</h2>{bonos.map((bono) => <p key={bono.id}>{formatoCOP(bono.valor_cop)} · {bono.motivo} · {formatoFecha(bono.creado_en)}</p>)}</section>}
        {cargando ? <p>Cargando…</p> : citas.length === 0 ? <p className="vacio">Aún no tienes citas. Puedes solicitar una arriba.</p> : (
          <div className="lista-tarjetas">
            {citas.map((cita) => {
              const pagos = [...(cita.pagos || [])].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
              const pagoActivo = pagos.find((p) => ['en_revision', 'aprobado'].includes(p.estado))
              const ultimoPago = pagos[0]
              return <article className="cita-tarjeta" key={cita.id}>
                <div className="cita-cabecera"><div><h3>{cita.servicios?.nombre || 'Consulta psicológica'}</h3><p>{formatoFecha(cita.inicio)}</p></div><span className={`estado estado-${cita.estado}`}>{etiquetaEstado(cita.estado)}</span></div>
                <p className="cita-motivo">{cita.motivo}</p>
                {cita.profesional_id && <p className="ayuda">Profesional asignado: {profesionales.find((p) => p.id === cita.profesional_id)?.nombre_completo || 'ver agenda'}</p>}
                {ultimoPago && <p className="pago-resumen">Pago: <strong>{etiquetaEstado(ultimoPago.estado)}</strong>{ultimoPago.monto_cop ? ` · ${formatoCOP(ultimoPago.monto_cop)}` : ''}</p>}
                {['pendiente','confirmada'].includes(cita.estado) && new Date(cita.inicio).getTime() >= ahoraMs + 24 * 60 * 60 * 1000 && <button className="boton-texto peligro" onClick={() => cancelarCita(cita.id)}>Cancelar cita</button>}
                {['pendiente','confirmada'].includes(cita.estado) && new Date(cita.inicio).getTime() >= ahoraMs + 24 * 60 * 60 * 1000 && <details className="pago-formulario"><summary>Reprogramar cita</summary><div className="pago-contenido"><label>Nueva fecha<input type="date" min={FECHA_HOY_BOGOTA} value={fechaCambio[cita.id] || ''} onChange={(e) => cargarHorariosCambio(cita, e.target.value)} /></label><label>Nuevo horario<select defaultValue="" id={`horario-${cita.id}`} disabled={!horariosCambio[cita.id]?.length}><option value="" disabled>Selecciona un horario</option>{(horariosCambio[cita.id] || []).map((h) => <option key={h.inicio} value={h.inicio}>{new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(h.inicio))}</option>)}</select></label><button className="boton-secundario" type="button" onClick={() => reprogramarCita(cita, document.getElementById(`horario-${cita.id}`)?.value)}>Guardar cambio</button></div></details>}
                {!['cancelada','no_asistio'].includes(cita.estado) && !pagoActivo && Number(cita.valor_cop) > 0 && <details className="pago-formulario">
                  <summary>{ultimoPago?.estado === 'rechazado' ? 'Volver a enviar comprobante' : 'Pagar con Nequi'}</summary>
                  <div className="pago-contenido">
                    <p>Valor: <strong>{formatoCOP(cita.valor_cop)}</strong>. Número de Nequi: <strong>{import.meta.env.VITE_NEQUI_DESTINO || 'pendiente de configurar'}</strong>.</p>
                    <p className="ayuda">Transfiere en Nequi y adjunta aquí el comprobante. La validación definitiva la realiza un administrador.</p>
                    <label>Referencia de la transferencia<input type="text" maxLength={80} value={referenciaPorCita[cita.id] || ''} onChange={(e) => setReferenciaPorCita((actual) => ({ ...actual, [cita.id]: e.target.value }))} /></label>
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
      </section>}
    </main>
  )
}
