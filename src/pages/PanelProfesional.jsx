import { useEffect, useState } from 'react'
import { etiquetaEstado, formatoFecha } from '../lib/formato'

export default function PanelProfesional({ supabase, usuario }) {
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [ahoraMs] = useState(() => Date.now())

  useEffect(() => {
    let activo = true
    supabase.from('citas')
      .select('id,inicio,fin,estado,servicios(nombre)')
      .eq('profesional_id', usuario.id).order('inicio', { ascending: true })
      .then(({ data, error: consultaError }) => {
        if (!activo) return
        if (consultaError) setError(consultaError.message)
        else { setCitas(data || []); setError('') }
        setCargando(false)
      })
    return () => { activo = false }
  }, [supabase, usuario.id, revision])

  async function registrarResultado(citaId, estado) {
    setError('')
    const { error: updateError } = await supabase.from('citas').update({ estado })
      .eq('id', citaId).eq('estado', 'confirmada')
    if (updateError) setError(updateError.message)
    else { setCargando(true); setRevision((value) => value + 1) }
  }

  return <main className="panel-contenedor">
    <div className="panel-titulo"><div><span className="etiqueta">PANEL PROFESIONAL</span><h1>Agenda asignada</h1><p>Consulta tus citas confirmadas y registra la atención realizada.</p></div><button className="boton-secundario" onClick={() => { setCargando(true); setRevision((value) => value + 1) }} disabled={cargando}>Actualizar</button></div>
    {error && <p className="alerta alerta-error" role="alert">{error}</p>}
    {cargando ? <p>Cargando agenda…</p> : citas.length === 0 ? <p className="vacio">No tienes citas asignadas por el momento.</p> : <div className="lista-tarjetas">{citas.map((cita) => <article className="cita-tarjeta" key={cita.id}>
      <div className="cita-cabecera"><div><h3>{cita.servicios?.nombre || 'Atención psicológica'}</h3><p>{formatoFecha(cita.inicio)}</p></div><span className={`estado estado-${cita.estado}`}>{etiquetaEstado(cita.estado)}</span></div>
      {cita.estado === 'confirmada' && <div className="acciones-admin"><button className="boton-principal" disabled={ahoraMs < new Date(cita.fin).getTime()} onClick={() => registrarResultado(cita.id, 'completada')}>Marcar como atendida</button><button className="boton-texto peligro" disabled={ahoraMs < new Date(cita.inicio).getTime() + 15 * 60 * 1000} onClick={() => registrarResultado(cita.id, 'no_asistio')}>Registrar inasistencia</button></div>}
    </article>)}</div>}
  </main>
}
