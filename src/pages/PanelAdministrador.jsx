import { useEffect, useState } from 'react'
import { etiquetaEstado, formatoCOP, formatoFecha } from '../lib/formato'

const ROLES = [
  { value: 'usuario', label: 'Usuario' },
  { value: 'profesional', label: 'Profesional' },
  { value: 'administrador', label: 'Administrador' },
]

export default function PanelAdministrador({ supabase, usuario }) {
  const [perfiles, setPerfiles] = useState([])
  const [servicios, setServicios] = useState([])
  const [citas, setCitas] = useState([])
  const [pagos, setPagos] = useState([])
  const [historial, setHistorial] = useState([])
  const [precios, setPrecios] = useState({})
  const [notas, setNotas] = useState({})
  const [links, setLinks] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let activo = true
    Promise.all([
      supabase.from('perfiles').select('id,nombre_completo,tipo_usuario,rol,creado_en').order('nombre_completo'),
      supabase.from('servicios').select('id,nombre,descripcion,duracion_minutos,precio_cop,activo').order('nombre'),
      supabase.from('citas').select('id,inicio,fin,motivo,estado,valor_cop,profesional_id,usuario:perfiles!citas_usuario_id_fkey(nombre_completo),profesional:perfiles!citas_profesional_id_fkey(nombre_completo),servicios(nombre)').order('inicio', { ascending: false }),
      supabase.from('pagos').select('id,cita_id,usuario_id,monto_cop,estado,archivo_path,ocr_texto,ocr_referencia,ocr_monto_cop,ocr_fecha,ocr_confianza,nota_revision,creado_en,cita:citas(id,inicio,motivo,usuario:perfiles!citas_usuario_id_fkey(nombre_completo),servicios(nombre))').order('creado_en', { ascending: false }),
      supabase.from('historial_pagos').select('id,pago_id,estado_anterior,estado_nuevo,actor_id,nota,ocurrido_en').order('ocurrido_en', { ascending: false }).limit(30),
    ]).then(([perfilesR, serviciosR, citasR, pagosR, historialR]) => {
      if (!activo) return
      const failed = [perfilesR, serviciosR, citasR, pagosR, historialR].find((item) => item.error)
      if (failed) setError(failed.error.message)
      setPerfiles(perfilesR.data || [])
      setServicios(serviciosR.data || [])
      setCitas(citasR.data || [])
      setPagos(pagosR.data || [])
      setHistorial(historialR.data || [])
      setPrecios(Object.fromEntries((serviciosR.data || []).map((servicio) => [servicio.id, servicio.precio_cop])))
      setCargando(false)
    })
    return () => { activo = false }
  }, [supabase, revision])

  function recargar() {
    setCargando(true)
    setError('')
    setRevision((value) => value + 1)
  }

  async function cambiarRol(perfil, rol) {
    setError(''); setMensaje('')
    const { error: updateError } = await supabase.from('perfiles').update({ rol }).eq('id', perfil.id)
    if (updateError) setError(updateError.message)
    else { setMensaje(`Rol actualizado para ${perfil.nombre_completo}.`); recargar() }
  }

  async function guardarPrecio(servicio) {
    const precio = Number(precios[servicio.id])
    if (!Number.isInteger(precio) || precio < 0) return setError('El precio debe ser un número entero de pesos mayor o igual a cero.')
    setError(''); setMensaje('')
    const { error: updateError } = await supabase.from('servicios').update({ precio_cop: precio }).eq('id', servicio.id)
    if (updateError) setError(updateError.message)
    else { setMensaje(`Precio de ${servicio.nombre} guardado.`); recargar() }
  }

  async function asignarProfesional(citaId, profesionalId) {
    setError(''); setMensaje('')
    const { error: updateError } = await supabase.from('citas').update({ profesional_id: profesionalId || null }).eq('id', citaId)
    if (updateError) setError(updateError.message)
    else { setMensaje('Asignación actualizada.'); recargar() }
  }

  async function actualizarCita(citaId, estado) {
    setError(''); setMensaje('')
    const { error: updateError } = await supabase.from('citas').update({ estado }).eq('id', citaId)
    if (updateError) setError(updateError.message)
    else { setMensaje(`Cita marcada como ${etiquetaEstado(estado).toLowerCase()}.`); recargar() }
  }

  async function abrirComprobante(pago) {
    const { data, error: linkError } = await supabase.storage.from('comprobantes-pago').createSignedUrl(pago.archivo_path, 300)
    if (linkError) setError(linkError.message)
    else setLinks((actual) => ({ ...actual, [pago.id]: data.signedUrl }))
  }

  async function revisarPago(pago, estado) {
    setError(''); setMensaje('')
    const { error: updateError } = await supabase.from('pagos').update({
      estado,
      revisado_por: usuario.id,
      nota_revision: notas[pago.id]?.trim() || null,
    }).eq('id', pago.id)
    if (updateError) setError(updateError.message)
    else { setMensaje(`Pago ${estado === 'aprobado' ? 'aprobado' : 'rechazado'}; la decisión quedó registrada.`); recargar() }
  }

  const profesionales = perfiles.filter((perfil) => perfil.rol === 'profesional')

  return <main className="panel-contenedor">
    <div className="panel-titulo"><div><span className="etiqueta">GESTIÓN DEL SERVICIO</span><h1>Panel administrador</h1><p>Administra usuarios, agenda, precios y comprobantes de pago.</p></div><button className="boton-secundario" onClick={recargar} disabled={cargando}>Actualizar</button></div>
    {mensaje && <p className="alerta alerta-exito" role="status">{mensaje}</p>}
    {error && <p className="alerta alerta-error" role="alert">{error}</p>}
    {cargando && <p>Cargando información…</p>}

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Usuarios y roles</h2><p>Solo un administrador puede cambiar roles.</p></div><span className="contador">{perfiles.length} usuarios</span></div>
      {perfiles.length === 0 ? <p className="vacio">No hay perfiles para mostrar.</p> : <div className="tabla-contenedor"><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Rol</th></tr></thead><tbody>{perfiles.map((perfil) => <tr key={perfil.id}><td>{perfil.nombre_completo}</td><td>{perfil.tipo_usuario}</td><td><select aria-label={`Rol de ${perfil.nombre_completo}`} value={perfil.rol} onChange={(e) => cambiarRol(perfil, e.target.value)}><option value={perfil.rol} hidden>{ROLES.find((rol) => rol.value === perfil.rol)?.label || perfil.rol}</option>{ROLES.filter((rol) => rol.value !== perfil.rol).map((rol) => <option key={rol.value} value={rol.value}>{rol.label}</option>)}</select></td></tr>)}</tbody></table></div>}
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Servicios y precios</h2><p>El precio queda en cero hasta que lo defina el equipo.</p></div></div>
      <div className="lista-tarjetas">{servicios.map((servicio) => <div className="servicio-admin" key={servicio.id}><div><strong>{servicio.nombre}</strong><p>{servicio.duracion_minutos} minutos · {servicio.descripcion}</p></div><label>Precio COP<input type="number" min="0" step="1000" value={precios[servicio.id] ?? 0} onChange={(e) => setPrecios((actual) => ({ ...actual, [servicio.id]: e.target.value }))} /></label><button className="boton-secundario" onClick={() => guardarPrecio(servicio)}>Guardar</button></div>)}</div>
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Agenda y asignaciones</h2><p>Asigna profesionales y actualiza el estado de cada cita.</p></div><span className="contador">{citas.length} citas</span></div>
      {citas.length === 0 ? <p className="vacio">Aún no hay solicitudes de cita.</p> : <div className="lista-tarjetas">{citas.map((cita) => <article className="cita-tarjeta" key={cita.id}>
        <div className="cita-cabecera"><div><h3>{cita.usuario?.nombre_completo || 'Usuario'}</h3><p>{formatoFecha(cita.inicio)} · {cita.servicios?.nombre}</p></div><span className={`estado estado-${cita.estado}`}>{etiquetaEstado(cita.estado)}</span></div>
        <p className="cita-motivo">{cita.motivo} · {formatoCOP(cita.valor_cop)}</p>
        <div className="acciones-admin"><label>Profesional<select value={cita.profesional_id || ''} onChange={(e) => asignarProfesional(cita.id, e.target.value)}><option value="">Sin asignar</option>{profesionales.map((profesional) => <option key={profesional.id} value={profesional.id}>{profesional.nombre_completo}</option>)}</select></label>
          {['pendiente','confirmada'].includes(cita.estado) && <button className="boton-texto peligro" onClick={() => actualizarCita(cita.id, 'cancelada')}>Cancelar</button>}
          {cita.estado === 'confirmada' && <button className="boton-secundario" onClick={() => actualizarCita(cita.id, 'completada')}>Marcar completada</button>}
        </div>
      </article>)}</div>}
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Revisión de pagos Nequi</h2><p>El OCR ayuda a leer el recibo; verifica el soporte antes de aprobar.</p></div><span className="contador">{pagos.filter((p) => p.estado === 'en_revision').length} pendientes</span></div>
      {pagos.length === 0 ? <p className="vacio">Todavía no hay comprobantes recibidos.</p> : <div className="lista-tarjetas">{pagos.map((pago) => <article className="cita-tarjeta" key={pago.id}>
        <div className="cita-cabecera"><div><h3>{pago.cita?.usuario?.nombre_completo || 'Usuario'}</h3><p>{pago.cita?.servicios?.nombre} · {pago.cita?.inicio ? formatoFecha(pago.cita.inicio) : ''}</p></div><span className={`estado estado-${pago.estado}`}>{etiquetaEstado(pago.estado)}</span></div>
        <p className="pago-resumen">Valor esperado: <strong>{formatoCOP(pago.monto_cop)}</strong> · recibido {formatoFecha(pago.creado_en)}</p>
        <div className="ocr-admin"><span>OCR: {pago.ocr_monto_cop ? formatoCOP(pago.ocr_monto_cop) : 'valor no detectado'}</span><span>Comparación: {pago.ocr_monto_cop === null || pago.ocr_monto_cop === undefined ? 'sin dato' : Number(pago.ocr_monto_cop) === Number(pago.monto_cop) ? 'coincide' : 'no coincide'}</span><span>Ref.: {pago.ocr_referencia || 'no detectada'}</span><span>Fecha: {pago.ocr_fecha || 'no detectada'}</span><span>Confianza OCR: {pago.ocr_confianza ? `${Math.round(pago.ocr_confianza * 100)}%` : '—'}</span></div>
        <div className="acciones-admin"><button className="boton-secundario" onClick={() => abrirComprobante(pago)}>Ver comprobante privado</button>{links[pago.id] && <a className="enlace-comprobante" href={links[pago.id]} target="_blank" rel="noreferrer">Abrir / descargar</a>}</div>
        {pago.estado === 'en_revision' && <><label className="nota-revision">Nota de revisión<textarea rows="2" value={notas[pago.id] ?? ''} onChange={(e) => setNotas((actual) => ({ ...actual, [pago.id]: e.target.value }))} placeholder="Ej. comprobante no legible o referencia no coincide" /></label><div className="acciones-admin"><button className="boton-principal" onClick={() => revisarPago(pago, 'aprobado')}>Aprobar pago y confirmar cita</button><button className="boton-texto peligro" onClick={() => revisarPago(pago, 'rechazado')}>Rechazar</button></div></>}
        {pago.nota_revision && <p className="ayuda">Nota: {pago.nota_revision}</p>}
      </article>)}</div>}
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Historial de estados de pago</h2><p>Últimos 30 eventos registrados por la base de datos.</p></div></div>
      {historial.length === 0 ? <p className="vacio">Todavía no hay cambios de estado registrados.</p> : <div className="tabla-contenedor"><table><thead><tr><th>Fecha</th><th>Pago</th><th>Cambio</th><th>Actor</th><th>Nota</th></tr></thead><tbody>{historial.map((evento) => <tr key={evento.id}><td>{formatoFecha(evento.ocurrido_en)}</td><td>{evento.pago_id.slice(0, 8)}…</td><td>{evento.estado_anterior ? `${etiquetaEstado(evento.estado_anterior)} → ` : ''}{etiquetaEstado(evento.estado_nuevo)}</td><td>{evento.actor_id ? `${evento.actor_id.slice(0, 8)}…` : 'Sistema'}</td><td>{evento.nota || '—'}</td></tr>)}</tbody></table></div>}
    </section>
  </main>
}
