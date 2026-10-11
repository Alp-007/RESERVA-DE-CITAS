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
  const [historialCitas, setHistorialCitas] = useState([])
  const [horarios, setHorarios] = useState([])
  const [aportes, setAportes] = useState({ aporte_estudiante: 5000, aporte_otros: 12000 })
  const [solicitudesCambio, setSolicitudesCambio] = useState([])
  const [profesionalPorSolicitud, setProfesionalPorSolicitud] = useState({})
  const [bonos, setBonos] = useState([])
  const [referencias, setReferencias] = useState({})
  const [referenciasPago, setReferenciasPago] = useState({})
  const [horarioNuevo, setHorarioNuevo] = useState({ profesional_id: '', dia_semana: '1', hora_inicio: '08:00', hora_fin: '12:00' })
  const [notas, setNotas] = useState({})
  const [links, setLinks] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [revision, setRevision] = useState(0)
  const [ahoraMs] = useState(() => Date.now())

  useEffect(() => {
    let activo = true
    Promise.all([
      supabase.from('perfiles').select('id,nombre_completo,tipo_usuario,rol,creado_en,tipo_documento,numero_documento,fecha_nacimiento,telefono,direccion,horario_preferido,documento_remision_path,estudiante_validado,activo,profesional_asignado_id').order('nombre_completo'),
      supabase.from('servicios').select('id,nombre,descripcion,duracion_minutos,precio_cop,activo').order('nombre'),
      supabase.from('citas').select('id,usuario_id,inicio,fin,motivo,estado,valor_cop,profesional_id,usuario:perfiles!citas_usuario_id_fkey(nombre_completo),profesional:perfiles!citas_profesional_id_fkey(nombre_completo),servicios(nombre)').order('inicio', { ascending: false }),
      supabase.from('pagos').select('id,cita_id,usuario_id,monto_cop,estado,archivo_path,referencia_transaccion,ocr_texto,ocr_referencia,ocr_monto_cop,ocr_fecha,ocr_confianza,nota_revision,creado_en,cita:citas(id,inicio,motivo,usuario:perfiles!citas_usuario_id_fkey(nombre_completo),servicios(nombre))').order('creado_en', { ascending: false }),
      supabase.from('historial_pagos').select('id,pago_id,estado_anterior,estado_nuevo,actor_id,nota,ocurrido_en').order('ocurrido_en', { ascending: false }).limit(30),
      supabase.from('horarios_profesionales').select('id,profesional_id,dia_semana,hora_inicio,hora_fin,activo,profesional:perfiles!horarios_profesionales_profesional_id_fkey(nombre_completo)').order('dia_semana').order('hora_inicio'),
      supabase.from('configuracion_aportes').select('aporte_estudiante,aporte_otros').eq('id', true).single(),
      supabase.from('solicitudes_cambio_profesional').select('id,usuario_id,motivo,estado,nota_administrativa,creado_en,usuario:perfiles!solicitudes_cambio_profesional_usuario_id_fkey(nombre_completo,profesional_asignado_id)').order('creado_en', { ascending: false }),
      supabase.from('bonos_cita').select('id,cita_id,usuario_id,valor_cop,motivo,creado_en,usuario:perfiles!bonos_cita_usuario_id_fkey(nombre_completo)').order('creado_en', { ascending: false }),
      supabase.from('historial_citas').select('id,cita_id,usuario_id,inicio_anterior,inicio_nuevo,estado_anterior,estado_nuevo,actor_id,ocurrido_en').order('ocurrido_en', { ascending: false }).limit(50),
    ]).then(([perfilesR, serviciosR, citasR, pagosR, historialR, horariosR, aportesR, solicitudesR, bonosR, historialCitasR]) => {
      if (!activo) return
      const failed = [perfilesR, serviciosR, citasR, pagosR, historialR, horariosR, aportesR, solicitudesR, bonosR, historialCitasR].find((item) => item.error)
      if (failed) setError(failed.error.message)
      setPerfiles(perfilesR.data || [])
      setServicios(serviciosR.data || [])
      setCitas(citasR.data || [])
      setPagos(pagosR.data || [])
      setHistorial(historialR.data || [])
      setHorarios(horariosR.data || [])
      if (aportesR.data) setAportes(aportesR.data)
      setSolicitudesCambio(solicitudesR.data || [])
      setBonos(bonosR.data || [])
      setHistorialCitas(historialCitasR.data || [])
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

  async function guardarAportes() {
    const estudiante = Number(aportes.aporte_estudiante)
    const otros = Number(aportes.aporte_otros)
    if (!Number.isInteger(estudiante) || estudiante < 0 || !Number.isInteger(otros) || otros < 0) return setError('Los aportes deben ser valores enteros iguales o mayores a cero.')
    setError(''); setMensaje('')
    const { error: updateError } = await supabase.from('configuracion_aportes').update({ aporte_estudiante: estudiante, aporte_otros: otros }).eq('id', true)
    if (updateError) setError(updateError.message)
    else { setMensaje('Aportes actualizados. El nuevo valor aplica a las próximas solicitudes.'); recargar() }
  }

  async function guardarServicio(evento, servicio) {
    evento.preventDefault(); setError(''); setMensaje('')
    const f = evento.currentTarget
    const duracion = Number(f.duracion.value)
    if (!Number.isInteger(duracion) || duracion < 15 || duracion > 120) return setError('La duración debe estar entre 15 y 120 minutos.')
    const { error: saveError } = await supabase.from('servicios').update({
      nombre: f.nombre.value.trim(), descripcion: f.descripcion.value.trim(), duracion_minutos: duracion, activo: f.activo.checked,
    }).eq('id', servicio.id)
    if (saveError) setError(saveError.message)
    else { setMensaje('Servicio actualizado.'); recargar() }
  }

  async function agregarServicio(evento) {
    evento.preventDefault(); setError(''); setMensaje('')
    const f = evento.currentTarget
    const duracion = Number(f.duracion.value)
    if (!Number.isInteger(duracion) || duracion < 15 || duracion > 120) return setError('La duración debe estar entre 15 y 120 minutos.')
    const { error: addError } = await supabase.from('servicios').insert({
      nombre: f.nombre.value.trim(), descripcion: f.descripcion.value.trim(), duracion_minutos: duracion, activo: true,
    })
    if (addError) setError(addError.message)
    else { f.reset(); setMensaje('Servicio creado.'); recargar() }
  }

  async function asignarProfesional(usuarioId, profesionalId) {
    setError(''); setMensaje('')
    const { error: updateError } = await supabase.rpc('asignar_profesional_usuario', { p_usuario: usuarioId, p_profesional: profesionalId || null })
    if (updateError) setError(updateError.message)
    else { setMensaje('Profesional asignado al usuario.'); recargar() }
  }

  async function cambiarActivo(perfil, activo) {
    const { error: updateError } = await supabase.from('perfiles').update({ activo }).eq('id', perfil.id)
    if (updateError) setError(updateError.message)
    else { setMensaje(`Cuenta ${activo ? 'activada' : 'desactivada'}.`); recargar() }
  }

  async function agregarHorario(evento) {
    evento.preventDefault(); setError(''); setMensaje('')
    const { error: insertError } = await supabase.from('horarios_profesionales').insert({
      profesional_id: horarioNuevo.profesional_id,
      dia_semana: Number(horarioNuevo.dia_semana),
      hora_inicio: horarioNuevo.hora_inicio,
      hora_fin: horarioNuevo.hora_fin,
    })
    if (insertError) setError(insertError.message)
    else { setMensaje('Horario profesional guardado.'); recargar() }
  }

  async function eliminarHorario(id) {
    const { error: deleteError } = await supabase.from('horarios_profesionales').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else recargar()
  }

  async function abrirRemision(perfil) {
    const { data, error: linkError } = await supabase.storage.from('documentos-remision').createSignedUrl(perfil.documento_remision_path, 300)
    if (linkError) setError(linkError.message)
    else setReferencias((actual) => ({ ...actual, [perfil.id]: data.signedUrl }))
  }

  async function resolverCambio(solicitud, estado) {
    const profesionalId = profesionalPorSolicitud[solicitud.id]
    if (estado === 'aprobada' && !profesionalId) return setError('Selecciona el profesional que se asignará al aprobar el cambio.')
    const { error: updateError } = await supabase.rpc('resolver_solicitud_cambio_profesional', {
      p_solicitud: solicitud.id,
      p_estado: estado,
      p_profesional: estado === 'aprobada' ? profesionalId : null,
      p_nota: null,
    })
    if (updateError) setError(updateError.message)
    else { setMensaje(`Solicitud ${estado === 'aprobada' ? 'aprobada y profesional asignado' : 'rechazada'}.`); recargar() }
  }

  async function actualizarCita(citaId, estado) {
    setError(''); setMensaje('')
    const { error: updateError } = estado === 'cancelada'
      ? await supabase.rpc('cancelar_cita_administrador', { cita: citaId })
      : await supabase.from('citas').update({ estado }).eq('id', citaId)
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
      referencia_transaccion: referenciasPago[pago.id]?.trim() || pago.referencia_transaccion || null,
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
      {perfiles.length === 0 ? <p className="vacio">No hay perfiles para mostrar.</p> : <div className="tabla-contenedor"><table><thead><tr><th>Nombre</th><th>Tipo / verificación</th><th>Rol</th><th>Profesional asignado</th><th>Cuenta</th><th>Información</th></tr></thead><tbody>{perfiles.map((perfil) => <tr key={perfil.id}>
        <td>{perfil.nombre_completo}</td><td>{perfil.tipo_usuario}{perfil.tipo_usuario === 'estudiante' && <small className="estado-validacion">{perfil.estudiante_validado ? 'Correo institucional verificado' : 'Correo pendiente de verificar'}</small>}</td>
        <td><select aria-label={`Rol de ${perfil.nombre_completo}`} value={perfil.rol} onChange={(e) => cambiarRol(perfil, e.target.value)}>{ROLES.map((rol) => <option key={rol.value} value={rol.value}>{rol.label}</option>)}</select></td>
        <td>{perfil.rol === 'usuario' ? <select aria-label={`Profesional asignado a ${perfil.nombre_completo}`} value={perfil.profesional_asignado_id || ''} onChange={(e) => asignarProfesional(perfil.id, e.target.value)}><option value="">Sin asignar</option>{profesionales.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}</select> : '—'}</td>
        <td><button className="boton-texto" onClick={() => cambiarActivo(perfil, !perfil.activo)}>{perfil.activo ? 'Desactivar' : 'Activar'}</button></td>
        <td><details><summary>Ver datos</summary><div className="datos-privados"><p>Documento: {perfil.tipo_documento || '—'} {perfil.numero_documento || ''}</p><p>Nacimiento: {perfil.fecha_nacimiento || '—'}</p><p>Teléfono: {perfil.telefono || '—'}</p><p>Dirección: {perfil.direccion || '—'}</p><p>Preferencia: {perfil.horario_preferido || '—'}</p>{perfil.documento_remision_path ? <><button className="boton-texto" onClick={() => abrirRemision(perfil)}>Abrir remisión privada</button>{referencias[perfil.id] && <a className="enlace-comprobante" href={referencias[perfil.id]} target="_blank" rel="noreferrer">Ver documento</a>}</> : <p>Sin documento de remisión.</p>}</div></details></td>
      </tr>)}</tbody></table></div>}
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Aportes económicos</h2><p>Valores definidos en el proyecto: $5.000 COP para estudiantes y $12.000 COP para otros usuarios.</p></div></div>
      <div className="servicio-admin"><label>Aporte estudiante COP<input type="number" min="0" step="500" value={aportes.aporte_estudiante} onChange={(e) => setAportes((actual) => ({ ...actual, aporte_estudiante: e.target.value }))} /></label><label>Aporte otros usuarios COP<input type="number" min="0" step="500" value={aportes.aporte_otros} onChange={(e) => setAportes((actual) => ({ ...actual, aporte_otros: e.target.value }))} /></label><button className="boton-secundario" onClick={guardarAportes}>Guardar valores</button></div>
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Servicios de atención</h2><p>Administra los servicios disponibles, su descripción, duración y estado.</p></div></div>
      <div className="lista-tarjetas">{servicios.map((servicio) => <form className="servicio-admin-edicion" key={servicio.id} onSubmit={(e) => guardarServicio(e, servicio)}><label>Nombre<input name="nombre" defaultValue={servicio.nombre} maxLength="120" required /></label><label>Duración (minutos)<input name="duracion" type="number" min="15" max="120" step="15" defaultValue={servicio.duracion_minutos} required /></label><label className="servicio-admin-descripcion">Descripción<input name="descripcion" defaultValue={servicio.descripcion} maxLength="500" /></label><label className="servicio-admin-activo"><input name="activo" type="checkbox" defaultChecked={servicio.activo} /> Disponible para solicitudes</label><button className="boton-secundario" type="submit">Guardar servicio</button></form>)}</div>
      <form className="servicio-admin-edicion servicio-admin-nuevo" onSubmit={agregarServicio}><h3>Agregar un servicio</h3><label>Nombre<input name="nombre" maxLength="120" required /></label><label>Duración (minutos)<input name="duracion" type="number" min="15" max="120" step="15" defaultValue="45" required /></label><label className="servicio-admin-descripcion">Descripción<input name="descripcion" maxLength="500" /></label><button className="boton-principal" type="submit">Crear servicio</button></form>
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Horarios profesionales</h2><p>La disponibilidad que se configure aquí aparecerá a los pacientes asignados.</p></div></div>
      <form className="formulario-horarios" onSubmit={agregarHorario}><label>Profesional<select required value={horarioNuevo.profesional_id} onChange={(e) => setHorarioNuevo((a) => ({ ...a, profesional_id: e.target.value }))}><option value="">Selecciona</option>{profesionales.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}</select></label><label>Día<select value={horarioNuevo.dia_semana} onChange={(e) => setHorarioNuevo((a) => ({ ...a, dia_semana: e.target.value }))}>{[['1','Lunes'],['2','Martes'],['3','Miércoles'],['4','Jueves'],['5','Viernes'],['6','Sábado']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>Desde<input type="time" min="08:00" max="18:00" value={horarioNuevo.hora_inicio} onChange={(e) => setHorarioNuevo((a) => ({ ...a, hora_inicio: e.target.value }))} /></label><label>Hasta<input type="time" min="08:00" max="18:00" value={horarioNuevo.hora_fin} onChange={(e) => setHorarioNuevo((a) => ({ ...a, hora_fin: e.target.value }))} /></label><button className="boton-secundario" type="submit">Agregar horario</button></form>
      {horarios.length ? <div className="tabla-contenedor"><table><thead><tr><th>Profesional</th><th>Día</th><th>Horario</th><th></th></tr></thead><tbody>{horarios.map((h) => <tr key={h.id}><td>{h.profesional?.nombre_completo}</td><td>{['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][h.dia_semana]}</td><td>{h.hora_inicio.slice(0,5)}–{h.hora_fin.slice(0,5)}</td><td><button className="boton-texto peligro" onClick={() => eliminarHorario(h.id)}>Quitar</button></td></tr>)}</tbody></table></div> : <p className="vacio">Aún no hay horarios configurados.</p>}
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Agenda y seguimiento</h2><p>Revisa citas, inasistencias, pagos y solicitudes de los pacientes.</p></div><span className="contador">{citas.length} citas</span></div>
      {citas.length === 0 ? <p className="vacio">Aún no hay solicitudes de cita.</p> : <div className="lista-tarjetas">{citas.map((cita) => <article className="cita-tarjeta" key={cita.id}>
        <div className="cita-cabecera"><div><h3>{cita.usuario?.nombre_completo || 'Usuario'}</h3><p>{formatoFecha(cita.inicio)} · {cita.servicios?.nombre}</p></div><span className={`estado estado-${cita.estado}`}>{etiquetaEstado(cita.estado)}</span></div>
        <p className="cita-motivo">{cita.motivo} · {formatoCOP(cita.valor_cop)}</p>
        <p className="ayuda">Profesional: {cita.profesional?.nombre_completo || 'Sin asignar'}</p>
        <div className="acciones-admin">
          {['pendiente','confirmada'].includes(cita.estado) && <button className="boton-texto peligro" onClick={() => actualizarCita(cita.id, 'cancelada')}>Cancelar</button>}
          {cita.estado === 'confirmada' && <button className="boton-secundario" disabled={ahoraMs < new Date(cita.fin).getTime()} onClick={() => actualizarCita(cita.id, 'completada')}>Marcar completada</button>}
          {cita.estado === 'confirmada' && ahoraMs >= new Date(cita.inicio).getTime() + 15 * 60 * 1000 && <button className="boton-texto peligro" onClick={() => actualizarCita(cita.id, 'no_asistio')}>Marcar no asistió</button>}
        </div>
      </article>)}</div>}
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Solicitudes de cambio de profesional</h2><p>Al aprobar, cambia la asignación del usuario en la tabla superior.</p></div><span className="contador">{solicitudesCambio.filter((s) => s.estado === 'pendiente').length} pendientes</span></div>
      {solicitudesCambio.length === 0 ? <p className="vacio">No hay solicitudes registradas.</p> : <div className="lista-tarjetas">{solicitudesCambio.map((solicitud) => <article className="cita-tarjeta" key={solicitud.id}><div className="cita-cabecera"><div><h3>{solicitud.usuario?.nombre_completo || 'Usuario'}</h3><p>{formatoFecha(solicitud.creado_en)}</p></div><span className={`estado estado-${solicitud.estado}`}>{etiquetaEstado(solicitud.estado)}</span></div><p>{solicitud.motivo}</p>{solicitud.estado === 'pendiente' && <div className="acciones-admin"><label>Nuevo profesional<select value={profesionalPorSolicitud[solicitud.id] || ''} onChange={(e) => setProfesionalPorSolicitud((actual) => ({ ...actual, [solicitud.id]: e.target.value }))}><option value="">Selecciona profesional</option>{profesionales.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}</select></label><button className="boton-principal" onClick={() => resolverCambio(solicitud, 'aprobada')}>Aprobar y asignar</button><button className="boton-texto peligro" onClick={() => resolverCambio(solicitud, 'rechazada')}>Rechazar</button></div>}</article>)}</div>}
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Revisión de pagos Nequi</h2><p>El OCR ayuda a leer el recibo; verifica el soporte antes de aprobar.</p></div><span className="contador">{pagos.filter((p) => p.estado === 'en_revision').length} pendientes</span></div>
      {pagos.length === 0 ? <p className="vacio">Todavía no hay comprobantes recibidos.</p> : <div className="lista-tarjetas">{pagos.map((pago) => <article className="cita-tarjeta" key={pago.id}>
        <div className="cita-cabecera"><div><h3>{pago.cita?.usuario?.nombre_completo || 'Usuario'}</h3><p>{pago.cita?.servicios?.nombre} · {pago.cita?.inicio ? formatoFecha(pago.cita.inicio) : ''}</p></div><span className={`estado estado-${pago.estado}`}>{etiquetaEstado(pago.estado)}</span></div>
        <p className="pago-resumen">Valor esperado: <strong>{formatoCOP(pago.monto_cop)}</strong> · recibido {formatoFecha(pago.creado_en)}</p>
        <div className="ocr-admin"><span>OCR: {pago.ocr_monto_cop ? formatoCOP(pago.ocr_monto_cop) : 'valor no detectado'}</span><span>Comparación: {pago.ocr_monto_cop === null || pago.ocr_monto_cop === undefined ? 'sin dato' : Number(pago.ocr_monto_cop) === Number(pago.monto_cop) ? 'coincide' : 'no coincide'}</span><span>Ref.: {pago.referencia_transaccion || pago.ocr_referencia || 'no detectada'}</span><span>Fecha: {pago.ocr_fecha || 'no detectada'}</span><span>Confianza OCR: {pago.ocr_confianza ? `${Math.round(pago.ocr_confianza * 100)}%` : '—'}</span></div>
        <div className="acciones-admin"><button className="boton-secundario" onClick={() => abrirComprobante(pago)}>Ver comprobante privado</button>{links[pago.id] && <a className="enlace-comprobante" href={links[pago.id]} target="_blank" rel="noreferrer">Abrir / descargar</a>}</div>
        {pago.estado === 'en_revision' && <><label className="nota-revision">Referencia confirmada<textarea rows="1" value={referenciasPago[pago.id] ?? pago.referencia_transaccion ?? ''} onChange={(e) => setReferenciasPago((actual) => ({ ...actual, [pago.id]: e.target.value }))} placeholder="Referencia visible en Nequi" /></label><label className="nota-revision">Nota de revisión<textarea rows="2" value={notas[pago.id] ?? ''} onChange={(e) => setNotas((actual) => ({ ...actual, [pago.id]: e.target.value }))} placeholder="Ej. comprobante no legible o referencia no coincide" /></label><div className="acciones-admin"><button className="boton-principal" onClick={() => revisarPago(pago, 'aprobado')}>Aprobar pago y confirmar cita</button><button className="boton-texto peligro" onClick={() => revisarPago(pago, 'rechazado')}>Rechazar</button></div></>}
        {pago.nota_revision && <p className="ayuda">Nota: {pago.nota_revision}</p>}
      </article>)}</div>}
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Resumen del servicio</h2><p>Indicadores construidos a partir de las citas y pagos registrados.</p></div></div>
      <div className="resumen-indicadores">
        <div><strong>{perfiles.filter((p) => p.rol === 'usuario').length}</strong><span>usuarios</span></div>
        <div><strong>{perfiles.filter((p) => p.rol === 'profesional' && p.activo).length}</strong><span>profesionales activos</span></div>
        <div><strong>{citas.filter((c) => c.estado === 'completada').length}</strong><span>atendidas</span></div>
        <div><strong>{citas.filter((c) => c.estado === 'cancelada').length}</strong><span>canceladas</span></div>
        <div><strong>{citas.filter((c) => c.estado === 'no_asistio').length}</strong><span>inasistencias</span></div>
        <div><strong>{pagos.filter((p) => p.estado === 'aprobado').length}</strong><span>aportes aprobados</span></div>
      </div>
      <h3>Últimas atenciones por usuario</h3>
      <div className="tabla-contenedor"><table><thead><tr><th>Usuario</th><th>Número de citas</th><th>Última cita</th><th>Estado</th></tr></thead><tbody>{perfiles.filter((p) => p.rol === 'usuario').map((p) => {
        const propias = citas.filter((c) => c.usuario_id === p.id).sort((a,b) => new Date(b.inicio)-new Date(a.inicio))
        return <tr key={p.id}><td>{p.nombre_completo}</td><td>{propias.length}</td><td>{propias[0] ? formatoFecha(propias[0].inicio) : 'Sin citas'}</td><td>{propias[0] ? etiquetaEstado(propias[0].estado) : 'Sin actividad'}</td></tr>
      })}</tbody></table></div>
      {bonos.length > 0 && <><h3>Bonos por cancelación administrativa</h3><div className="tabla-contenedor"><table><thead><tr><th>Usuario</th><th>Valor</th><th>Fecha</th><th>Motivo</th></tr></thead><tbody>{bonos.map((bono) => <tr key={bono.id}><td>{bono.usuario?.nombre_completo}</td><td>{formatoCOP(bono.valor_cop)}</td><td>{formatoFecha(bono.creado_en)}</td><td>{bono.motivo}</td></tr>)}</tbody></table></div></>}
      {historialCitas.length > 0 && <><h3>Historial reciente de cambios</h3><div className="tabla-contenedor"><table><thead><tr><th>Fecha del cambio</th><th>Cita</th><th>Fecha anterior</th><th>Fecha nueva</th><th>Estado</th></tr></thead><tbody>{historialCitas.slice(0,20).map((h) => <tr key={h.id}><td>{formatoFecha(h.ocurrido_en)}</td><td>{h.cita_id.slice(0,8)}…</td><td>{h.inicio_anterior ? formatoFecha(h.inicio_anterior) : '—'}</td><td>{h.inicio_nuevo ? formatoFecha(h.inicio_nuevo) : '—'}</td><td>{h.estado_nuevo ? etiquetaEstado(h.estado_nuevo) : 'Reprogramada'}</td></tr>)}</tbody></table></div></>}
    </section>

    <section className="panel-tarjeta">
      <div className="seccion-encabezado"><div><h2>Historial de estados de pago</h2><p>Últimos 30 eventos registrados por la base de datos.</p></div></div>
      {historial.length === 0 ? <p className="vacio">Todavía no hay cambios de estado registrados.</p> : <div className="tabla-contenedor"><table><thead><tr><th>Fecha</th><th>Pago</th><th>Cambio</th><th>Actor</th><th>Nota</th></tr></thead><tbody>{historial.map((evento) => <tr key={evento.id}><td>{formatoFecha(evento.ocurrido_en)}</td><td>{evento.pago_id.slice(0, 8)}…</td><td>{evento.estado_anterior ? `${etiquetaEstado(evento.estado_anterior)} → ` : ''}{etiquetaEstado(evento.estado_nuevo)}</td><td>{evento.actor_id ? `${evento.actor_id.slice(0, 8)}…` : 'Sistema'}</td><td>{evento.nota || '—'}</td></tr>)}</tbody></table></div>}
    </section>
  </main>
}
