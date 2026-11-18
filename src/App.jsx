import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import './App.css'
import { supabase, supabaseConfigurado } from './supabase'

const PanelUsuario = lazy(() => import('./pages/PanelUsuario'))
const PanelProfesional = lazy(() => import('./pages/PanelProfesional'))
const PanelAdministrador = lazy(() => import('./pages/PanelAdministrador'))

const slots = [
  ['MAR-09', 'Martes 14 de octubre', '9:00 a. m.'],
  ['MAR-11', 'Martes 14 de octubre', '11:00 a. m.'],
  ['JUE-14', 'Jueves 16 de octubre', '2:00 p. m.'],
  ['VIE-10', 'Viernes 17 de octubre', '10:30 a. m.'],
]

const seedAppointments = [
  { id: 'CIT-2401', patient: 'Camila R.', phone: '300 555 0184', code: 'P-014', professional: 'Ps. Valentina Rojas', date: 'Martes 14 de octubre', time: '9:00 a. m.', room: 'Consultorio 204', status: 'Confirmada', payment: 'Aprobado', amount: 5000, reference: 'BRB-740021' },
  { id: 'CIT-2402', patient: 'Santiago M.', phone: '315 420 1168', code: 'P-027', professional: 'Ps. Valentina Rojas', date: 'Jueves 16 de octubre', time: '2:00 p. m.', room: 'Consultorio 204', status: 'Programada', payment: 'Reportado', amount: 12000, reference: 'BRB-740155' },
  { id: 'CIT-2398', patient: 'Andrea C.', phone: '301 771 2380', code: 'P-031', professional: 'Ps. Julián Torres', date: 'Viernes 10 de octubre', time: '3:30 p. m.', room: 'Consultorio 108', status: 'Atendida', payment: 'Aprobado', amount: 5000, reference: 'BRB-739875' },
]

const seedProfessionals = [
  { id: 'PRO-01', name: 'Ps. Valentina Rojas', area: 'Psicología clínica', hours: 'Lun - Vie · 8:00 a. m. - 4:00 p. m.', active: true, schedule: 'Lun 08–16 · Mar 08–16 · Mié descanso · Jue 08–16 · Vie 08–16', photo: '' },
  { id: 'PRO-02', name: 'Ps. Julián Torres', area: 'Orientación y bienestar', hours: 'Mar - Sáb · 9:00 a. m. - 5:00 p. m.', active: true, schedule: 'Mar 09–17 · Mié 09–17 · Jue 09–17 · Vie 09–17 · Sáb 09–17', photo: '' },
]

const money = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

