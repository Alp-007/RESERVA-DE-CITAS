import { useState, useEffect } from 'react'
import './App.css'
import { supabase, supabaseConfigurado } from './supabase'

function App() {
  const [pantalla, setPantalla] = useState('inicio')
  const [cargando, setCargando] = useState(false)
const [mensaje, setMensaje] = useState('')
  const [tipoMensaje, setTipoMensaje] = useState('')
  const [usuario, setUsuario] = useState(null)

  useEffect(() => {
    if (!supabaseConfigurado) return undefined
    supabase.auth.getSession().then(({ data }) => setUsuario(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function iniciarSesion(e) {
    e.preventDefault()
    setMensaje('')
    setTipoMensaje('')
    setCargando(true)
    const formulario = e.currentTarget
    try {
      if (!supabaseConfigurado) throw new Error('Primero hay que conectar Supabase en el archivo .env.')
      const { error } = await supabase.auth.signInWithPassword({
        email: formulario.correoLogin.value.trim(),
        password: formulario.contrasenaLogin.value,
      })
      if (error) throw error
      setMensaje('Sesión iniciada correctamente.')
      setTipoMensaje('exito')
      setPantalla('inicio')
      formulario.reset()
    } catch (error) {
      setMensaje(error.message || 'No se pudo iniciar sesión.')
      setTipoMensaje('error')
    } finally {
      setCargando(false)
    }
  }

  async function cerrarSesion() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      setMensaje(error.message)
      setTipoMensaje('error')
    }
  }

async function registrarUsuario(e) {
  e.preventDefault()
  setMensaje('')
  setTipoMensaje('')
  setCargando(true)

  const formulario = e.currentTarget
  const nombre = formulario.nombre.value.trim()
  const correo = formulario.correoRegistro.value.trim()
  const tipoUsuario = formulario.tipoUsuario.value
  const contrasena = formulario.contrasenaRegistro.value

  try {
    if (!supabaseConfigurado) throw new Error('Primero hay que conectar Supabase en el archivo .env.')
    const { data, error } = await supabase.auth.signUp({
      email: correo,
      password: contrasena,
      options: {
        data: {
          nombre_completo: nombre,
          tipo_usuario: tipoUsuario,
        },
      },
    })

    if (error) throw error


    setMensaje(
      'Registro realizado. Revisa tu correo y confirma la cuenta.'
    )
    setTipoMensaje('exito')
    formulario.reset()
  } catch (error) {
    console.error('ERROR COMPLETO AL REGISTRAR:', error)
    setMensaje(error.message || 'No se pudo completar el registro.')
    setTipoMensaje('error')
  } finally {
    setCargando(false)
  }
}

  const [conexion, setConexion] = useState('Comprobando conexión...')

  useEffect(() => {
    async function comprobarConexion() {
      if (!supabaseConfigurado) {
        setConexion('Falta conectar Supabase: configura el archivo .env')
        return
      }
      try {
        const { error } = await supabase.auth.getSession()

        if (error) {
          setConexion('No se pudo conectar con Supabase')
          console.error('Error de Supabase:', error.message)
          return
        }

        setConexion('Conexión con Supabase iniciada correctamente')
      } catch (error) {
        setConexion('Error de conexión con Supabase')
        console.error(error)
      }
    }

    comprobarConexion()
  }, [])
  return (
    <div className="pagina">
            <div style={{
        padding: '10px',
        textAlign: 'center',
        background: supabaseConfigurado ? '#f0f7f2' : '#fff7e6',
        color: supabaseConfigurado ? '#176b3a' : '#8a4b08',
        fontSize: '14px'
      }}>
        {conexion}
      </div>
      <header className="encabezado">
        <div className="marca">
          <div className="logo">U</div>
          <div>
            <h2>UNIMINUTO</h2>
            <p>Bienestar Universitario</p>
          </div>
        </div>

        <nav>
          <a href="#inicio" onClick={() => setPantalla('inicio')}>Inicio</a>
          <a href="#servicios" onClick={() => setPantalla('inicio')}>Servicios</a>
          {usuario ? (
            <button className="boton-secundario" onClick={cerrarSesion}>Cerrar sesión</button>
          ) : (
            <button className="boton-secundario" onClick={() => setPantalla('login')}>
              Iniciar sesión
            </button>
          )}
        </nav>
      </header>

      {pantalla === 'inicio' && (
        <main>
          <section className="portada" id="inicio">
            <div className="contenido">
              <span className="etiqueta">TU BIENESTAR ES IMPORTANTE</span>
              <h1>Tu salud mental<br />también es prioridad.</h1>
              <p>
                Encuentra un espacio para ti. Consulta nuestros servicios
                de atención psicológica y gestiona tus citas de forma
                sencilla y organizada.
              </p>

              <button className="boton-principal" onClick={() => setPantalla('login')}>
                Solicitar una cita →
              </button>

              <div className="nota">
                <span>✓</span> Atención para estudiantes y comunidad externa
              </div>
            </div>

            <div className="tarjeta-info">
              <div className="icono-mental">♡</div>
              <h2>Un espacio para ti</h2>
              <p>
                Tu bienestar emocional merece atención, escucha y acompañamiento.
              </p>
              <div className="linea" />
              <div className="detalle"><span className="punto" />Atención presencial</div>
              <div className="detalle"><span className="punto" />Gestión organizada de citas</div>
            </div>
          </section>

          <section className="servicios" id="servicios">
            <div className="titulo-seccion">
              <span>NUESTROS SERVICIOS</span>
              <h2>¿Cómo podemos ayudarte?</h2>
              <p>
                Estamos creando un espacio para facilitar el acceso a la atención psicológica.
              </p>
            </div>

            <div className="tarjetas">
              <article className="servicio">
                <div className="icono">01</div>
                <h3>Solicita tu cita</h3>
                <p>Consulta la disponibilidad y gestiona tu solicitud de atención psicológica.</p>
              </article>

              <article className="servicio">
                <div className="icono">02</div>
                <h3>Atención personalizada</h3>
                <p>El equipo administrativo organiza la asignación del profesional.</p>
              </article>

              <article className="servicio">
                <div className="icono">03</div>
                <h3>Gestiona tus citas</h3>
                <p>Consulta el estado de tus solicitudes y mantente informado sobre tu atención.</p>
              </article>
            </div>
          </section>
        </main>
      )}

      {pantalla === 'login' && (
        <main className="zona-login">
          <form className="formulario" onSubmit={iniciarSesion}>
            <div className="icono-mental centrado">♡</div>
            <span className="etiqueta">BIENESTAR UNIVERSITARIO</span>
            <h1>Bienvenido</h1>
            <p>Ingresa a tu cuenta para continuar.</p>

            {mensaje && <p role="status" className={tipoMensaje === 'error' ? 'mensaje-error' : 'mensaje-exito'}>{mensaje}</p>}

            <label htmlFor="correo">Correo electrónico</label>
            <input id="correo" name="correoLogin" type="email" placeholder="tucorreo@ejemplo.com" required />

            <label htmlFor="contrasena">Contraseña</label>
            <input id="contrasena" name="contrasenaLogin" type="password" placeholder="Ingresa tu contraseña" required />

            <button className="boton-principal ancho" type="submit" disabled={cargando}>
              {cargando ? 'Ingresando...' : 'Iniciar sesión'}
            </button>

            <p className="texto-registro">
              ¿No tienes cuenta?{' '}
              <button type="button" className="enlace" onClick={() => setPantalla('registro')}>
                Regístrate aquí
              </button>
            </p>

            <button type="button" className="volver" onClick={() => setPantalla('inicio')}>
              ← Volver al inicio
            </button>
          </form>
        </main>
      )}

      {pantalla === 'registro' && (
        <main className="zona-login">
          
<form className="formulario" onSubmit={registrarUsuario}>

            <span className="etiqueta">CREA TU CUENTA</span>
            <h1>Registro de usuario</h1>
            <p>Completa tus datos para comenzar.</p>
            
{mensaje && (
  <p
    role="status"
    style={{
      color: tipoMensaje === 'error' ? '#b42318' : '#176b3a',
      background: tipoMensaje === 'error' ? '#fef3f2' : '#ecfdf3',
      padding: '12px',
      borderRadius: '8px',
    }}
  >
    {mensaje}
  </p>
)}


            <label htmlFor="nombre">Nombre completo</label>
            <input id="nombre" name="nombre" type="text" placeholder="Escribe tu nombre completo" required />

            <label htmlFor="correoRegistro">Correo electrónico</label>
            <input id="correoRegistro" name="correoRegistro" type="email" placeholder="tucorreo@ejemplo.com" required />

            <label htmlFor="tipoUsuario">Tipo de usuario</label>
            <select id="tipoUsuario" name="tipoUsuario" required defaultValue="">
              <option value="" disabled>Selecciona una opción</option>
              <option value="estudiante">Estudiante UNIMINUTO</option>
              <option value="externo">Usuario externo</option>
            </select>

            <label htmlFor="contrasenaRegistro">Crear contraseña</label>
            <input id="contrasenaRegistro" name="contrasenaRegistro" type="password" minLength="8" placeholder="Mínimo 8 caracteres" required />

            
<button
  className="boton-principal ancho"
  type="submit"
  disabled={cargando}
>
  {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
</button>


            <p className="texto-registro">
              ¿Ya tienes cuenta?{' '}
              <button type="button" className="enlace" onClick={() => setPantalla('login')}>
                Inicia sesión
              </button>
            </p>

            <button type="button" className="volver" onClick={() => setPantalla('inicio')}>
              ← Volver al inicio
            </button>
          </form>
        </main>
      )}

      <footer id="nosotros">
        <strong>UNIMINUTO · Bienestar Universitario</strong>
        <p>Un espacio para el cuidado y el bienestar emocional.</p>
      </footer>
    </div>
  )
}

export default App
