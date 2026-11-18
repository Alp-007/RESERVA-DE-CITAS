import { useState } from 'react'
import { supabase, supabaseConfigurado } from '../supabase'
import { FECHA_HOY_BOGOTA } from '../lib/formato'

const DOMINIOS_INSTITUCIONALES = ['uniminuto.edu.co', 'uniminuto.edu']
const TIPOS_DOCUMENTO = ['Cédula de ciudadanía', 'Tarjeta de identidad', 'Cédula de extranjería', 'Pasaporte', 'Otro']
const MAX_DOCUMENTO_BYTES = 8 * 1024 * 1024
const TIPOS_ARCHIVO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function validarDocumento(archivo) {
  if (!archivo) return ''
  if (!TIPOS_ARCHIVO.includes(archivo.type)) return 'El documento debe ser PDF, JPG, PNG o WEBP.'
  if (archivo.size > MAX_DOCUMENTO_BYTES) return 'El documento no puede superar 8 MB.'
  return ''
}

async function cargarRemision(usuarioId, archivo) {
  if (!archivo) return
  const extension = archivo.name.split('.').pop()?.toLowerCase() || 'bin'
  const ruta = `${usuarioId}/${crypto.randomUUID()}.${extension}`
  const { error: cargaError } = await supabase.storage.from('documentos-remision').upload(ruta, archivo, {
    upsert: false,
    contentType: archivo.type,
  })
  if (cargaError) throw cargaError
  const { error: perfilError } = await supabase.from('perfiles').update({ documento_remision_path: ruta }).eq('id', usuarioId)
  if (perfilError) throw perfilError
}