function App() {
  const [screen, setScreen] = useState('home')
  const [session, setSession] = useState(null)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [connection, setConnection] = useState(supabaseConfigurado ? 'Conectando con el servicio...' : 'Modo local · sin conexión a Supabase')
  const [appointments, setAppointments] = useState(seedAppointments)
  const [professionals, setProfessionals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bienestar_professional_photos') || 'null') || seedProfessionals } catch { return seedProfessionals }
  })
  const [adminPhoto, setAdminPhoto] = useState(() => localStorage.getItem('bienestar_admin_photo') || '')
  const [tab, setTab] = useState('summary')
  const [slot, setSlot] = useState(null)
  const [bookingStep, setBookingStep] = useState('schedule')
  const [profileType, setProfileType] = useState('student')
  const [reference, setReference] = useState('')
  const [openedAt] = useState(() => new Date())
  const [showCookies, setShowCookies] = useState(() => !localStorage.getItem('uniminuto-cookie-choice'))
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    if (!supabaseConfigurado) return undefined
    let mounted = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setScreen('reset-password')
    })
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) throw error
      if (!mounted) return
      const user = data.session?.user
      if (!user) { setConnection('Portal seguro de Bienestar Universitario'); return }
      const { data: profile, error: profileError } = await supabase.from('perfiles').select('*').eq('id', user.id).single()
      if (!mounted) return
      const roles = { usuario: 'user', profesional: 'professional', administrador: 'admin' }
      const nextRole = roles[profile?.rol]
      if (profileError || !profile || profile.activo === false || !nextRole) {
        await supabase.auth.signOut()
        setConnection('No se pudo recuperar la sesión')
        return
      }
      setSession({ name: profile.nombre_completo || user.email || 'Usuario', role: nextRole, user, perfil: profile })
      setScreen('portal')
      setConnection('Portal seguro de Bienestar Universitario')
    }).catch(() => { if (mounted) setConnection('Modo local · sin sesión activa') })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const updateScroll = () => setShowTop(window.scrollY > 420)
    window.addEventListener('scroll', updateScroll, { passive: true })
    return () => window.removeEventListener('scroll', updateScroll)
  }, [])

  const role = session?.role || 'user'
  const contribution = profileType === 'student' ? 5000 : 12000
  const approvedTotal = useMemo(() => appointments.filter((item) => item.payment === 'Aprobado').reduce((total, item) => total + item.amount, 0), [appointments])

  const enterDemo = (nextRole) => {
    const names = { user: 'Camila Rodríguez', professional: 'Valentina Rojas', admin: 'Laura Mendoza' }
    setSession({ name: names[nextRole], role: nextRole, demo: true })
    setTab('summary')
    setScreen('portal')
    setNotice(null)
  }

  async function handleLogin(event) {
    event.preventDefault()
    const form = event.currentTarget
    setLoading(true)
    setNotice(null)
    try {
      if (!supabaseConfigurado || !supabase) throw new Error('El servicio de autenticación no está configurado.')
      const { data, error } = await supabase.auth.signInWithPassword({ email: form.email.value.trim().toLowerCase(), password: form.password.value })
      if (error) throw error
      const { data: profile, error: profileError } = await supabase.from('perfiles').select('*').eq('id', data.user.id).single()
      if (profileError || !profile || profile.activo === false) {
        await supabase.auth.signOut()
        throw new Error(profile?.activo === false ? 'Esta cuenta está desactivada. Contacta al administrador.' : 'No se encontró el perfil de esta cuenta.')
      }
      const roles = { usuario: 'user', profesional: 'professional', administrador: 'admin' }
      const nextRole = roles[profile.rol]
      if (!nextRole) {
        await supabase.auth.signOut()
        throw new Error('Esta cuenta no tiene un rol válido asignado.')
      }
      setSession({ name: profile.nombre_completo || data.user.email?.split('@')[0] || 'Usuario', role: nextRole, user: data.user, perfil: profile })
      setTab('summary')
      setScreen('portal')
    } catch (error) {
      setNotice({ tone: 'warning', text: error.message || 'No fue posible iniciar sesión. Verifica tus datos.' })
    } finally { setLoading(false) }
  }

  async function handleRegister(event) {
    event.preventDefault()
    const form = event.currentTarget
    const email = form.email.value.trim().toLowerCase()
    const userType = form.userType.value
    const file = form.referral.files[0]
    if (file && (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)) {
      setNotice({ tone: 'warning', text: 'El documento de remisión debe ser PDF, JPG, PNG o WEBP y no superar 8 MB.' })
      return
    }
    if (!form.querySelector('input[type="checkbox"]')?.checked) {
      setNotice({ tone: 'warning', text: 'Debes aceptar el tratamiento de tus datos para crear la cuenta.' })
      return
    }
    if (!supabaseConfigurado || !supabase) {
      setNotice({ tone: 'warning', text: 'El servicio de autenticación no está configurado.' })
      return
    }
    setLoading(true)
    setNotice(null)
    try {
      const preference = { Mañana: 'manana', Tarde: 'tarde', Indiferente: 'indiferente' }[form.preference.value]
      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password.value,
        options: { data: {
          nombre_completo: form.fullName.value.trim(), tipo_usuario: userType,
          tipo_documento: form.documentType.value, numero_documento: form.documentNumber.value.trim(),
          fecha_nacimiento: form.birthDate.value, telefono: form.phone.value.trim(), direccion: form.address.value.trim(),
          horario_preferido: preference, consentimiento_datos_en: new Date().toISOString(),
        } },
      })
      if (error) throw error
      if (data.session) {
        if (file && data.user) {
          const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
          const path = `${data.user.id}/${crypto.randomUUID()}.${extension}`
          const { error: uploadError } = await supabase.storage.from('documentos-remision').upload(path, file, { upsert: false, contentType: file.type })
          if (uploadError) throw uploadError
          const { error: profileError } = await supabase.from('perfiles').update({ documento_remision_path: path }).eq('id', data.user.id)
          if (profileError) throw profileError
        }
        form.reset()
        setNotice({ tone: 'success', text: 'Cuenta creada. Ya puedes iniciar sesión.' })
        setScreen('login')
      } else {
        setNotice({ tone: 'warning', text: 'Supabase todavía exige confirmar el correo. Desactiva Confirm email en Authentication → Sign In / Providers → Email para crear cuentas sin enviar códigos.' })
      }
    } catch (error) {
      setNotice({ tone: 'warning', text: error.message || 'No fue posible crear la cuenta.' })
    } finally { setLoading(false) }
  }

  async function handlePasswordRecovery(event) {
    event.preventDefault()
    setLoading(true)
    setNotice(null)
    try {
      if (!supabaseConfigurado || !supabase) throw new Error('El servicio de autenticación no está configurado.')
      const email = event.currentTarget.email.value.trim().toLowerCase()
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) throw error
      setNotice({ tone: 'success', text: 'Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.' })
    } catch (error) {
      setNotice({ tone: 'warning', text: error.message || 'No se pudo solicitar la recuperación.' })
    } finally { setLoading(false) }
  }

  async function handlePasswordUpdate(event) {
    event.preventDefault()
    const password = event.currentTarget.password.value
    if (password.length < 8) return setNotice({ tone: 'warning', text: 'La contraseña debe tener al menos 8 caracteres.' })
    if (password !== event.currentTarget.confirmPassword.value) return setNotice({ tone: 'warning', text: 'Las contraseñas no coinciden.' })
    setLoading(true)
    setNotice(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      await supabase.auth.signOut()
      setScreen('login')
      setNotice({ tone: 'success', text: 'Contraseña actualizada. Ya puedes iniciar sesión.' })
    } catch (error) {
      setNotice({ tone: 'warning', text: error.message || 'No se pudo actualizar la contraseña.' })
    } finally { setLoading(false) }
  }

  function reportPayment(event) {
    event.preventDefault()
    if (!slot || reference.trim().length < 5) return
    setAppointments((current) => [{ id: `CIT-${2403 + current.length}`, patient: session?.name || 'Usuario', code: 'P-042', professional: 'Ps. Valentina Rojas', date: slot[1], time: slot[2], room: 'Por confirmar', status: 'Pendiente de validación', payment: 'Reportado', amount: contribution, reference: reference.trim().toUpperCase() }, ...current])
    setReference('')
    setBookingStep('done')
  }

  function approvePayment(id) {
    setAppointments((current) => current.map((item) => item.id === id ? { ...item, payment: 'Aprobado', status: 'Confirmada', room: item.room === 'Por confirmar' ? 'Consultorio 204' : item.room } : item))
    setNotice({ tone: 'success', text: 'El aporte fue validado y la cita quedó confirmada.' })
  }

  function setAppointmentStatus(id, status) {
    const current = appointments.find((item) => item.id === id)
    if (status === 'Cancelada' && current && !window.confirm(`¿Seguro que deseas cancelar la cita ${id} de ${current.patient}?`)) return
    setAppointments((current) => current.map((item) => item.id === id ? { ...item, status } : item))
    setNotice({ tone: status === 'Cancelada' ? 'warning' : 'success', text: status === 'Cancelada' ? `Cita ${id} cancelada. Informa a ${current.patient} al ${current.phone || 'teléfono registrado'} sobre la cancelación.` : `La cita ${id} fue actualizada como ${status.toLowerCase()}.` })
  }

  function addProfessional(event) {
    event.preventDefault()
    const form = event.currentTarget
    setProfessionals((current) => [...current, { id: `PRO-${String(current.length + 1).padStart(2, '0')}`, name: `Ps. ${form.fullName.value.trim()}`, area: form.area.value || 'Atención psicológica', hours: 'Horario por asignar', active: true, schedule: 'Aún no se han definido días de atención' }])
    form.reset()
    setNotice({ tone: 'success', text: 'El perfil del profesional fue creado para esta demostración.' })
  }

  async function logout() {
    if (supabaseConfigurado && !session?.demo) await supabase.auth.signOut()
    setSession(null)
    setScreen('home')
    setNotice(null)
  }

  return <div className="app">
    <div className="utility"><span className="online-dot" />{connection}<span>Atención psicológica · Soacha</span></div>
    {screen === 'home' && <><Header goHome={() => setScreen('home')} openLogin={() => { setNotice(null); setScreen('login') }} openRegister={() => { setNotice(null); setScreen('register') }} /><Home openLogin={() => setScreen('login')} openRegister={() => setScreen('register')} demo={() => enterDemo('user')} /></>}
    {screen === 'login' && <Login submit={handleLogin} notice={notice} loading={loading} home={() => setScreen('home')} register={() => { setNotice(null); setScreen('register') }} recover={() => { setNotice(null); setScreen('recover') }} demo={enterDemo} />}
    {screen === 'register' && <Register todayMs={openedAt.getTime()} submit={handleRegister} notice={notice} loading={loading} home={() => setScreen('home')} login={() => { setNotice(null); setScreen('login') }} />}
    {screen === 'recover' && <AuthMessage title="Recupera tu contraseña" description="Te enviaremos un enlace seguro a tu correo electrónico." notice={notice} home={() => setScreen('login')}><form className="login-form" onSubmit={handlePasswordRecovery}><label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label><Button className="dark full" type="submit" disabled={loading}>{loading ? 'Enviando…' : 'Enviar instrucciones'}</Button></form></AuthMessage>}
    {screen === 'reset-password' && <AuthMessage title="Crea una contraseña nueva" description="Usa al menos 8 caracteres para proteger tu cuenta." notice={notice} home={() => setScreen('login')}><form className="login-form" onSubmit={handlePasswordUpdate}><label>Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label>Confirmar contraseña<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label><Button className="dark full" type="submit" disabled={loading}>{loading ? 'Guardando…' : 'Actualizar contraseña'}</Button></form></AuthMessage>}
    {screen === 'portal' && <Portal openedAt={openedAt} role={role} session={session} tab={tab} setTab={setTab} logout={logout} notice={notice} clearNotice={() => setNotice(null)} appointments={appointments} professionals={professionals} setProfessionals={setProfessionals} adminPhoto={adminPhoto} setAdminPhoto={setAdminPhoto} contribution={contribution} profileType={profileType} setProfileType={setProfileType} slot={slot} setSlot={setSlot} bookingStep={bookingStep} setBookingStep={setBookingStep} reference={reference} setReference={setReference} reportPayment={reportPayment} approvePayment={approvePayment} setAppointmentStatus={setAppointmentStatus} addProfessional={addProfessional} approvedTotal={approvedTotal} />}
    {screen !== 'portal' && <div className="floating-navigation" aria-label="Navegación rápida"><button type="button" onClick={() => screen === 'register' ? setScreen('home') : setScreen('home')}>← <span>Atrás</span></button><button className="floating-home" type="button" aria-label="Inicio" onClick={() => { setScreen('home'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>⌂</button></div>}
    {screen === 'portal' && role === 'user' && tab === 'book' && bookingStep === 'schedule' && <button className="booking-next" type="button" onClick={() => slot ? setBookingStep('payment') : setNotice({ tone: 'warning', text: 'Selecciona un horario para continuar.' })}>Siguiente →</button>}
    {showTop && <button className="back-to-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑ <span>Volver arriba</span></button>}
    {showCookies && <CookieBanner onChoice={(choice) => { localStorage.setItem('uniminuto-cookie-choice', choice); setShowCookies(false) }} />}
    <ChatAssistant />
  </div>
}

function Mark() { return <img className="mark-logo" src="/logo-capbe-rgh.png" alt="Centro de Atención Psicológica y Bienestar Emocional Rafael García Herrera" /> }
function Brand({ short = false }) { return <div className="brand"><Mark />{!short && <span><b>UNIMINUTO</b><small>Bienestar Universitario</small></span>}</div> }
function Avatar({ name, src, className = '' }) { return src ? <img className={`avatar-image ${className}`} src={src} alt={`Foto de ${name}`} /> : <span className={`avatar-fallback ${className}`} aria-label={`Sin foto de ${name}`}>{name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span> }
function FeedbackModal({ tone, children, onClose }) { return <div className="feedback-overlay" role="presentation"><section className={`feedback-modal ${tone}`} role="alertdialog" aria-modal="true" aria-label={tone === 'error' ? 'Error' : 'Confirmación'}><button type="button" className="feedback-close" onClick={onClose} aria-label="Cerrar mensaje">×</button><i aria-hidden="true">{tone === 'error' ? '!' : '✓'}</i><h2>{tone === 'error' ? 'Revisa la información' : 'Listo'}</h2><p>{children}</p><Button className="dark" type="button" onClick={onClose}>Entendido</Button></section></div> }
function readImageAsDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('No se pudo leer la imagen.')); reader.readAsDataURL(file) }) }
function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }
function Alert({ notice }) { return notice && <div className={`alert ${notice.tone}`} role="status"><Icon>{notice.tone === 'success' ? '✓' : '!'}</Icon><span>{notice.text}</span></div> }
function Status({ children }) { return <span className={`status ${String(children).toLowerCase().replaceAll(' ', '-')}`}>{children}</span> }
function Button({ children, className = '', ...props }) { return <button className={`button ${className}`} {...props}>{children}</button> }

