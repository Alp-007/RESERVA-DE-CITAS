import { useEffect, useState } from 'react'
import { etiquetaEstado, formatoFecha } from '../lib/formato'

export default function PanelProfesional({ supabase, usuario }) {
  const [citas, setCitas] = useState([])
  const [horarios, setHorarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [ahoraMs] = useState(() => Date.now())

  useEffect(() => {
    let activo = true
    const channel = supabase.channel(`profesional-citas-${usuario.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas', filter: `profesional_id=eq.${usuario.id}` }, () => setRevision((value) => value + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios_profesionales', filter: `profesional_id=eq.${usuario.id}` }, () => setRevision((value) => value + 1))
      .subscribe()
    const polling = window.setInterval(() => setRevision((value) => value + 1), 30000)
    Promise.all([
      supabase.from('citas').select('id,inicio,fin,estado,servicios(nombre)').eq('profesional_id', usuario.id).order('inicio', { ascending: true }),
      supabase.from('horarios_profesionales').select('id,dia_semana,hora_inicio,hora_fin,activo').eq('profesional_id', usuario.id).eq('activo', true).order('dia_semana').order('hora_inicio'),
    ]).then(([citasR, horariosR]) => {
        if (!activo) return
        if (citasR.error || horariosR.error) setError((citasR.error || horariosR.error).message)
        else { setCitas(citasR.data || []); setHorarios(horariosR.data || []); setError('') }
        setCargando(false)
      })
    return () => { activo = false; window.clearInterval(polling); supabase.removeChannel(channel) }
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
    <section className="panel-seccion"><h2>Mi disponibilidad</h2>{horarios.length ? <div className="horarios-profesional">{horarios.map((horario) => <p key={horario.id}><b>{['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][horario.dia_semana]}</b><span>{horario.hora_inicio.slice(0, 5)}–{horario.hora_fin.slice(0, 5)}</span></p>)}</div> : <p className="vacio">El administrador aún no ha configurado tus horarios.</p>}</section>
    {cargando ? <p>Cargando agenda…</p> : citas.length === 0 ? <p className="vacio">No tienes citas asignadas por el momento.</p> : <div className="lista-tarjetas">{citas.map((cita) => <article className="cita-tarjeta" key={cita.id}>
      <div className="cita-cabecera"><div><h3>{cita.servicios?.nombre || 'Atención psicológica'}</h3><p>{formatoFecha(cita.inicio)}</p></div><span className={`estado estado-${cita.estado}`}>{etiquetaEstado(cita.estado)}</span></div>
      {cita.estado === 'confirmada' && <div className="acciones-admin"><button className="boton-principal" disabled={ahoraMs < new Date(cita.fin).getTime()} onClick={() => registrarResultado(cita.id, 'completada')}>Marcar como atendida</button><button className="boton-texto peligro" disabled={ahoraMs < new Date(cita.inicio).getTime() + 15 * 60 * 1000} onClick={() => registrarResultado(cita.id, 'no_asistio')}>Registrar inasistencia</button></div>}
    </article>)}</div>}
  </main>
}