export default function Registro({ alIniciarSesion, alVolver }) {
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [tipoMensaje, setTipoMensaje] = useState('')
  const [correoPendiente, setCorreoPendiente] = useState('')
  const [archivoRemision, setArchivoRemision] = useState(null)
  const [errorArchivo, setErrorArchivo] = useState('')
  const [edadNacimiento, setEdadNacimiento] = useState(null)

  function actualizarEdad(fecha) {
    if (!fecha) { setEdadNacimiento(null); return }
    const nacimiento = new Date(`${fecha}T00:00:00`)
    const hoy = new Date()
    let edad = hoy.getFullYear() - nacimiento.getFullYear()
    if (hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) edad -= 1
    setEdadNacimiento(edad >= 0 ? edad : null)
  }

  function mostrar(texto, tipo = 'exito') {
    setMensaje(texto)
    setTipoMensaje(tipo)
  }

  async function registrarUsuario(e) {
    e.preventDefault()
    setMensaje('')
    setTipoMensaje('')
    const formulario = e.currentTarget
    const nombre = formulario.nombre.value.trim()
    const correo = formulario.correoRegistro.value.trim().toLowerCase()
    const tipoUsuario = formulario.tipoUsuario.value
    const archivo = archivoRemision
    const errorArchivoSeleccionado = validarDocumento(archivo)
    if (errorArchivoSeleccionado) return mostrar(errorArchivoSeleccionado, 'error')

    if (tipoUsuario === 'estudiante') {
      const dominio = correo.split('@').pop()
      if (!DOMINIOS_INSTITUCIONALES.includes(dominio)) return mostrar('Para registrarte como estudiante, usa tu correo institucional UNIMINUTO.', 'error')
    }

    if (formulario.contrasenaRegistro.value !== formulario.confirmarContrasena.value) return mostrar('Las contraseñas no coinciden.', 'error')
    if (formulario.contrasenaRegistro.value.length < 8) return mostrar('La contraseña debe tener mínimo 8 caracteres.', 'error')
    if (!formulario.consentimiento.checked) return mostrar('Debes aceptar el uso de tus datos para gestionar tu cuenta y tus citas.', 'error')
    if (!supabaseConfigurado || !supabase) return mostrar('Supabase no está configurado correctamente.', 'error')

    setCargando(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: correo,
        password: formulario.contrasenaRegistro.value,
        options: {
          data: {
            nombre_completo: nombre,
            tipo_usuario: tipoUsuario,
            tipo_documento: formulario.tipoDocumento.value,
            numero_documento: formulario.numeroDocumento.value.trim(),
            fecha_nacimiento: formulario.fechaNacimiento.value,
            telefono: formulario.telefono.value.trim(),
            direccion: formulario.direccion.value.trim(),
            horario_preferido: formulario.horarioPreferido.value,
            consentimiento_datos_en: new Date().toISOString(),
          },
        },
      })
      if (error) throw error

      if (data.session && data.user && archivo) {
        try { await cargarRemision(data.user.id, archivo) } catch {
          mostrar('La cuenta se creó, pero no se pudo cargar el documento de remisión. Podrás intentarlo desde Mi perfil.', 'error')
          return
        }
      }

      if (data.session) {
        mostrar('Cuenta creada. Ya puedes completar tu perfil y solicitar una cita.')
      } else {
        setCorreoPendiente(correo)
        mostrar(archivo ? 'Te enviamos un código de verificación. Escríbelo aquí para conservar y subir el documento de remisión; si activas la cuenta desde un enlace, podrás subirlo luego en Mi perfil.' : 'Te enviamos un código de verificación. Escríbelo aquí para activar la cuenta; si tu correo envía un enlace, también puedes abrirlo desde allí.')
      }
      formulario.reset()
      if (data.session || !archivo) setArchivoRemision(null)
      setEdadNacimiento(null)
    } catch (error) {
      mostrar(error.message || 'No se pudo completar el registro.', 'error')
    } finally {
      setCargando(false)
    }
  }

  async function verificarCorreo(e) {
    e.preventDefault()
    setCargando(true)
    try {
      const codigo = e.currentTarget.codigoCorreo.value.trim()
      const { data, error } = await supabase.auth.verifyOtp({ email: correoPendiente, token: codigo, type: 'signup' })
      if (error) throw error
      if (data.user && archivoRemision) {
        try { await cargarRemision(data.user.id, archivoRemision) } catch {
          mostrar('Correo verificado. No se pudo cargar el documento; podrás subirlo luego desde Mi perfil.', 'error')
          return
        }
      }
      setCorreoPendiente('')
      setArchivoRemision(null)
      mostrar('Correo verificado. Tu cuenta ya está activa.')
    } catch (error) {
      mostrar(error.message || 'No se pudo verificar el correo.', 'error')
    } finally {
      setCargando(false)
    }
  }

  async function reenviarCodigo() {
    setCargando(true)
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: correoPendiente })
      if (error) throw error
      mostrar('Te enviamos otro código de verificación.')
    } catch (error) {
      mostrar(error.message || 'No se pudo reenviar el código.', 'error')
    } finally {
      setCargando(false)
    }
  }

  return <main className="zona-login">
    {correoPendiente ? <form className="formulario" onSubmit={verificarCorreo}>
      <span className="etiqueta">VERIFICACIÓN DE CORREO</span><h1>Activa tu cuenta</h1>
      <p>Escribe el código enviado a <strong>{correoPendiente}</strong>. Si recibiste un enlace, ábrelo para verificar la cuenta.</p>
      {mensaje && <p role="status" className={tipoMensaje === 'error' ? 'mensaje-error' : 'mensaje-exito'}>{mensaje}</p>}
      <label htmlFor="codigoCorreo">Código de verificación</label><input id="codigoCorreo" name="codigoCorreo" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={8} required />
      <button className="boton-principal ancho" type="submit" disabled={cargando}>{cargando ? 'Verificando…' : 'Verificar correo'}</button>
      <button className="enlace" type="button" onClick={reenviarCodigo} disabled={cargando}>Reenviar código</button>
      <button type="button" className="volver" onClick={alIniciarSesion}>← Ir a iniciar sesión</button>
    </form> : <form className="formulario formulario-registro" onSubmit={registrarUsuario}>
      <span className="etiqueta">CREA TU CUENTA</span><h1>Registro de usuario</h1><p>Completa tus datos para solicitar atención.</p>
      {mensaje && <p role="status" className={tipoMensaje === 'error' ? 'mensaje-error' : 'mensaje-exito'}>{mensaje}</p>}
      {!supabaseConfigurado && <p className="alerta alerta-error">Conecta Supabase para activar el registro.</p>}
      <div className="formulario-dos-columnas">
        <label htmlFor="nombre">Nombre completo<input id="nombre" name="nombre" type="text" autoComplete="name" maxLength={120} required /></label>
        <label htmlFor="tipoUsuario">Tipo de usuario<select id="tipoUsuario" name="tipoUsuario" required defaultValue=""><option value="" disabled>Selecciona</option><option value="estudiante">Estudiante UNIMINUTO</option><option value="externo">Usuario externo</option></select></label>
        <label htmlFor="tipoDocumento">Tipo de documento<select id="tipoDocumento" name="tipoDocumento" required defaultValue=""><option value="" disabled>Selecciona</option>{TIPOS_DOCUMENTO.map((tipo) => <option key={tipo}>{tipo}</option>)}</select></label>
        <label htmlFor="numeroDocumento">Número de documento<input id="numeroDocumento" name="numeroDocumento" type="text" autoComplete="off" maxLength={30} required /></label>
        <label htmlFor="fechaNacimiento">Fecha de nacimiento<input id="fechaNacimiento" name="fechaNacimiento" type="date" max={FECHA_HOY_BOGOTA} onChange={(e) => actualizarEdad(e.target.value)} required />{edadNacimiento !== null && <small>Edad: {edadNacimiento} años</small>}</label>
        <label htmlFor="telefono">Número de contacto<input id="telefono" name="telefono" type="tel" autoComplete="tel" maxLength={30} required /></label>
        <label className="campo-ancho" htmlFor="direccion">Dirección<input id="direccion" name="direccion" type="text" autoComplete="street-address" maxLength={200} required /></label>
        <label htmlFor="horarioPreferido">Horario de preferencia<select id="horarioPreferido" name="horarioPreferido" required defaultValue=""><option value="" disabled>Selecciona</option><option value="manana">Mañana</option><option value="tarde">Tarde</option><option value="indiferente">Sin preferencia</option></select></label>
        <label className="campo-ancho" htmlFor="correoRegistro">Correo electrónico<input id="correoRegistro" name="correoRegistro" type="email" autoComplete="email" maxLength={254} required /></label>
        <label htmlFor="contrasenaRegistro">Crear contraseña<input id="contrasenaRegistro" name="contrasenaRegistro" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label htmlFor="confirmarContrasena">Confirmar contraseña<input id="confirmarContrasena" name="confirmarContrasena" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label className="campo-ancho" htmlFor="documentoRemision">Documento de remisión (opcional, PDF/JPG/PNG/WEBP, máximo 8 MB)<input id="documentoRemision" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => {
          const archivo = e.target.files?.[0] || null
          const error = validarDocumento(archivo)
          setArchivoRemision(error ? null : archivo)
          setErrorArchivo(error)
        }} />{errorArchivo && <small className="texto-error">{errorArchivo}</small>}</label>
      </div>
      <label className="consentimiento" htmlFor="consentimiento"><input id="consentimiento" name="consentimiento" type="checkbox" required /><span>Autorizo el uso de mis datos personales para gestionar mi cuenta, las citas y la atención solicitada.</span></label>
      <p className="ayuda">Los estudiantes deben usar un correo institucional UNIMINUTO verificado. El beneficio económico requiere validación de la institución.</p>
      <button className="boton-principal ancho" type="submit" disabled={cargando}>{cargando ? 'Creando cuenta…' : 'Crear cuenta'}</button>
      <p className="texto-registro">¿Ya tienes cuenta? <button type="button" className="enlace" onClick={alIniciarSesion}>Inicia sesión</button></p>
      <button type="button" className="volver" onClick={alVolver}>← Volver al inicio</button>
    </form>}
  </main>
}