function CookieBanner({ onChoice }) {
  return <aside className="cookie-banner" aria-label="Preferencias de privacidad"><p>Usamos almacenamiento local para recordar tus preferencias y mantener el funcionamiento del portal. Consulta las <a href="https://www.uniminuto.edu/documentos-juridicos-uniminuto" target="_blank" rel="noreferrer">políticas de privacidad</a>.</p><div><button className="cookie-accept" type="button" onClick={() => onChoice('accepted')}>Aceptar</button><button className="cookie-reject" type="button" onClick={() => onChoice('rejected')}>Rechazar</button><a href="https://www.uniminuto.edu/documentos-juridicos-uniminuto" target="_blank" rel="noreferrer">Ver políticas</a></div></aside>
}

function ChatAssistant() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([{ from: 'bot', text: 'Hola, soy el asistente de Bienestar. Puedo orientarte sobre citas, pagos y acceso al portal.' }])
  const answer = (message) => {
    const value = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (value.includes('emergencia') || value.includes('crisis') || value.includes('urgencia') || value.includes('hacerme dano')) return 'Si estás en una emergencia o sientes que podrías hacerte daño, busca ayuda inmediata en el servicio de urgencias más cercano o comunícate con las líneas de emergencia de tu localidad. Este asistente no reemplaza la atención profesional.'
    if (value.includes('cuanto') && (value.includes('aporte') || value.includes('pago'))) return 'El aporte se calcula según el tipo de cuenta y la validación institucional disponible en tu perfil. Consulta el valor vigente en Mi resumen.'
    if (value.includes('pago aprobado') || value.includes('estado de mi pago') || value.includes('comprobante')) return 'Consulta el estado en Mis citas. Si el comprobante está en revisión, el administrador debe validarlo; después verás el estado actualizado.'
    if (value.includes('no hay horario') || value.includes('no aparecen horario') || value.includes('sin horario')) return 'Los horarios disponibles dependen de la asignación de un profesional y de su agenda activa. Prueba otra fecha o contacta al equipo de Bienestar para revisar la asignación.'
    if (value.includes('cancelar') || value.includes('reprogramar') || value.includes('cambiar cita')) return 'Entra a Mis citas. Si faltan más de 24 horas, desde allí podrás cancelar o reprogramar una cita según las reglas del servicio.'
    if (value.includes('registr') || value.includes('crear cuenta')) return 'Selecciona Crear cuenta y completa tus datos. Puedes usar cualquier correo válido; el acceso depende de que Supabase permita el registro sin confirmación por correo.'
    if (value.includes('olvide') || value.includes('recuperar contrasena') || value.includes('restablecer')) return 'En la pantalla de inicio de sesión selecciona ¿Olvidaste tu contraseña? y sigue las instrucciones que llegarán a tu correo.'
    if (value.includes('contrasena') || value.includes('acceso') || value.includes('ingresar') || value.includes('iniciar sesion')) return 'Ingresa con el correo y la contraseña de tu cuenta. Si olvidaste la contraseña, usa la opción de recuperación en la pantalla de inicio.'
    if (value.includes('cita') || value.includes('agenda') || value.includes('horario')) return 'Abre Agendar cita, elige el servicio y una fecha. La página consultará los horarios activos de tu profesional asignado.'
    return 'Gracias por escribirnos. Puedo ayudarte con agendamiento, aportes, acceso al portal o información general del servicio.'
  }
  const send = (message) => {
    const clean = message.trim()
    if (!clean) return
    setMessages((current) => [...current, { from: 'user', text: clean }, { from: 'bot', text: answer(clean) }])
    setText('')
  }
  return <aside className={`chatbot ${open ? 'open' : ''}`} aria-label="Asistente de Bienestar">
    {open && <section className="chatbot-panel"><header><div><span className="chatbot-avatar">♡</span><p><b>Asistente de Bienestar</b><small><i /> En línea</small></p></div><button type="button" aria-label="Cerrar asistente" onClick={() => setOpen(false)}>×</button></header><div className="chatbot-notice">Orientación general. No reemplaza la atención psicológica ni la atención de emergencias.</div><div className="chatbot-messages" aria-live="polite">{messages.map((message, index) => <p key={`${message.from}-${index}`} className={message.from}>{message.text}</p>)}</div><div className="chatbot-prompts"><button type="button" onClick={() => send('Quiero agendar una cita')}>Agendar una cita</button><button type="button" onClick={() => send('Tengo una pregunta sobre pagos')}>Aportes y pagos</button></div><form onSubmit={(event) => { event.preventDefault(); send(text) }}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Escribe tu consulta..." aria-label="Escribe tu consulta" /><button type="submit" aria-label="Enviar mensaje">↑</button></form></section>}
    <button className="chatbot-trigger" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span>{open ? '×' : '◌'}</span><b>{open ? 'Cerrar' : '¿Necesitas ayuda?'}</b></button>
  </aside>
}

function Header({ goHome, openLogin, openRegister }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return <header className="header"><button className="brand-button" type="button" onClick={goHome}><Brand /></button><button className="menu-toggle" type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? '×' : '☰'}</button><nav className={menuOpen ? 'menu-open' : ''}><button type="button" onClick={() => { goHome(); setMenuOpen(false) }}>Inicio</button><a href="#servicios" onClick={() => setMenuOpen(false)}>Servicios</a><a href="#proceso" onClick={() => setMenuOpen(false)}>Cómo funciona</a></nav><div><button className="plain" type="button" onClick={openRegister}>Crear cuenta</button><Button className="dark" type="button" onClick={openLogin}>Ingresar <Icon>→</Icon></Button></div></header>
}

