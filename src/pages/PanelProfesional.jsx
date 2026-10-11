import { useEffect, useState } from 'react'
import { etiquetaEstado, formatoFecha } from '../lib/formato'

export default function PanelProfesional({ supabase, usuario }) {
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let activo = true
    supabase.from('citas')
      .select('id,inicio,fin,motivo,estado,servicios(nombre),cliente:perfiles!citas_usuario_id_fkey(nombre_completo)')
      .eq('profesional_id', usuario.id).order('inicio', { ascending: true })
      .then(({ data, error: consultaError }) => {
        if (!activo) return
        if (consultaError) setError(consultaError.message)
        else { setCitas(data || []); setError('') }
        setCargando(false)
      })
    return () => { activo = false }
  }, [supabase, usuario.id, revision])

  async function marcarCompletada(citaId) {
    setError('')
    const { error: updateError } = await supabase.from('citas').update({ estado: 'completada' })
      .eq('id', citaId).eq('estado', 'confirmada')
    if (updateError) setError(updateError.message)
    else { setCargando(true); setRevision((value) => value + 1) }
  }

  return <main className="panel-contenedor">
    <div className="panel-titulo"><div><span className="etiqueta">PANEL PROFESIONAL</span><h1>Agenda asignada</h1><p>Consulta tus citas confirmadas y registra la atención realizada.</p></div><button className="boton-secundario" onClick={() => { setCargando(true); setRevision((value) => value + 1) }} disabled={cargando}>Actualizar</button></div>
    {error && <p className="alerta alerta-error" role="alert">{error}</p>}
    {cargando ? <p>Cargando agenda…</p> : citas.length === 0 ? <p className="vacio">No tienes citas asignadas por el momento.</p> : <div className="lista-tarjetas">{citas.map((cita) => <article className="cita-tarjeta" key={cita.id}>
      <div className="cita-cabecera"><div><h3>{cita.cliente?.nombre_completo || 'Usuario'}</h3><p>{formatoFecha(cita.inicio)} · {cita.servicios?.nombre}</p></div><span className={`estado estado-${cita.estado}`}>{etiquetaEstado(cita.estado)}</span></div>
      <p className="cita-motivo">Motivo: {cita.motivo}</p>
      {cita.estado === 'confirmada' && <button className="boton-principal" onClick={() => marcarCompletada(cita.id)}>Marcar atención completada</button>}
    </article>)}</div>}
  </main>
}
