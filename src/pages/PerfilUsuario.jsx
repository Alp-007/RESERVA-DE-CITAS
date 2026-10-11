import { useState } from 'react'
import { FECHA_HOY_BOGOTA } from '../lib/formato'

function calcularEdad(fecha) {
  if (!fecha) return null
  const hoy = new Date()
  const nacimiento = new Date(`${fecha}T00:00:00`)
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  if (hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) edad -= 1
  return edad >= 0 ? edad : null
}

export default function PerfilUsuario({ supabase, usuario, perfil, alGuardar, alVolver }) {
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [motivoCambio, setMotivoCambio] = useState('')

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true); setError(''); setMensaje('')
    const f = e.currentTarget
    const campos = {
      nombre_completo: f.nombre.value.trim(),
      tipo_documento: f.tipoDocumento.value,
      numero_documento: f.numeroDocumento.value.trim(),
      fecha_nacimiento: f.fechaNacimiento.value,
      telefono: f.telefono.value.trim(),
      direccion: f.direccion.value.trim(),
      horario_preferido: f.horarioPreferido.value,
    }
    try {
      let rutaDocumento = perfil.documento_remision_path
      if (archivo) {
        const extension = archivo.name.split('.').pop()?.toLowerCase() || 'bin'
        rutaDocumento = `${usuario.id}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage.from('documentos-remision').upload(rutaDocumento, archivo, { upsert: false, contentType: archivo.type })
        if (uploadError) throw uploadError
      }
      const { data, error: updateError } = await supabase.from('perfiles').update({ ...campos, documento_remision_path: rutaDocumento }).eq('id', usuario.id)
        .select('id,nombre_completo,tipo_usuario,rol,tipo_documento,numero_documento,fecha_nacimiento,telefono,direccion,horario_preferido,documento_remision_path,estudiante_validado,activo,profesional_asignado_id,consentimiento_datos_en').single()
      if (updateError) throw updateError
      alGuardar(data)
      setArchivo(null)
      f.documentoRemision.value = ''
      setMensaje('Perfil actualizado.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el perfil.')
    } finally { setGuardando(false) }
  }

  async function solicitarCambio(e) {
    e.preventDefault()
    setError(''); setMensaje('')
    const { error: requestError } = await supabase.rpc('solicitar_cambio_profesional', { motivo: motivoCambio })
    if (requestError) setError(requestError.message)
    else { setMensaje('Solicitud enviada al administrador para revisión.'); setMotivoCambio('') }
  }

  const edad = calcularEdad(perfil.fecha_nacimiento)
  return <main className="panel-contenedor">
    <div className="panel-titulo"><div><span className="etiqueta">ESPACIO PERSONAL</span><h1>Mi perfil</h1><p>Actualiza tus datos de contacto y revisa tu estado de verificación.</p></div><button className="boton-secundario" onClick={alVolver}>Volver al inicio</button></div>
    {mensaje && <p className="alerta alerta-exito" role="status">{mensaje}</p>}{error && <p className="alerta alerta-error" role="alert">{error}</p>}
    <form className="panel-tarjeta formulario-perfil" onSubmit={guardar}>
      <div className="perfil-cuenta"><div className="avatar-perfil">{(perfil.nombre_completo || usuario.email || 'U').trim().charAt(0).toUpperCase()}</div><div><h2>{perfil.nombre_completo}</h2><p><strong>Correo:</strong> {usuario.email}</p><p><strong>Tipo de cuenta:</strong> {perfil.tipo_usuario === 'estudiante' ? 'Estudiante UNIMINUTO' : 'Usuario externo'}</p>{perfil.tipo_usuario === 'estudiante' && <p><strong>Correo institucional:</strong> {perfil.estudiante_validado ? 'Verificado' : 'Pendiente de verificación'}</p>}</div></div>
      <div className="formulario-dos-columnas">
        <label>Nombre completo<input name="nombre" defaultValue={perfil.nombre_completo || ''} maxLength={120} required /></label>
        <label>Tipo de documento<select name="tipoDocumento" defaultValue={perfil.tipo_documento || ''} required><option value="" disabled>Selecciona</option>{['Cédula de ciudadanía','Tarjeta de identidad','Cédula de extranjería','Pasaporte','Otro'].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Número de documento<input name="numeroDocumento" defaultValue={perfil.numero_documento || ''} maxLength={30} required /></label>
        <label>Fecha de nacimiento<input name="fechaNacimiento" type="date" defaultValue={perfil.fecha_nacimiento || ''} max={FECHA_HOY_BOGOTA} required />{edad !== null && <small>Edad: {edad} años</small>}</label>
        <label>Número de contacto<input name="telefono" type="tel" defaultValue={perfil.telefono || ''} maxLength={30} required /></label>
        <label>Horario de preferencia<select name="horarioPreferido" defaultValue={perfil.horario_preferido || 'indiferente'} required><option value="manana">Mañana</option><option value="tarde">Tarde</option><option value="indiferente">Sin preferencia</option></select></label>
        <label className="campo-ancho">Dirección<input name="direccion" defaultValue={perfil.direccion || ''} maxLength={200} required /></label>
        <label className="campo-ancho">Documento de remisión {perfil.documento_remision_path ? '(cargado; el administrador puede revisarlo)' : '(opcional)'}<input name="documentoRemision" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => {
          const next = e.target.files?.[0] || null
          if (next && (!['application/pdf','image/jpeg','image/png','image/webp'].includes(next.type) || next.size > 8 * 1024 * 1024)) { setError('Usa PDF, JPG, PNG o WEBP de máximo 8 MB.'); e.target.value = ''; setArchivo(null) }
          else { setError(''); setArchivo(next) }
        }} /><small>El archivo se guarda en almacenamiento privado y solo el administrador puede abrirlo.</small></label>
      </div>
      <button className="boton-principal" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar perfil'}</button>
    </form>
    <section className="panel-tarjeta"><h2>Cambio de profesional</h2><p className="ayuda">No puedes cambiar de profesional directamente. Envía una solicitud para que el administrador revise el caso.</p>
      <form className="formulario-cambio" onSubmit={solicitarCambio}><label>Motivo de la solicitud<textarea value={motivoCambio} onChange={(e) => setMotivoCambio(e.target.value)} minLength={5} maxLength={1000} rows={3} required /></label><button className="boton-secundario" type="submit">Enviar solicitud</button></form>
    </section>
  </main>
}