function Home({ openLogin, openRegister, demo }) {
  return <main>
    <section className="mission-vision" aria-label="Misión y visión institucional">
      <article><span>PROPÓSITO INSTITUCIONAL</span><h2>Misión UNIMINUTO</h2><p>Formar profesionales íntegros, con sentido social, comprometidos con el desarrollo humano y sostenible de la comunidad.</p></article>
      <article><span>HORIZONTE INSTITUCIONAL</span><h2>Visión UNIMINUTO</h2><p>Ser reconocida como una institución de educación superior de alta calidad, innovadora e incluyente, que transforma vidas y territorios.</p></article>
    </section>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">BIENESTAR UNIVERSITARIO</p><h1>Tu bienestar merece un espacio para <em>ser escuchado.</em></h1><p>Agenda, consulta y gestiona tu atención psicológica en un portal claro, privado y pensado para ti.</p><div className="hero-actions"><Button className="orange" type="button" onClick={openLogin}>Solicitar una cita <Icon>→</Icon></Button><Button className="ghost" type="button" onClick={demo}>Conocer el portal</Button></div><div className="trust"><span>⌾ Información con acceso por roles</span><span>◷ Agenda organizada</span></div></div><HeroArt /></section>
    <section className="soacha-band"><b>UNIMINUTO · Centro Regional Soacha</b><span>Atención integral y acompañamiento al estudiante · Soacha, Cundinamarca</span><div className="soacha-links"><a href="https://www.uniminuto.edu/oferta-academica" target="_blank" rel="noreferrer">Oferta académica ↗</a><a href="https://www.uniminuto.edu/articulo/directorio-uniminuto-centro-universitario-soacha" target="_blank" rel="noreferrer">Contacto de sede ↗</a></div></section>
    <section className="strip"><span>Atención para estudiantes, docentes, administrativos y comunidad externa.</span><button type="button" onClick={openRegister}>Regístrate para comenzar <Icon>→</Icon></button></section>
    <section className="section" id="servicios"><div className="section-intro"><p className="eyebrow">EL PORTAL</p><h2>Todo lo necesario para organizar tu atención.</h2><p>Una experiencia simple para pedir acompañamiento y una gestión ordenada para el equipo institucional.</p></div><div className="features"><Feature number="01" icon="▣" title="Agenda disponible" text="Consulta los espacios habilitados por tu profesional asignado y solicita la fecha que te funciona." /><Feature number="02" icon="◈" title="Aporte claro" text="Revisa el valor correspondiente, paga con Bre-B y reporta el número de aprobación." /><Feature number="03" icon="◌" title="Seguimiento oportuno" text="Consulta el estado de la solicitud, tus citas y los avisos relevantes desde un solo lugar." /></div></section>
    <section className="process" id="proceso"><div><p className="eyebrow">UN PROCESO SENCILLO</p><h2>Solicita tu atención en tres pasos.</h2></div><ol><li><b>1</b><span><strong>Ingresa a tu cuenta</strong><small>Registra y confirma tu correo.</small></span></li><li><b>2</b><span><strong>Elige un horario</strong><small>Visualiza los espacios disponibles.</small></span></li><li><b>3</b><span><strong>Reporta tu aporte</strong><small>Escanea el QR Bre-B y registra la aprobación.</small></span></li></ol></section>
    <section className="cta"><div><p className="eyebrow">EMPIEZA HOY</p><h2>Tu salud mental también es prioridad.</h2><p>Accede a un espacio de escucha, orientación y acompañamiento.</p></div><Button className="orange" type="button" onClick={openLogin}>Ingresar al portal <Icon>→</Icon></Button></section>
    <Footer />
  </main>
}

function HeroArt() { return <div className="hero-art" aria-label="Ilustración de acompañamiento psicológico"><i className="sun" /><i className="shape-one" /><i className="shape-two" /><div className="hero-card"><span className="heart">♡</span><small>Tu cita, a tu ritmo</small><b>Atención con acompañamiento</b><div><i /><i /><i /></div></div><div className="appointment-bubble"><span>VR</span><p><b>Ps. Valentina</b><small>Próxima disponibilidad</small></p><em>✓</em></div></div> }
function Feature({ number, icon, title, text }) { return <article className="feature"><span className="feature-number">{number}</span><i>{icon}</i><h3>{title}</h3><p>{text}</p></article> }
function Footer() { return <footer><Brand /><p>Portal de Bienestar Universitario · Sistema de gestión de citas psicológicas</p><small>UNIMINUTO · Centro Universitario Regional Soacha<br /><a href="https://www.uniminuto.edu/documentos-juridicos-uniminuto" target="_blank" rel="noreferrer">Políticas de privacidad</a> · <a href="https://www.uniminuto.edu/terminos-y-condiciones-blog" target="_blank" rel="noreferrer">Términos y condiciones</a></small></footer> }

function Login({ submit, notice, loading, home, register, recover, demo }) {
  return <main className="auth-page"><aside><Brand /><div><p className="eyebrow">PORTAL DE BIENESTAR</p><h1>Un lugar seguro para empezar.</h1><p>Accede a tus citas, notificaciones y solicitudes de atención desde un único lugar.</p></div><ul><li>⌾ Tus datos se muestran según el rol autorizado.</li><li>♡ Atención organizada y centrada en las personas.</li></ul></aside><section><button className="back" type="button" onClick={home}>← Volver al inicio</button><form className="login-form" onSubmit={submit}><p className="eyebrow">INICIAR SESIÓN</p><h2>Te damos la bienvenida.</h2><p>Ingresa con el correo y contraseña registrados.</p><Alert notice={notice} /><label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required /></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" placeholder="Escribe tu contraseña" required /></label><Button className="dark full" type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar al portal'} <Icon>→</Icon></Button><button className="link-button" type="button" onClick={recover}>¿Olvidaste tu contraseña?</button><div className="switch">¿Aún no tienes una cuenta? <button type="button" onClick={register}>Regístrate</button></div></form><div className="demo"><b>Vista de demostración</b><p>Explora los perfiles sin crear ni modificar datos reales.</p><div><button type="button" onClick={() => demo('user')}>Usuario</button><button type="button" onClick={() => demo('professional')}>Profesional</button><button type="button" onClick={() => demo('admin')}>Administrador</button></div></div></section></main>
}

function AuthMessage({ title, description, notice, home, children }) {
  return <main className="auth-page"><aside><Brand /><div><p className="eyebrow">PORTAL DE BIENESTAR</p><h1>Tu cuenta, bajo tu control.</h1><p>Recupera el acceso de forma segura desde tu correo.</p></div></aside><section><button className="back" type="button" onClick={home}>← Volver al inicio de sesión</button><div className="login-form"><p className="eyebrow">RECUPERACIÓN DE CUENTA</p><h2>{title}</h2><p>{description}</p><Alert notice={notice} />{children}</div></section></main>
}

function Register({ submit, notice, loading, home, login, todayMs }) {
  const [birth, setBirth] = useState('')
  const age = birth ? Math.max(0, Math.floor((todayMs - new Date(birth).getTime()) / 31557600000)) : ''
  return <main className="register-page"><aside><Brand /><p className="eyebrow">CREA TU CUENTA</p><h1>Comienza tu proceso de atención.</h1><p>Completa la información inicial. Los campos con <b>*</b> son obligatorios.</p><div className="privacy"><i>⌾</i><span><strong>Información protegida</strong><small>Los documentos de identidad, dirección y remisión serán de acceso exclusivo del equipo administrador autorizado.</small></span></div><button className="back" type="button" onClick={home}>← Volver al inicio</button></aside><form className="registration" onSubmit={submit}><div><p className="eyebrow">REGISTRO</p><h2>Datos de la persona</h2><p>El equipo revisará tu perfil después de crear la cuenta.</p></div><Alert notice={notice} /><div className="form-grid"><Field label="Nombre completo" required><input name="fullName" placeholder="Escribe tu nombre completo" required /></Field><Field label="Tipo de documento" required><select name="documentType" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Tarjeta de identidad</option><option>Cédula de extranjería</option><option>Pasaporte</option></select></Field><Field label="Número de documento" required><input name="documentNumber" inputMode="numeric" placeholder="Sin puntos ni espacios" required /></Field><Field label="Fecha de nacimiento" required><input name="birthDate" type="date" value={birth} onChange={(event) => setBirth(event.target.value)} required /></Field><Field label="Edad calculada"><input value={age === '' ? 'Se calcula automáticamente' : `${age} años`} readOnly /></Field><Field label="Teléfono de contacto" required><input name="phone" type="tel" placeholder="300 000 0000" required /></Field><Field label="Dirección" required wide><input name="address" placeholder="Dirección de residencia" required /></Field><Field label="Correo electrónico" required><input name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required /></Field><Field label="Tipo de usuario" required><select name="userType" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option value="estudiante">Estudiante UNIMINUTO</option><option value="docente">Docente</option><option value="administrativo">Administrativo</option><option value="externo">Usuario externo</option></select></Field><Field label="Jornada de preferencia" required><select name="preference" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Mañana</option><option>Tarde</option><option>Indiferente</option></select></Field><Field label="Documento de remisión (opcional)" wide><input name="referral" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" /><small>PDF, JPG, PNG o WEBP · Máximo 8 MB</small></Field><Field label="Crear contraseña" required wide><input name="password" type="password" minLength="8" autoComplete="new-password" placeholder="Mínimo 8 caracteres" required /></Field></div><ConsentDocuments age={age} /><label className="consent"><input type="checkbox" required /><span>Autorizo el tratamiento de mis datos personales y confirmo que la información suministrada es veraz. <b>*</b></span></label><Button className="dark full" type="submit" disabled={loading}>{loading ? 'Creando cuenta...' : 'Crear cuenta'} <Icon>→</Icon></Button><div className="switch">¿Ya tienes cuenta? <button type="button" onClick={login}>Inicia sesión</button></div></form></main>
}
function ConsentDocuments({ age }) {
  const documents = [
    ['consentimiento-informado-adulto.pdf', 'Consentimiento informado para adultos'],
    ['consentimiento-menores-nna.pdf', 'Consentimiento para evaluación y tratamiento de menores'],
    ['asentimiento-adolescente.pdf', 'Asentimiento para adolescentes de 14 a 17 años'],
    ['asentimiento-ninos.pdf', 'Asentimiento informado para niños y niñas'],
  ]
  const guidance = age === '' ? 'Indica tu fecha de nacimiento para ver cuáles documentos corresponden a tu edad.' : age >= 18 ? 'Por tu edad, revisa el consentimiento informado para adultos antes de tu atención.' : age >= 14 ? 'Para menores de edad, revisa el consentimiento NNA con tu acudiente y el asentimiento para adolescentes.' : 'Para niños y niñas, revisa el consentimiento NNA con tu acudiente y el asentimiento infantil.'
  return <section className="consent-documents" aria-labelledby="consent-documents-title"><h3 id="consent-documents-title">Documentos para la atención psicológica</h3><p>{guidance}</p><ul>{documents.map(([file, title]) => <li key={file}><a href={`/documentos/${file}`} target="_blank" rel="noreferrer">{title} <span>PDF ↗</span></a></li>)}</ul><small>Lee el documento que corresponda. El equipo profesional te indicará cómo diligenciarlo. La casilla de registro autoriza únicamente el tratamiento de datos de tu cuenta y no sustituye el consentimiento clínico.</small></section>
}
function Field({ label, required, wide, children }) { return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}{required && <b> *</b>}</span>{children}</label> }

