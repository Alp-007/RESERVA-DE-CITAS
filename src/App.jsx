import { useEffect, useState } from 'react'
import './App.css'
import { supabase, supabaseConfigurado } from './supabase'
import Registro from './pages/Registro'
import PanelUsuario from './pages/PanelUsuario'
import PanelProfesional from './pages/PanelProfesional'
import PanelAdministrador from './pages/PanelAdministrador'
import PerfilUsuario from './pages/PerfilUsuario'
import NotificacionesUsuario from './pages/NotificacionesUsuario'

const etiquetaRol = { usuario: 'Usuario', profesional: 'Profesional', administrador: 'Administrador' }

function App() {
  const [pantalla, setPantalla] = useState('inicio')
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [tipoMensaje, setTipoMensaje] = useState('exito')

  useEffect(() => {
    if (!supabaseConfigurado) return undefined
    let activo = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!activo) return
      if (error) mostrarMensaje(error.message, 'error')
      const sesionUsuario = data?.session?.user ?? null
      setUsuario(sesionUsuario)
      if (sesionUsuario) setPantalla('menu')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, sesion) => {
      const sesionUsuario = sesion?.user ?? null
      setUsuario(sesionUsuario)
      setPerfil(null)
      setPantalla(evento === 'PASSWORD_RECOVERY' ? 'cambiar-clave' : sesionUsuario ? 'menu' : 'inicio')
    })
    return () => { activo = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!usuario || !supabase) return undefined
    let activo = true
    supabase.from('perfiles').select('id,nombre_completo,tipo_usuario,rol,tipo_documento,numero_documento,fecha_nacimiento,telefono,direccion,horario_preferido,documento_remision_path,estudiante_validado,activo,profesional_asignado_id,consentimiento_datos_en').eq('id', usuario.id).single()
      .then(async ({ data, error }) => {
        if (!activo) return
        setPerfil(data || { noDisponible: true })
        if (error) mostrarMensaje('No se pudo cargar tu perfil. Verifica que la migración de Supabase esté aplicada.', 'error')
        if (data?.activo === false) {
          await supabase.auth.signOut()
          setPerfil(null)
          setPantalla('login')
          mostrarMensaje('Esta cuenta está desactivada. Comunícate con el administrador.', 'error')
        }
      })
    return () => { activo = false }
  }, [usuario])

  function mostrarMensaje(texto, tipo = 'exito') {
    setMensaje(texto)
    setTipoMensaje(tipo)
  }

  async function iniciarSesion(evento) {
    evento.preventDefault()
    setMensaje('')
    setCargando(true)
    const formulario = evento.currentTarget
    try {
      if (!supabase) throw new Error('Primero configura Supabase en el archivo .env.')
      const { error } = await supabase.auth.signInWithPassword({
        email: formulario.correoLogin.value.trim(),
        password: formulario.contrasenaLogin.value,
      })
      if (error) throw error
      formulario.reset()
      setPantalla('menu')
    } catch (error) {
      mostrarMensaje(error.message || 'No se pudo iniciar sesión.', 'error')
    } finally {
      setCargando(false)
    }
  }

  async function cerrarSesion() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) mostrarMensaje(error.message, 'error')
    else { setPerfil(null); setPantalla('inicio'); mostrarMensaje('Sesión cerrada.') }
  }

  async function enviarRecuperacion(evento) {
    evento.preventDefault()
    setCargando(true); setMensaje('')
    try {
      if (!supabase) throw new Error('Supabase no está configurado.')
      const correo = evento.currentTarget.correoRecuperacion.value.trim()
      const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo: window.location.origin })
      if (error) throw error
      mostrarMensaje('Te enviamos instrucciones para recuperar tu contraseña. Revisa tu correo.')
    } catch (error) { mostrarMensaje(error.message || 'No se pudo enviar el correo de recuperación.', 'error') }
    finally { setCargando(false) }
  }

  async function cambiarContrasena(evento) {
    evento.preventDefault()
    const nueva = evento.currentTarget.nuevaContrasena.value
    const confirmar = evento.currentTarget.confirmarNuevaContrasena.value
    if (nueva.length < 8) return mostrarMensaje('La contraseña debe tener mínimo 8 caracteres.', 'error')
    if (nueva !== confirmar) return mostrarMensaje('Las contraseñas no coinciden.', 'error')
    setCargando(true); setMensaje('')
    try {
      const { error } = await supabase.auth.updateUser({ password: nueva })
      if (error) throw error
      mostrarMensaje('Contraseña actualizada.')
      setPantalla('menu')
    } catch (error) { mostrarMensaje(error.message || 'No se pudo cambiar la contraseña.', 'error') }
    finally { setCargando(false) }
  }

  const panel = (vista = 'mis-citas') => {
    if (!perfil) return <main className="panel-contenedor"><p>Cargando tu perfil…</p></main>
    if (perfil.noDisponible) return <main className="panel-contenedor"><p className="alerta alerta-error">No encontramos tu perfil. Confirma que la migración del backend se ejecutó.</p></main>
    if (perfil.rol === 'administrador') return <PanelAdministrador supabase={supabase} usuario={usuario} />
    if (perfil.rol === 'profesional') return <PanelProfesional supabase={supabase} usuario={usuario} />
    return <PanelUsuario supabase={supabase} usuario={usuario} perfil={perfil} vista={vista} />
  }

  const esUsuario = usuario && perfil && !perfil.noDisponible && perfil.rol === 'usuario'

  return <div className="pagina">
    <div className={`barra-conexion ${supabaseConfigurado ? 'conexion-lista' : 'conexion-pendiente'}`} role="status">
      {supabaseConfigurado ? 'Supabase configurado' : 'Vista previa disponible · falta conectar Supabase en .env'}
    </div>
    <header className="encabezado">
      <button className="marca marca-boton" onClick={() => setPantalla(usuario ? (esUsuario ? 'menu' : 'panel') : 'inicio')} aria-label="Ir al inicio">
        <span className="logo">U</span><span><strong>UNIMINUTO</strong><small>Bienestar Universitario</small></span>
      </button>
      <nav aria-label="Navegación principal">
        <button className="nav-enlace" onClick={() => setPantalla(usuario ? (esUsuario ? 'menu' : 'panel') : 'inicio')}>{usuario ? (esUsuario ? 'Inicio' : 'Mi panel') : 'Inicio'}</button>
        {esUsuario && <>
          <button className="nav-enlace" onClick={() => setPantalla('mis-citas')}>Mis citas</button>
          <button className="nav-enlace" onClick={() => setPantalla('solicitar-cita')}>Solicitar cita</button>
          <button className="nav-enlace" onClick={() => setPantalla('mi-perfil')}>Mi perfil</button>
          <button className="nav-enlace" onClick={() => setPantalla('notificaciones')}>Notificaciones</button>
        </>}
        {!usuario && <a href="#servicios">Servicios</a>}
        {usuario && perfil && <span className="rol-etiqueta">{etiquetaRol[perfil.rol] || perfil.rol}</span>}
        {usuario ? <button className="boton-secundario" onClick={cerrarSesion}>Cerrar sesión</button> : <>
          <button className="nav-enlace" onClick={() => { setMensaje(''); setPantalla('login') }}>Iniciar sesión</button>
          <button className="boton-secundario" onClick={() => { setMensaje(''); setPantalla('registro') }}>Crear cuenta</button>
        </>}
      </nav>
    </header>

    {mensaje && <div className={`mensaje-global ${tipoMensaje === 'error' ? 'mensaje-error' : 'mensaje-exito'}`} role={tipoMensaje === 'error' ? 'alert' : 'status'}>
      <span>{mensaje}</span><button aria-label="Cerrar mensaje" onClick={() => setMensaje('')}>×</button>
    </div>}

    {pantalla === 'inicio' && <main>
      <section className="portada" id="inicio">
        <div className="contenido"><span className="etiqueta">TU BIENESTAR ES IMPORTANTE</span>
          <h1>Tu salud mental<br />también es prioridad.</h1>
          <p>Encuentra un espacio para ti. Consulta nuestros servicios de atención psicológica y gestiona tus citas de forma sencilla y organizada.</p>
          <button className="boton-principal" onClick={() => setPantalla(usuario ? (esUsuario ? 'menu' : 'panel') : 'registro')}>{usuario ? 'Ir a mi espacio →' : 'Solicitar una cita →'}</button>
          <div className="nota"><span>✓</span> Atención para estudiantes y comunidad externa</div>
        </div>
        <div className="tarjeta-info"><div className="icono-mental">♡</div><h2>Un espacio para ti</h2><p>Tu bienestar emocional merece atención, escucha y acompañamiento.</p><div className="linea" /><div className="detalle"><span className="punto" />Atención presencial</div><div className="detalle"><span className="punto" />Gestión organizada de citas</div></div>
      </section>
      <section className="servicios" id="servicios"><div className="titulo-seccion"><span>NUESTROS SERVICIOS</span><h2>¿Cómo podemos ayudarte?</h2><p>Solicita una cita, recibe atención personalizada y consulta tus solicitudes desde tu panel.</p></div>
        <div className="tarjetas"><article className="servicio"><div className="icono">01</div><h3>Solicita tu cita</h3><p>Elige un servicio, fecha y hora para enviar tu solicitud de atención.</p></article><article className="servicio"><div className="icono">02</div><h3>Atención profesional</h3><p>Consulta el estado de la cita y la información asignada por el equipo.</p></article><article className="servicio"><div className="icono">03</div><h3>Pago con revisión</h3><p>Adjunta el comprobante Nequi y recibe confirmación cuando sea revisado.</p></article></div>
      </section>
    </main>}

    {pantalla === 'login' && <main className="zona-login"><form className="formulario" onSubmit={iniciarSesion}>
      <div className="icono-mental centrado">♡</div><span className="etiqueta">BIENESTAR UNIVERSITARIO</span><h1>Bienvenido</h1><p>Ingresa a tu cuenta para continuar.</p>
      {!supabaseConfigurado && <p className="alerta alerta-error">Conecta Supabase para activar el inicio de sesión.</p>}
      <label htmlFor="correoLogin">Correo electrónico</label><input id="correoLogin" name="correoLogin" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" required />
      <label htmlFor="contrasenaLogin">Contraseña</label><input id="contrasenaLogin" name="contrasenaLogin" type="password" autoComplete="current-password" required />
      <button type="button" className="enlace enlace-recuperacion" onClick={() => { setMensaje(''); setPantalla('recuperar-clave') }}>¿Olvidaste tu contraseña?</button>
      <button className="boton-principal ancho" type="submit" disabled={cargando}>{cargando ? 'Ingresando…' : 'Iniciar sesión'}</button>
      <p className="texto-registro">¿No tienes cuenta? <button type="button" className="enlace" onClick={() => setPantalla('registro')}>Regístrate aquí</button></p>
      <button type="button" className="volver" onClick={() => setPantalla('inicio')}>← Volver al inicio</button>
    </form></main>}

    {pantalla === 'recuperar-clave' && <main className="zona-login"><form className="formulario" onSubmit={enviarRecuperacion}>
      <span className="etiqueta">RECUPERAR ACCESO</span><h1>Restablecer contraseña</h1><p>Te enviaremos un enlace para crear una contraseña nueva.</p>
      {mensaje && <p role={tipoMensaje === 'error' ? 'alert' : 'status'} className={tipoMensaje === 'error' ? 'mensaje-error' : 'mensaje-exito'}>{mensaje}</p>}
      <label htmlFor="correoRecuperacion">Correo electrónico</label><input id="correoRecuperacion" name="correoRecuperacion" type="email" autoComplete="email" required />
      <button className="boton-principal ancho" type="submit" disabled={cargando}>{cargando ? 'Enviando…' : 'Enviar enlace'}</button>
      <button type="button" className="volver" onClick={() => setPantalla('login')}>← Volver al inicio de sesión</button>
    </form></main>}

    {pantalla === 'cambiar-clave' && <main className="zona-login"><form className="formulario" onSubmit={cambiarContrasena}>
      <span className="etiqueta">RECUPERAR ACCESO</span><h1>Crear contraseña nueva</h1>
      {mensaje && <p role={tipoMensaje === 'error' ? 'alert' : 'status'} className={tipoMensaje === 'error' ? 'mensaje-error' : 'mensaje-exito'}>{mensaje}</p>}
      <label htmlFor="nuevaContrasena">Nueva contraseña</label><input id="nuevaContrasena" name="nuevaContrasena" type="password" minLength={8} autoComplete="new-password" required />
      <label htmlFor="confirmarNuevaContrasena">Confirmar contraseña</label><input id="confirmarNuevaContrasena" name="confirmarNuevaContrasena" type="password" minLength={8} autoComplete="new-password" required />
      <button className="boton-principal ancho" type="submit" disabled={cargando}>{cargando ? 'Actualizando…' : 'Cambiar contraseña'}</button>
    </form></main>}

    {pantalla === 'registro' && <Registro alIniciarSesion={() => setPantalla('login')} alVolver={() => setPantalla('inicio')} />}
    {pantalla === 'panel' && usuario && panel()}
    {pantalla === 'menu' && usuario && !perfil && <main className="panel-contenedor"><p>Cargando tu perfil…</p></main>}
    {pantalla === 'menu' && usuario && perfil?.noDisponible && <main className="panel-contenedor"><p className="alerta alerta-error">No encontramos tu perfil. Confirma que la migración del backend se ejecutó.</p></main>}
    {pantalla === 'menu' && usuario && perfil && !perfil.noDisponible && perfil.rol !== 'usuario' && panel()}
    {pantalla === 'menu' && usuario && perfil && !perfil.noDisponible && perfil.rol === 'usuario' && <main className="inicio-usuario">
      <section className="bienvenida-usuario">
        <span className="etiqueta">TU ESPACIO PERSONAL</span>
        <h1>Hola, {perfil.nombre_completo?.trim().split(/\s+/)[0] || 'bienvenido'} 👋</h1>
        <p>¿Qué deseas hacer hoy? Desde aquí puedes organizar tu atención y revisar tu cuenta.</p>
      </section>
      <section className="menu-usuario" aria-label="Opciones de tu cuenta">
        <button className="opcion-menu" onClick={() => setPantalla('solicitar-cita')}>
          <span className="opcion-icono">＋</span><span className="opcion-texto"><strong>Solicitar una cita</strong><small>Elige el servicio, la fecha y la hora que prefieres.</small></span><span className="opcion-flecha">→</span>
        </button>
        <button className="opcion-menu" onClick={() => setPantalla('mis-citas')}>
          <span className="opcion-icono">▣</span><span className="opcion-texto"><strong>Mis citas</strong><small>Consulta solicitudes, estados y pagos.</small></span><span className="opcion-flecha">→</span>
        </button>
        <button className="opcion-menu" onClick={() => setPantalla('mi-perfil')}>
          <span className="opcion-icono">◉</span><span className="opcion-texto"><strong>Mi perfil</strong><small>Revisa los datos de tu cuenta.</small></span><span className="opcion-flecha">→</span>
        </button>
        <button className="opcion-menu" onClick={() => setPantalla('notificaciones')}>
          <span className="opcion-icono">♧</span><span className="opcion-texto"><strong>Notificaciones</strong><small>Revisa cambios de citas y pagos.</small></span><span className="opcion-flecha">→</span>
        </button>
      </section>
      <p className="ayuda inicio-ayuda">Si es tu primera vez, puedes comenzar solicitando una cita.</p>
    </main>}
    {pantalla === 'mis-citas' && usuario && esUsuario && panel('mis-citas')}
    {pantalla === 'solicitar-cita' && usuario && esUsuario && panel('solicitar-cita')}
    {pantalla === 'mi-perfil' && usuario && esUsuario && perfil && <PerfilUsuario supabase={supabase} usuario={usuario} perfil={perfil} alGuardar={setPerfil} alVolver={() => setPantalla('menu')} />}
    {pantalla === 'notificaciones' && usuario && esUsuario && <NotificacionesUsuario supabase={supabase} usuario={usuario} />}

    <footer id="nosotros"><strong>UNIMINUTO · Bienestar Universitario</strong><p>Un espacio para el cuidado y el bienestar emocional.</p><small>Atención de lunes a sábado · Hora de Bogotá</small></footer>
  </div>
}

export default App
