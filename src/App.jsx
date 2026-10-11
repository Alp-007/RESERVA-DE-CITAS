import { useEffect, useState } from 'react'
import './App.css'
import { supabase, supabaseConfigurado } from './supabase'
import Registro from './pages/Registro'
import PanelUsuario from './pages/PanelUsuario'
import PanelProfesional from './pages/PanelProfesional'
import PanelAdministrador from './pages/PanelAdministrador'

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
      setUsuario(data?.session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setUsuario(sesion?.user ?? null)
      setPerfil(null)
    })
    return () => { activo = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!usuario || !supabase) return undefined
    let activo = true
    supabase.from('perfiles').select('id,nombre_completo,tipo_usuario,rol').eq('id', usuario.id).single()
      .then(({ data, error }) => {
        if (!activo) return
        setPerfil(data || { noDisponible: true })
        if (error) mostrarMensaje('No se pudo cargar tu perfil. Verifica que la migración de Supabase esté aplicada.', 'error')
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
      setPantalla('panel')
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

  const panel = () => {
    if (!perfil) return <main className="panel-contenedor"><p>Cargando tu perfil…</p></main>
    if (perfil.noDisponible) return <main className="panel-contenedor"><p className="alerta alerta-error">No encontramos tu perfil. Confirma que la migración del backend se ejecutó.</p></main>
    if (perfil.rol === 'administrador') return <PanelAdministrador supabase={supabase} usuario={usuario} />
    if (perfil.rol === 'profesional') return <PanelProfesional supabase={supabase} usuario={usuario} />
    return <PanelUsuario supabase={supabase} usuario={usuario} />
  }

  return <div className="pagina">
    <div className={`barra-conexion ${supabaseConfigurado ? 'conexion-lista' : 'conexion-pendiente'}`} role="status">
      {supabaseConfigurado ? 'Supabase configurado' : 'Vista previa disponible · falta conectar Supabase en .env'}
    </div>
    <header className="encabezado">
      <button className="marca marca-boton" onClick={() => setPantalla(usuario ? 'panel' : 'inicio')} aria-label="Ir al inicio">
        <span className="logo">U</span><span><strong>UNIMINUTO</strong><small>Bienestar Universitario</small></span>
      </button>
      <nav aria-label="Navegación principal">
        <button className="nav-enlace" onClick={() => setPantalla(usuario ? 'panel' : 'inicio')}>{usuario ? 'Mi panel' : 'Inicio'}</button>
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
          <button className="boton-principal" onClick={() => setPantalla(usuario ? 'panel' : 'registro')}>{usuario ? 'Ir a mis citas →' : 'Solicitar una cita →'}</button>
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
      <button className="boton-principal ancho" type="submit" disabled={cargando}>{cargando ? 'Ingresando…' : 'Iniciar sesión'}</button>
      <p className="texto-registro">¿No tienes cuenta? <button type="button" className="enlace" onClick={() => setPantalla('registro')}>Regístrate aquí</button></p>
      <button type="button" className="volver" onClick={() => setPantalla('inicio')}>← Volver al inicio</button>
    </form></main>}

    {pantalla === 'registro' && <Registro alIniciarSesion={() => setPantalla('login')} alVolver={() => setPantalla('inicio')} />}
    {pantalla === 'panel' && usuario && panel()}

    <footer id="nosotros"><strong>UNIMINUTO · Bienestar Universitario</strong><p>Un espacio para el cuidado y el bienestar emocional.</p><small>Atención de lunes a sábado · Hora de Bogotá</small></footer>
  </div>
}

export default App