function Portal(props) {
  const { role, session, tab, setTab, logout, notice, clearNotice, openedAt, adminPhoto, ...dashboardProps } = props
  const autenticado = Boolean(session?.user)
  const nav = autenticado && role === 'admin'
    ? [['summary', 'Gestión', '▤'], ['security', 'Seguridad', '⌾']]
    : autenticado && role === 'professional'
      ? [['summary', 'Mi agenda', '▣']]
      : role === 'admin'
        ? [['summary', 'Resumen', '▦'], ['appointments', 'Agenda', '▣'], ['professionals', 'Profesionales', '◉'], ['patients', 'Pacientes', '☷'], ['reports', 'Seguimiento', '▤'], ['security', 'Seguridad', '⌾']]
        : role === 'professional'
          ? [['summary', 'Mi agenda', '▣'], ['activity', 'Actualizar atención', '✓'], ['availability', 'Disponibilidad', '◷']]
          : [['summary', 'Mi resumen', '▦'], ['book', 'Agendar cita', '▣'], ['history', 'Mis citas', '◷'], ['profile', 'Mi perfil', '◉']]
  const fechaActual = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(openedAt)
  const vistaUsuario = tab === 'book' ? 'solicitar-cita' : tab === 'summary' ? 'resumen' : tab === 'profile' ? 'perfil' : 'mis-citas'
  return <main className="portal"><aside className="sidebar"><Brand short /><p>{role === 'admin' ? 'ADMINISTRADOR' : role === 'professional' ? 'PROFESIONAL' : 'USUARIO'}</p><nav>{nav.map(([id, label, icon]) => <button key={id} className={tab === id ? 'active' : ''} type="button" onClick={() => { setTab(id); clearNotice() }}><i>{icon}</i><span>{label}</span></button>)}</nav><button className="account" type="button" onClick={() => role === 'admin' && setTab('security')} title="Abrir seguridad de cuenta"><Avatar name={session?.name || 'Usuario'} src={role === 'admin' ? adminPhoto : ''} /><p><b>{session?.name}</b><small>{role === 'admin' ? 'Seguridad de cuenta' : role === 'professional' ? 'Profesional' : 'Usuario'}</small></p></button><button className="logout" type="button" onClick={logout}>↪ <span>Cerrar sesión</span></button></aside><section className="portal-main"><header className="portal-header"><div><p>Portal de Bienestar / {role === 'admin' ? 'Administrador' : role === 'professional' ? 'Profesional' : 'Usuario'}</p><h1>{autenticado && role === 'user' ? `Hola, ${session.name.split(' ')[0]}` : autenticado && role === 'admin' && tab === 'summary' ? 'Gestión del servicio' : titleFor(role, tab)}</h1></div><div><span>{fechaActual}</span></div></header><Alert notice={notice} />{role === 'user' && (autenticado ? <Suspense fallback={<p className="panel-loading">Cargando tu perfil…</p>}><PanelUsuario supabase={supabase} usuario={session.user} perfil={session.perfil} vista={vistaUsuario} /></Suspense> : <UserDashboard {...dashboardProps} />)}{role === 'professional' && (autenticado ? <Suspense fallback={<p className="panel-loading">Cargando tu agenda…</p>}><PanelProfesional supabase={supabase} usuario={session.user} /></Suspense> : <ProfessionalDashboard {...dashboardProps} />)}{role === 'admin' && (autenticado && tab !== 'security' ? <Suspense fallback={<p className="panel-loading">Cargando gestión…</p>}><PanelAdministrador supabase={supabase} usuario={session.user} /></Suspense> : <AdminDashboard {...dashboardProps} adminPhoto={adminPhoto} />)}</section></main>
}
function titleFor(role, tab) { return ({ user: { summary: 'Hola, Camila', book: 'Agenda tu cita', history: 'Mis citas', profile: 'Mi perfil' }, professional: { summary: 'Mi agenda de hoy', activity: 'Actualizar atención', availability: 'Disponibilidad' }, admin: { summary: 'Resumen general', professionals: 'Profesionales', appointments: 'Gestión de citas', patients: 'Pacientes', reports: 'Reportes y seguimiento', security: 'Seguridad de cuenta' } })[role][tab] }

function UserDashboard({ tab, appointments, contribution, profileType, setProfileType, slot, setSlot, bookingStep, setBookingStep, reference, setReference, reportPayment }) {
  if (tab === 'book') return <Booking contribution={contribution} profileType={profileType} setProfileType={setProfileType} slot={slot} setSlot={setSlot} step={bookingStep} setStep={setBookingStep} reference={reference} setReference={setReference} reportPayment={reportPayment} />
  if (tab === 'history') return <Card title="Tus solicitudes y citas" text="Consulta el estado de cada atención."><Table items={appointments.filter((item) => item.patient === 'Camila R.' || item.patient === 'Camila Rodríguez' || item.code === 'P-042')} /></Card>
  if (tab === 'profile') return <div className="profile-grid"><Card title="Información personal" text="Los campos sensibles se muestran protegidos." badge="Verificado"><div className="details"><Detail label="Nombre" value="Camila Rodríguez" /><Detail label="Correo" value="camila.r@correo.com" /><Detail label="Documento" value="•••• 4821" /><Detail label="Jornada" value="Mañana" /></div><Button className="dark" type="button">Solicitar actualización</Button></Card><Card extra="change" title="¿Necesitas cambiar de profesional?" text="Envía tu solicitud. El administrador revisará el caso y te informará la decisión."><Button className="soft" type="button">Solicitar cambio</Button></Card></div>
  const next = appointments[0]
  return <><section className="welcome"><div><p>Tu próximo espacio</p><h2>{next.date} · {next.time}</h2><span>◉ {next.professional} · {next.room}</span></div><Status>{next.status}</Status></section><div className="stats"><Stat icon="▣" label="Citas realizadas" value="4" text="En el último semestre" /><Stat icon="◷" label="Próxima cita" value="14 Oct" text="9:00 a. m." /><Stat icon="◇" label="Aporte actual" value={money(contribution)} text="Según tu tipo de usuario" /></div><div className="columns"><Card title="¿Qué necesitas hacer?" text="Acceso rápido"><div className="quick"><button type="button"><i>▣</i><b>Consultar agenda</b><small>Elige un horario disponible</small></button><button type="button"><i>▤</i><b>Ver mis citas</b><small>Confirma o gestiona solicitudes</small></button><button type="button"><i>◉</i><b>Solicitar cambio</b><small>Envía la solicitud al administrador</small></button></div></Card><Card extra="rules" title="Política de citas"><ul><li>Modifica o cancela con mínimo 24 horas de anticipación.</li><li>Después de 15 minutos de retraso la cita se registra como incumplida.</li><li>Tras un incumplimiento podrás solicitar una nueva cita después de 8 días.</li></ul></Card></div></>
}

