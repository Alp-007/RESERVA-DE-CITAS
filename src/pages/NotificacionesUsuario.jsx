import { useEffect, useState } from 'react'
import { formatoFecha } from '../lib/formato'

export default function NotificacionesUsuario({ supabase, usuario }) {
  const [notificaciones, setNotificaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    supabase.from('notificaciones').select('id,tipo,mensaje,leida_en,creado_en').eq('usuario_id', usuario.id).order('creado_en', { ascending: false }).limit(50)
      .then(({ data, error: consultaError }) => {
        if (!activo) return
        if (consultaError) setError(consultaError.message)
        else setNotificaciones(data || [])
        setCargando(false)
      })
    return () => { activo = false }
  }, [supabase, usuario.id])

  async function marcarLeida(id) {
    const { error: updateError } = await supabase.rpc('marcar_notificacion_leida', { p_notificacion: id })
    if (updateError) setError(updateError.message)
    else setNotificaciones((items) => items.map((item) => item.id === id ? { ...item, leida_en: 'leida' } : item))
  }

  return <main className="panel-contenedor">
    <div className="panel-titulo"><div><span className="etiqueta">ESPACIO PERSONAL</span><h1>Notificaciones</h1><p>Actualizaciones sobre tus citas y aportes.</p></div></div>
    {error && <p className="alerta alerta-error" role="alert">{error}</p>}
    {cargando ? <p>Cargando notificaciones…</p> : notificaciones.length === 0 ? <p className="vacio">Aún no tienes notificaciones.</p> : <div className="lista-tarjetas">{notificaciones.map((n) => <article className={`notificacion-tarjeta ${n.leida_en ? 'notificacion-leida' : ''}`} key={n.id}><div><strong>{n.mensaje}</strong><p>{formatoFecha(n.creado_en)}</p></div>{!n.leida_en && <button className="boton-texto" onClick={() => marcarLeida(n.id)}>Marcar como leída</button>}</article>)}</div>}
    <p className="ayuda">Los avisos visibles aquí se guardan dentro de la cuenta. El envío por correo o SMS requiere configurar un proveedor externo.</p>
  </main>
}
