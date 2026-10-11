
import { useState } from 'react'
import { supabase, supabaseConfigurado } from '../supabase'

export default function Registro({ alIniciarSesion, alVolver }) {
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [tipoMensaje, setTipoMensaje] = useState('')

  async function registrarUsuario(e) {
    e.preventDefault()
    setMensaje('')
    setTipoMensaje('')

    const formulario = e.currentTarget
    const nombre = formulario.nombre.value.trim()
    const correo = formulario.correoRegistro.value.trim()
    const tipoUsuario = formulario.tipoUsuario.value
    const contrasena = formulario.contrasenaRegistro.value
    const confirmar = formulario.confirmarContrasena.value

    if (contrasena !== confirmar) {
      setMensaje('Las contraseñas no coinciden.')
      setTipoMensaje('error')
      return
    }

    if (contrasena.length < 8) {
      setMensaje('La contraseña debe tener mínimo 8 caracteres.')
      setTipoMensaje('error')
      return
    }

    if (!supabaseConfigurado || !supabase) {
      setMensaje('Supabase no está configurado correctamente.')
      setTipoMensaje('error')
      return
    }

    setCargando(true)

    try {
      const { error } = await supabase.auth.signUp({
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
        'Registro enviado. Revisa tu correo si necesitas confirmar la cuenta.'
      )
      setTipoMensaje('exito')
      formulario.reset()
    } catch (error) {
      setMensaje(error.message || 'No se pudo completar el registro.')
      setTipoMensaje('error')
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="zona-login">
      <form className="formulario" onSubmit={registrarUsuario}>
        <span className="etiqueta">CREA TU CUENTA</span>
        <h1>Registro de usuario</h1>
        <p>Completa tus datos para comenzar.</p>

        {mensaje && (
          <p
            role="status"
            className={
              tipoMensaje === 'error'
                ? 'mensaje-error'
                : 'mensaje-exito'
            }
          >
            {mensaje}
          </p>
        )}

        <label htmlFor="nombre">Nombre completo</label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          autoComplete="name"
          placeholder="Escribe tu nombre completo"
          required
        />

        <label htmlFor="correoRegistro">Correo electrónico</label>
        <input
          id="correoRegistro"
          name="correoRegistro"
          type="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
          required
        />

        <label htmlFor="tipoUsuario">Tipo de usuario</label>
        <select
          id="tipoUsuario"
          name="tipoUsuario"
          required
          defaultValue=""
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          <option value="estudiante">Estudiante UNIMINUTO</option>
          <option value="externo">Usuario externo</option>
        </select>

        <label htmlFor="contrasenaRegistro">Crear contraseña</label>
        <input
          id="contrasenaRegistro"
          name="contrasenaRegistro"
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="Mínimo 8 caracteres"
          required
        />

        <label htmlFor="confirmarContrasena">
          Confirmar contraseña
        </label>
        <input
          id="confirmarContrasena"
          name="confirmarContrasena"
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="Repite tu contraseña"
          required
        />

        <button
          className="boton-principal ancho"
          type="submit"
          disabled={cargando}
        >
          {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        <p className="texto-registro">
          ¿Ya tienes cuenta?{' '}
          <button
            type="button"
            className="enlace"
            onClick={alIniciarSesion}
          >
            Inicia sesión
          </button>
        </p>

        <button
          type="button"
          className="volver"
          onClick={alVolver}
        >
          ← Volver al inicio
        </button>
      </form>
    </main>
  )
}