function Booking({ contribution, profileType, setProfileType, slot, setSlot, step, setStep, reference, setReference, reportPayment }) {
  if (step === 'done') return <div className="success-card"><i>✓</i><p className="eyebrow">SOLICITUD RECIBIDA</p><h2>Reportaste el aporte correctamente.</h2><p>El equipo administrador validará el número de aprobación. Recibirás una notificación cuando tu cita quede confirmada.</p><Button className="dark" type="button" onClick={() => { setStep('schedule'); setSlot(null) }}>Ver mis citas <Icon>→</Icon></Button></div>
  if (step === 'payment') return <div className="booking-grid"><Card title="Escanea y paga desde tu entidad financiera" text={<>Abre la zona Bre-B de la aplicación de tu entidad, escanea el código y completa el pago por <b>{money(contribution)}</b>.</>}><Steps current={2} /><div className="qr-box"><Qr /><div><b>QR Bre-B institucional</b><span>Referencia de tu cita: {slot[0]}</span><small>Vista de demostración. Antes de recibir pagos reales debe configurarse el QR de comercio asignado por la entidad financiera.</small></div></div><form onSubmit={reportPayment}><Field label="Número de aprobación" required><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej. BRB-740021" required /><small>Registra el comprobante que aparece al finalizar el pago.</small></Field><div className="form-actions"><Button className="ghost" type="button" onClick={() => setStep('schedule')}>Cambiar horario</Button><Button className="dark" type="submit">Reportar aporte <Icon>→</Icon></Button></div></form></Card><BookingSummary contribution={contribution} slot={slot} /></div>
  return <div className="booking-grid"><Card title="Elige el horario que prefieras" text="Solo se muestran espacios habilitados por tu profesional asignado."><Steps current={1} /><div className="type-choice"><b>Tipo de aporte</b><div><button className={profileType === 'student' ? 'selected' : ''} type="button" onClick={() => setProfileType('student')}>Estudiante · {money(5000)}</button><button className={profileType === 'other' ? 'selected' : ''} type="button" onClick={() => setProfileType('other')}>Otro usuario · {money(12000)}</button></div></div><div className="slots">{slots.map((item) => <button className={slot?.[0] === item[0] ? 'selected' : ''} key={item[0]} type="button" onClick={() => setSlot(item)}><span><b>{item[1]}</b><small>Ps. Valentina Rojas · Consultorio por confirmar</small></span><strong>{item[2]}</strong></button>)}</div><div className="form-actions"><small>{slot ? `Horario seleccionado: ${slot[2]}` : 'Selecciona un horario para continuar.'}</small><Button className="dark" type="button" disabled={!slot} onClick={() => setStep('payment')}>Continuar al aporte <Icon>→</Icon></Button></div></Card><aside className="summary"><p>ANTES DE AGENDAR</p><h3>Tu profesional es asignado por Bienestar.</h3><span>No necesitas elegirlo. Si requieres un cambio, puedes enviar una solicitud al administrador desde tu perfil.</span><div><i>VR</i><p><b>Ps. Valentina Rojas</b><small>Psicología clínica</small></p></div></aside></div>
}
function Steps({ current }) { return <div className="steps"><i className={current > 1 ? 'done' : current === 1 ? 'current' : ''}>1</i><b /><i className={current === 2 ? 'current' : ''}>2</i><b /><i>3</i></div> }
function Qr() { const squares = new Set([0,1,2,4,5,8,9,10,12,13,14,16,18,20,21,24,25,28,31,32,34,35,36,38,40,41,42,43,45,47,48,50,52,53,55,56,57,59,61,63,64,66,67,68,70,71,72,75,76,78,80]); return <div className="qr">{Array.from({ length: 81 }, (_, index) => <i className={squares.has(index) ? 'filled' : ''} key={index} />)}<b>B</b></div> }
function BookingSummary({ contribution, slot }) { return <aside className="summary"><p>RESUMEN DE LA SOLICITUD</p><h3>Atención psicológica</h3><Detail label="Profesional asignado" value="Ps. Valentina Rojas" /><Detail label="Fecha" value={slot[1]} /><Detail label="Hora" value={slot[2]} /><div className="total"><span>Total a pagar</span><b>{money(contribution)}</b></div></aside> }

function ProfessionalDashboard({ tab, appointments, setAppointmentStatus }) {
  const agenda = appointments.filter((item) => item.professional === 'Ps. Valentina Rojas')
  if (tab === 'availability') return <Card title="Horario de atención" text="Este horario es administrado por el equipo de Bienestar." badge="Activo"><div className="availability">{['Lunes','Martes','Miércoles','Jueves','Viernes'].map((day, index) => <div key={day}><b>{day}</b><span>{index === 2 ? 'Sin atención' : '8:00 a. m. - 4:00 p. m.'}</span></div>)}</div><Alert notice={{ tone: 'info', text: 'Si necesitas bloquear un espacio, comunícate con el administrador. El profesional no modifica la agenda general.' }} /></Card>
  if (tab === 'activity') return <Card title="Actualiza el estado de una consulta" text="La información de los pacientes se presenta con un código interno."><Agenda items={agenda} actions itemAction={setAppointmentStatus} /></Card>
  return <><section className="welcome green"><div><p>Martes 14 de octubre</p><h2>Tienes {agenda.length} atenciones programadas.</h2><span>Revisa tu agenda y actualiza el estado de la consulta al finalizar.</span></div><i>▣</i></section><div className="stats"><Stat icon="▣" label="Atenciones hoy" value={String(agenda.length)} text="Programadas en tu agenda" /><Stat icon="✓" label="Atendidas" value="12" text="Durante este mes" /><Stat icon="◷" label="Disponibilidad" value="Activa" text="Lun - Vie · 8 a. m. - 4 p. m." /></div><Card title="Próximas atenciones" text="Agenda de hoy"><Agenda items={agenda} /></Card></>
}
function Agenda({ items, actions, itemAction }) { return <div className="agenda">{items.map((item) => <article key={item.id}><div><strong>{item.time}</strong><p><b>Paciente {item.code}</b><small>{item.date} · {item.room}</small></p></div><Status>{item.status}</Status>{actions ? <span className="agenda-actions"><button type="button" onClick={() => itemAction(item.id, 'Atendida')}>Marcar atendida</button><button type="button" onClick={() => itemAction(item.id, 'No asistió')}>No asistió</button></span> : <Button className="soft" type="button">Ver estado</Button>}</article>)}</div> }

function AdminDashboard({ tab, appointments, professionals, addProfessional, setProfessionals, setAppointmentStatus, adminPhoto, setAdminPhoto }) {
  const [semana, setSemana] = useState('Actual')
  const [filtroPaciente, setFiltroPaciente] = useState('')
  const activos = professionals.filter((p) => p.active !== false)
  const ordenadas = [...appointments].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`, 'es'))
  const alternarProfesional = (id) => setProfessionals((current) => current.map((p) => p.id === id ? { ...p, active: !p.active } : p))
  async function cambiarFoto(id, file) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) return window.alert('Usa JPG, PNG o WEBP de máximo 2 MB.')
    const photo = await readImageAsDataUrl(file)
    setProfessionals((current) => {
      const next = current.map((person) => person.id === id ? { ...person, photo } : person)
      localStorage.setItem('bienestar_professional_photos', JSON.stringify(next))
      return next
    })
  }
  if (tab === 'professionals') return <div className="admin-grid"><Card title="Profesionales activos y próximos" text="Consulta quién atiende hoy; agrega una foto para identificar al equipo." badge={`${activos.length} activos`}><div className="week-tabs">{['Anterior','Actual','Siguiente'].map((x) => <button className={semana === x ? 'selected' : ''} type="button" key={x} onClick={() => setSemana(x)}>Semana {x.toLowerCase()}</button>)}</div><p className="ayuda">Horario de la semana {semana.toLowerCase()}: cada bloque indica atención y descanso programado.</p><div className="people">{professionals.map((person) => <article key={person.id}><Avatar name={person.name} src={person.photo} /><p><b>{person.name}</b><small>{person.area}</small><small>{person.schedule || person.hours}</small><label className="photo-picker">Agregar foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => cambiarFoto(person.id, e.target.files?.[0])} /></label></p><div><Status>{person.active === false ? 'Inactivo' : 'Activo'}</Status><button className="link-action" type="button" onClick={() => alternarProfesional(person.id)}>{person.active === false ? 'Activar' : 'Desactivar'}</button></div></article>)}</div></Card><form className="card pro-form" onSubmit={addProfessional}><p className="eyebrow">NUEVO PERFIL</p><h2>Registrar profesional</h2><p>Crea sus credenciales iniciales. La persona podrá cambiarlas después desde su cuenta.</p><Field label="Nombre completo" required><input name="fullName" placeholder="Nombre y apellido" required /></Field><Field label="Usuario inicial" required><input name="username" placeholder="Ej. vrojas" required /></Field><Field label="Contraseña temporal" required><input name="password" type="password" minLength="8" placeholder="Mínimo 8 caracteres" required /></Field><Button className="dark full" type="submit">＋ Crear profesional</Button></form><Card title="Asignar horario semanal" text="Marca si atiende cada día. Si atiende, registra horario y descanso."><WeeklySchedule professionals={activos} /></Card></div>
  if (tab === 'appointments') return <><Card title="Supervisa la agenda institucional" text="Las citas se muestran de la más próxima a la más lejana. Al cancelar, confirma la acción y comunícala al paciente."><Table items={ordenadas} admin setAppointmentStatus={setAppointmentStatus} /></Card><Card title="Paciente y horario" text="Selecciona un paciente para revisar sus citas pasadas, programadas y consultorio."><select value={filtroPaciente} onChange={(e) => setFiltroPaciente(e.target.value)}><option value="">Selecciona un paciente</option>{appointments.map((a) => <option key={a.code} value={a.code}>{a.patient}</option>)}</select>{filtroPaciente && <Table items={appointments.filter((x) => x.code === filtroPaciente)} />}</Card></>
  if (tab === 'patients') return <PatientDirectory appointments={appointments} professionals={activos} />
  if (tab === 'reports') return <div className="reports"><Card extra="chart-card" title="Pacientes con menor frecuencia" text="Aparecen primero quienes llevan más de un mes sin asistir."><div className="alerta alerta-error">Prioridad: Camila R. y Santiago M. no han asistido en más de 30 días.</div>{appointments.map((a, i) => <Mini key={a.id} icon={String(i + 1)} first={a.patient} second={i < 2 ? 'Más de 30 días sin asistencia' : 'Asistencia frecuente'} badge={i < 2 ? 'Contactar' : 'Al día'} />)}</Card><Card extra="followup" title="Cambio de profesional" text="Elige el nuevo profesional y confirma el cambio."><Mini icon="CR" first="Camila R." second="Solicitud pendiente" badge="Pendiente" /><select><option>Selecciona profesional</option>{activos.map((p) => <option key={p.id}>{p.name}</option>)}</select><Button className="dark full" type="button" onClick={() => window.alert('Cambio registrado en esta demostración.')}>Asignar profesional</Button></Card></div>
  if (tab === 'security') return <SecureAdminSettings adminPhoto={adminPhoto} setAdminPhoto={setAdminPhoto} />
  return <><section className="welcome purple"><div><p>Control administrativo</p><h2>La información clave, en un solo lugar.</h2><span>Usa los accesos rápidos y revisa la disponibilidad del equipo.</span></div><i>▤</i></section><div className="stats four"><Stat icon="▣" label="Citas programadas" value={String(appointments.filter((x) => x.status !== 'Cancelada').length)} text="Ordenadas para gestión" /><Stat icon="◉" label="Profesionales" value={String(activos.length)} text="Perfiles activos" /><Stat icon="♧" label="Seguimientos" value="3" text="Requieren contacto" /><Stat icon="✓" label="Atendidas" value={String(appointments.filter((x) => x.status === 'Atendida').length)} text="Durante el periodo" /></div><div className="columns"><Card title="Agenda del día" text="Quién está atendiendo y quién sigue">{activos.map((p, i) => <Mini key={p.id} icon={i === 0 ? 'Ahora' : 'Sigue'} first={p.name} second={i === 0 ? 'Atiende hasta las 4:00 p. m.' : 'Ingresa a las 9:00 a. m.'} badge={i === 0 ? 'En atención' : 'Próximo'} />)}</Card><Card title="Próximas citas" text="Agenda">{ordenadas.slice(0, 3).map((item) => <Mini key={item.id} icon={item.time.slice(0, 2)} first={item.patient} second={`${item.professional} · ${item.room}`} badge={item.status} />)}</Card></div></>
}

function WeeklySchedule({ professionals }) { const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']; const [on, setOn] = useState({ Lunes:true, Martes:true, Miércoles:true, Jueves:true, Viernes:true }); return <div className="weekly-schedule"><select><option>Selecciona profesional</option>{professionals.map((p) => <option key={p.id}>{p.name}</option>)}</select>{days.map((day) => <label className="day-row" key={day}><input type="checkbox" checked={!!on[day]} onChange={(e) => setOn((v) => ({ ...v, [day]: e.target.checked }))} /> <b>{day}</b>{on[day] && <><input type="time" defaultValue="08:00" /><span>a</span><input type="time" defaultValue="16:00" /><select defaultValue="60"><option value="0">Sin descanso</option><option value="30">Descanso 30 min</option><option value="60">Descanso 1 hora</option></select></>}</label>)}<Button className="dark" type="button" onClick={() => window.alert('Horario guardado en la demostración.')}>Guardar horario</Button></div> }

function PatientDirectory({ appointments, professionals }) {
  const [selected, setSelected] = useState(appointments[0]?.code || '')
  const patientAppointments = appointments.filter((item) => item.code === selected)
  const patient = patientAppointments[0]
  return <div className="admin-grid"><Card title="Directorio de pacientes" text="Busca una persona y revisa rápidamente su agenda y profesional asignado."><label className="patient-picker">Paciente<select value={selected} onChange={(e) => setSelected(e.target.value)}>{appointments.map((item) => <option key={item.code} value={item.code}>{item.patient} · {item.code}</option>)}</select></label>{patient && <div className="patient-summary"><div><b>{patient.patient}</b><span>{patient.phone}</span></div><div><b>Profesional</b><span>{patient.professional}</span></div><div><b>Consultorio</b><span>{patient.room}</span></div></div>}<p className="ayuda">Use la pestaña Agenda para cancelar o modificar el estado de una cita.</p></Card><Card title="Historial y citas programadas" text="Las citas se separan para que sea más fácil atender cada caso."><h3>Próximas</h3><Table items={patientAppointments.filter((item) => !['Atendida','Cancelada','No asistió'].includes(item.status))} /><h3>Historial</h3><Table items={patientAppointments.filter((item) => ['Atendida','Cancelada','No asistió'].includes(item.status))} /></Card><Card title="Reasignar profesional" text="Selecciona un profesional activo; confirma con el paciente antes de guardar."><select><option>Selecciona profesional</option>{professionals.map((person) => <option key={person.id}>{person.name}</option>)}</select><Button className="dark" type="button" onClick={() => window.alert('Reasignación preparada. En producción se guarda tras confirmar al paciente.')}>Preparar reasignación</Button></Card></div>
}

function SecureAdminSettings({ adminPhoto, setAdminPhoto }) {
  const [account, setAccount] = useState({ name: 'Laura Mendoza', email: 'laura@uniminuto.edu.co', phone: '300 000 0000', username: 'laura.mendoza' })
  const [draft, setDraft] = useState(account)
  const [currentPassword, setCurrentPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase.from('perfiles').select('nombre_completo,correo,telefono,usuario').eq('id', data.user.id).single()
      if (!profile) return
      const next = { name: profile.nombre_completo || '', email: profile.correo || data.user.email || '', phone: profile.telefono || '', username: profile.usuario || '' }
      setAccount(next); setDraft(next)
    })
  }, [])
  const emailChanged = draft.email !== account.email
  const phoneChanged = draft.phone !== account.phone
  const profileChanged = emailChanged || phoneChanged || draft.name !== account.name || draft.username !== account.username
  async function saveProfile() {
    if (!supabase) return setError('Configura Supabase para guardar los datos.')
    if (!profileChanged) return setError('No hay cambios para guardar.')
    if (!currentPassword) return setError('Escribe tu contraseña actual para guardar los datos.')
    setBusy(true); setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('admin-account-security', { body: { action: 'profile', password: currentPassword, ...draft } })
    setBusy(false)
    if (invokeError || data?.error) return setError(data?.error || invokeError.message)
    setAccount(draft); setCurrentPassword(''); setMessage('Datos actualizados correctamente.')
  }
  async function requestPasswordCode() {
    if (!supabase) return setError('Configura Supabase para solicitar el código.')
    setBusy(true); setError('')
    const { error: requestError } = await supabase.auth.reauthenticate()
    setBusy(false)
    if (requestError) return setError(requestError.message)
    setMessage('Enviamos un código de 8 dígitos a tu correo. Vence en 5 minutos.')
  }
  async function changePassword() {
    if (verificationCode.length !== 8) return setError('Escribe los 8 dígitos completos del código de verificación.')
    if (newPassword.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres.')
    if (newPassword !== confirmPassword) return setError('Las contraseñas nuevas no coinciden.')
    setBusy(true); setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword, nonce: verificationCode })
    setBusy(false)
    if (updateError) {
      const details = `${updateError.code || ''} ${updateError.message || ''}`.toLowerCase()
      if (details.includes('expired') || details.includes('otp_expired')) return setError('El código expiró. Solicita uno nuevo; cada código vence en 5 minutos.')
      if (details.includes('reauthentication_not_valid') || details.includes('nonce') || details.includes('invalid')) return setError('El código es incorrecto. Verifica los 8 dígitos o solicita uno nuevo.')
      return setError(updateError.message)
    }
    setNewPassword(''); setConfirmPassword(''); setVerificationCode(''); setMessage('Contraseña actualizada correctamente.')
  }
  async function seleccionarFoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Usa JPG, PNG o WEBP de máximo 2 MB.'); return }
    const localPreview = await readImageAsDataUrl(file)
    setAdminPhoto(localPreview)
    localStorage.setItem('bienestar_admin_photo', localPreview)
    if (!supabase) { setMessage('Foto de administrador guardada en este dispositivo.'); return }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setMessage('Foto de administrador guardada en este dispositivo.'); return }
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${data.user.id}/perfil.${extension}`
      const { error: uploadError } = await supabase.storage.from('fotos-perfil').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { error: profileError } = await supabase.from('perfiles').update({ foto_perfil_path: path }).eq('id', data.user.id)
      if (profileError) throw profileError
      const { data: signed, error: signedError } = await supabase.storage.from('fotos-perfil').createSignedUrl(path, 60 * 60)
      if (signedError) throw signedError
      setAdminPhoto(signed.signedUrl); setMessage('Foto de administrador guardada correctamente.')
    }).catch((uploadError) => { setAdminPhoto(localPreview); setError(uploadError.message || 'No se pudo guardar la foto en el servidor.') })
  }
  const closeFeedback = () => { setError(''); setMessage('') }
  return <>{(error || message) && <FeedbackModal tone={error ? 'error' : 'success'} onClose={closeFeedback}>{error || message}</FeedbackModal>}<div className="security-layout"><Card title="Datos del perfil" text="Para guardar cualquier cambio, confirma primero tu contraseña actual."><div className="admin-photo-editor"><Avatar name={account.name} src={adminPhoto} className="avatar-large" /><label className="photo-picker">Agregar o cambiar foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={seleccionarFoto} /></label><small>JPG, PNG o WEBP · máximo 2 MB.</small></div><div className="profile-edit"><Field label="Nombre"><input value={draft.name} maxLength="120" onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field><Field label="Usuario"><input value={draft.username} minLength="3" maxLength="32" pattern="[A-Za-z0-9._-]+" onChange={(e) => setDraft({ ...draft, username: e.target.value })} /><small>3–32 caracteres: letras, números, punto, guion o guion bajo.</small></Field><Field label="Correo electrónico"><input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field><Field label="Teléfono"><input value={draft.phone} inputMode="tel" pattern="\\+[1-9][0-9]{7,14}" onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Ej. +573001234567" /><small>Usa formato internacional con +.</small></Field><Field label="Contraseña actual"><input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Necesaria para guardar cambios" /></Field></div><Button className="dark" type="button" disabled={busy || !profileChanged} onClick={saveProfile}>{busy ? 'Guardando…' : 'Guardar datos'}</Button></Card><Card title="Cambiar contraseña" text="Solicita el código y escríbelo junto con tu nueva contraseña."><div className="verification password-change"><p><b>Código de verificación</b><br />Son <strong>8 dígitos</strong> enviados al correo de la cuenta. El código vence en <strong>5 minutos</strong>.</p><input className="code-input" value={verificationCode} maxLength="8" inputMode="numeric" onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))} placeholder="00000000" aria-label="Código de verificación de 8 dígitos" /><label className="password-field"><input type={showNewPassword ? 'text' : 'password'} minLength="8" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nueva contraseña" /><button type="button" aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowNewPassword((value) => !value)}>{showNewPassword ? '◉' : '◌'}</button></label><small className="password-help">Mínimo 8 caracteres. No se permiten contraseñas de 4 caracteres por seguridad.</small><label className="password-field"><input type={showConfirmPassword ? 'text' : 'password'} minLength="8" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repite la nueva contraseña" /><button type="button" aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? '◉' : '◌'}</button></label><Button className="dark" type="button" disabled={busy} onClick={requestPasswordCode}>{busy ? 'Enviando…' : 'Enviar / reenviar código'}</Button><Button className="dark" type="button" disabled={busy || verificationCode.length !== 8} onClick={changePassword}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</Button></div></Card></div></>
}

function Card({ title, text, badge, children, extra = '' }) { return <section className={`card ${extra}`}><header>{text && <p className="eyebrow">{text}</p>}<div><h2>{title}</h2>{badge && <Status>{badge}</Status>}</div></header>{children}</section> }
function Stat({ icon, label, value, text }) { return <article className="stat"><i>{icon}</i><p>{label}</p><b>{value}</b><small>{text}</small></article> }
function Detail({ label, value }) { return <p className="detail"><span>{label}</span><b>{value}</b></p> }
function Mini({ icon, first, second, badge }) { return <article className="mini"><i>{icon}</i><p><b>{first}</b><small>{second}</small></p><Status>{badge}</Status></article> }
function Table({ items, admin, setAppointmentStatus }) { const data = items.length ? items : [{ id: 'Sin citas', patient: '—', professional: '—', date: '—', time: '', room: '', status: 'Sin registros', payment: '' }]; return <div className="table"><table><thead><tr><th>{admin ? 'Usuario' : 'Cita'}</th><th>Fecha y hora</th><th>Profesional</th><th>Estado</th>{admin && <th>Acción</th>}</tr></thead><tbody>{data.map((item) => <tr key={item.id}><td><b>{admin ? item.patient : item.id}</b><small>{admin ? item.id : `Aporte: ${item.payment}`}</small></td><td>{item.date}<small>{item.time}</small></td><td>{item.professional}<small>{item.room}</small></td><td><Status>{item.status}</Status></td>{admin && <td><select defaultValue="" onChange={(event) => event.target.value && setAppointmentStatus(item.id, event.target.value)}><option value="" disabled>Gestionar</option><option>Confirmada</option><option>Cancelada</option><option>Atendida</option><option>No asistió</option></select></td>}</tr>)}</tbody></table></div> }

export default App
