import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { supabase } from './supabase'

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
  { id: 'PRO-01', name: 'Ps. Valentina Rojas', area: 'Psicología clínica', hours: 'Lun - Vie · 8:00 a. m. - 4:00 p. m.', active: true, schedule: 'Lun 08–16 · Mar 08–16 · Mié descanso · Jue 08–16 · Vie 08–16' },
  { id: 'PRO-02', name: 'Ps. Julián Torres', area: 'Orientación y bienestar', hours: 'Mar - Sáb · 9:00 a. m. - 5:00 p. m.', active: true, schedule: 'Mar 09–17 · Mié 09–17 · Jue 09–17 · Vie 09–17 · Sáb 09–17' },
]

const money = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

function App() {
  const [screen, setScreen] = useState('home')
  const [session, setSession] = useState(null)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [connection, setConnection] = useState('Conectando con el servicio...')
  const [appointments, setAppointments] = useState(seedAppointments)
  const [professionals, setProfessionals] = useState(seedProfessionals)
  const [tab, setTab] = useState('summary')
  const [slot, setSlot] = useState(null)
  const [bookingStep, setBookingStep] = useState('schedule')
  const [profileType, setProfileType] = useState('student')
  const [reference, setReference] = useState('')
  const [openedAt] = useState(() => new Date())

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ error }) => {
      if (mounted) setConnection(error ? 'Modo local · sin sesión activa' : 'Portal seguro de Bienestar Universitario')
    }).catch(() => mounted && setConnection('Modo local · sin sesión activa'))
    return () => { mounted = false }
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
      const { data, error } = await supabase.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value })
      if (error) throw error
      const metadata = data.user?.user_metadata || {}
      const nextRole = metadata.rol === 'administrador' ? 'admin' : metadata.rol === 'profesional' ? 'professional' : 'user'
      setSession({ name: metadata.nombre_completo || data.user.email?.split('@')[0] || 'Usuario', role: nextRole })
      setTab('summary')
      setScreen('portal')
    } catch (error) {
      setNotice({ tone: 'warning', text: error.message || 'No fue posible iniciar sesión. Verifica tus datos.' })
    } finally { setLoading(false) }
  }

  async function handleRegister(event) {
    event.preventDefault()
    const form = event.currentTarget
    const file = form.referral.files[0]
    if (file && (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)) {
      setNotice({ tone: 'warning', text: 'El documento de remisión debe ser PDF, JPG, PNG o WEBP y no superar 8 MB.' })
      return
    }
    setLoading(true)
    setNotice(null)
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email.value.trim(),
        password: form.password.value,
        options: { data: { nombre_completo: form.fullName.value.trim(), tipo_usuario: form.userType.value, rol: 'usuario' } },
      })
      if (error) throw error
      form.reset()
      setNotice({ tone: 'success', text: 'Cuenta creada. Revisa el correo para confirmar tu registro antes de ingresar.' })
    } catch (error) {
      setNotice({ tone: 'warning', text: error.message || 'No fue posible crear la cuenta.' })
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
    await supabase.auth.signOut()
    setSession(null)
    setScreen('home')
    setNotice(null)
  }

  return <div className="app">
    <div className="utility"><span className="online-dot" />{connection}<span>Atención psicológica · Soacha</span></div>
    {screen === 'home' && <><Header goHome={() => setScreen('home')} openLogin={() => { setNotice(null); setScreen('login') }} openRegister={() => { setNotice(null); setScreen('register') }} /><Home openLogin={() => setScreen('login')} openRegister={() => setScreen('register')} demo={() => enterDemo('user')} /></>}
    {screen === 'login' && <Login submit={handleLogin} notice={notice} loading={loading} home={() => setScreen('home')} register={() => { setNotice(null); setScreen('register') }} demo={enterDemo} />}
    {screen === 'register' && <Register todayMs={openedAt.getTime()} submit={handleRegister} notice={notice} loading={loading} home={() => setScreen('home')} login={() => { setNotice(null); setScreen('login') }} />}
    {screen === 'portal' && <Portal openedAt={openedAt} role={role} session={session} tab={tab} setTab={setTab} logout={logout} notice={notice} clearNotice={() => setNotice(null)} appointments={appointments} professionals={professionals} setProfessionals={setProfessionals} contribution={contribution} profileType={profileType} setProfileType={setProfileType} slot={slot} setSlot={setSlot} bookingStep={bookingStep} setBookingStep={setBookingStep} reference={reference} setReference={setReference} reportPayment={reportPayment} approvePayment={approvePayment} setAppointmentStatus={setAppointmentStatus} addProfessional={addProfessional} approvedTotal={approvedTotal} />}
    <ChatAssistant />
  </div>
}

function Mark() { return <span className="mark">M</span> }
function Brand({ short = false }) { return <div className="brand"><Mark />{!short && <span><b>UNIMINUTO</b><small>Bienestar Universitario</small></span>}</div> }
function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }
function Alert({ notice }) { return notice && <div className={`alert ${notice.tone}`} role="status"><Icon>{notice.tone === 'success' ? '✓' : '!'}</Icon><span>{notice.text}</span></div> }
function Status({ children }) { return <span className={`status ${String(children).toLowerCase().replaceAll(' ', '-')}`}>{children}</span> }
function Button({ children, className = '', ...props }) { return <button className={`button ${className}`} {...props}>{children}</button> }

function ChatAssistant() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([{ from: 'bot', text: 'Hola, soy el asistente de Bienestar. Puedo orientarte sobre citas, pagos y acceso al portal.' }])
  const answer = (message) => {
    const value = message.toLowerCase()
    if (value.includes('cita') || value.includes('agenda') || value.includes('horario')) return 'Para solicitar una cita, ingresa al portal y selecciona “Agendar cita”. Allí podrás elegir el horario disponible que prefieras.'
    if (value.includes('pago') || value.includes('aporte') || value.includes('bre')) return 'El aporte se reporta al finalizar la selección de horario. Conserva el número de aprobación de Bre-B para completar el registro.'
    if (value.includes('contraseña') || value.includes('acceso') || value.includes('ingresar')) return 'Usa el correo con el que te registraste para ingresar. Si todavía no tienes cuenta, selecciona “Crear cuenta” desde la página principal.'
    if (value.includes('urgencia') || value.includes('emergencia') || value.includes('crisis')) return 'Si estás en una emergencia o sientes que podrías hacerte daño, busca ayuda inmediata: comunícate con la línea de emergencias de tu localidad o acude al servicio de urgencias más cercano. Este chat no reemplaza la atención profesional de emergencia.'
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
  return <header className="header"><button className="brand-button" type="button" onClick={goHome}><Brand /></button><nav><button type="button" onClick={goHome}>Inicio</button><a href="#servicios">Servicios</a><a href="#proceso">Cómo funciona</a></nav><div><button className="plain" type="button" onClick={openRegister}>Crear cuenta</button><Button className="dark" type="button" onClick={openLogin}>Ingresar <Icon>→</Icon></Button></div></header>
}

function Home({ openLogin, openRegister, demo }) {
  return <main>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">BIENESTAR UNIVERSITARIO</p><h1>Tu bienestar merece un espacio para <em>ser escuchado.</em></h1><p>Agenda, consulta y gestiona tu atención psicológica en un portal claro, privado y pensado para ti.</p><div className="hero-actions"><Button className="orange" type="button" onClick={openLogin}>Solicitar una cita <Icon>→</Icon></Button><Button className="ghost" type="button" onClick={demo}>Conocer el portal</Button></div><div className="trust"><span>⌾ Información con acceso por roles</span><span>◷ Agenda organizada</span></div></div><HeroArt /></section>
    <section className="strip"><span>Atención para estudiantes, docentes, administrativos y comunidad externa.</span><button type="button" onClick={openRegister}>Regístrate para comenzar <Icon>→</Icon></button></section>
    <section className="section" id="servicios"><div className="section-intro"><p className="eyebrow">EL PORTAL</p><h2>Todo lo necesario para organizar tu atención.</h2><p>Una experiencia simple para pedir acompañamiento y una gestión ordenada para el equipo institucional.</p></div><div className="features"><Feature number="01" icon="▣" title="Agenda disponible" text="Consulta los espacios habilitados por tu profesional asignado y solicita la fecha que te funciona." /><Feature number="02" icon="◈" title="Aporte claro" text="Revisa el valor correspondiente, paga con Bre-B y reporta el número de aprobación." /><Feature number="03" icon="◌" title="Seguimiento oportuno" text="Consulta el estado de la solicitud, tus citas y los avisos relevantes desde un solo lugar." /></div></section>
    <section className="process" id="proceso"><div><p className="eyebrow">UN PROCESO SENCILLO</p><h2>Solicita tu atención en tres pasos.</h2></div><ol><li><b>1</b><span><strong>Ingresa a tu cuenta</strong><small>Registra y confirma tu correo.</small></span></li><li><b>2</b><span><strong>Elige un horario</strong><small>Visualiza los espacios disponibles.</small></span></li><li><b>3</b><span><strong>Reporta tu aporte</strong><small>Escanea el QR Bre-B y registra la aprobación.</small></span></li></ol></section>
    <section className="cta"><div><p className="eyebrow">EMPIEZA HOY</p><h2>Tu salud mental también es prioridad.</h2><p>Accede a un espacio de escucha, orientación y acompañamiento.</p></div><Button className="orange" type="button" onClick={openLogin}>Ingresar al portal <Icon>→</Icon></Button></section>
    <Footer />
  </main>
}

function HeroArt() { return <div className="hero-art" aria-label="Ilustración de acompañamiento psicológico"><i className="sun" /><i className="shape-one" /><i className="shape-two" /><div className="hero-card"><span className="heart">♡</span><small>Tu cita, a tu ritmo</small><b>Atención con acompañamiento</b><div><i /><i /><i /></div></div><div className="appointment-bubble"><span>VR</span><p><b>Ps. Valentina</b><small>Próxima disponibilidad</small></p><em>✓</em></div></div> }
function Feature({ number, icon, title, text }) { return <article className="feature"><span className="feature-number">{number}</span><i>{icon}</i><h3>{title}</h3><p>{text}</p></article> }
function Footer() { return <footer><Brand /><p>Portal académico de Bienestar Universitario · Sistema de gestión de citas psicológicas</p><small>UNIMINUTO · Centro Universitario Regional Soacha</small></footer> }

function Login({ submit, notice, loading, home, register, demo }) {
  return <main className="auth-page"><aside><Brand /><div><p className="eyebrow">PORTAL DE BIENESTAR</p><h1>Un lugar seguro para empezar.</h1><p>Accede a tus citas, notificaciones y solicitudes de atención desde un único lugar.</p></div><ul><li>⌾ Tus datos se muestran según el rol autorizado.</li><li>♡ Atención organizada y centrada en las personas.</li></ul></aside><section><button className="back" type="button" onClick={home}>← Volver al inicio</button><form className="login-form" onSubmit={submit}><p className="eyebrow">INICIAR SESIÓN</p><h2>Te damos la bienvenida.</h2><p>Ingresa con el correo y contraseña registrados.</p><Alert notice={notice} /><label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="nombre@uniminuto.edu.co" required /></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" placeholder="Escribe tu contraseña" required /></label><Button className="dark full" type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar al portal'} <Icon>→</Icon></Button><div className="switch">¿Aún no tienes una cuenta? <button type="button" onClick={register}>Regístrate</button></div></form><div className="demo"><b>Vista de demostración</b><p>Explora los perfiles sin crear ni modificar datos reales.</p><div><button type="button" onClick={() => demo('user')}>Usuario</button><button type="button" onClick={() => demo('professional')}>Profesional</button><button type="button" onClick={() => demo('admin')}>Administrador</button></div></div></section></main>
}

function Register({ submit, notice, loading, home, login, todayMs }) {
  const [birth, setBirth] = useState('')
  const age = birth ? Math.max(0, Math.floor((todayMs - new Date(birth).getTime()) / 31557600000)) : ''
  return <main className="register-page"><aside><Brand /><p className="eyebrow">CREA TU CUENTA</p><h1>Comienza tu proceso de atención.</h1><p>Completa la información inicial. Los campos con <b>*</b> son obligatorios.</p><div className="privacy"><i>⌾</i><span><strong>Información protegida</strong><small>Los documentos de identidad, dirección y remisión serán de acceso exclusivo del equipo administrador autorizado.</small></span></div><button className="back" type="button" onClick={home}>← Volver al inicio</button></aside><form className="registration" onSubmit={submit}><div><p className="eyebrow">REGISTRO</p><h2>Datos de la persona</h2><p>Tu perfil se verificará después de confirmar el correo.</p></div><Alert notice={notice} /><div className="form-grid"><Field label="Nombre completo" required><input name="fullName" placeholder="Escribe tu nombre completo" required /></Field><Field label="Tipo de documento" required><select name="documentType" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Tarjeta de identidad</option><option>Cédula de extranjería</option><option>Pasaporte</option></select></Field><Field label="Número de documento" required><input name="documentNumber" inputMode="numeric" placeholder="Sin puntos ni espacios" required /></Field><Field label="Fecha de nacimiento" required><input name="birthDate" type="date" value={birth} onChange={(event) => setBirth(event.target.value)} required /></Field><Field label="Edad calculada"><input value={age === '' ? 'Se calcula automáticamente' : `${age} años`} readOnly /></Field><Field label="Teléfono de contacto" required><input name="phone" type="tel" placeholder="300 000 0000" required /></Field><Field label="Dirección" required wide><input name="address" placeholder="Dirección de residencia" required /></Field><Field label="Correo electrónico" required><input name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required /></Field><Field label="Tipo de usuario" required><select name="userType" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option value="estudiante">Estudiante UNIMINUTO</option><option value="docente">Docente</option><option value="administrativo">Administrativo</option><option value="externo">Usuario externo</option></select></Field><Field label="Jornada de preferencia" required><select name="preference" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Mañana</option><option>Tarde</option><option>Indiferente</option></select></Field><Field label="Documento de remisión (opcional)" wide><input name="referral" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" /><small>PDF, JPG, PNG o WEBP · Máximo 8 MB</small></Field><Field label="Crear contraseña" required wide><input name="password" type="password" minLength="8" autoComplete="new-password" placeholder="Mínimo 8 caracteres" required /></Field></div><label className="consent"><input type="checkbox" required /><span>Autorizo el tratamiento de mis datos personales y confirmo que la información suministrada es veraz. <b>*</b></span></label><Button className="dark full" type="submit" disabled={loading}>{loading ? 'Creando cuenta...' : 'Crear cuenta y verificar correo'} <Icon>→</Icon></Button><div className="switch">¿Ya tienes cuenta? <button type="button" onClick={login}>Inicia sesión</button></div></form></main>
}
function Field({ label, required, wide, children }) { return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}{required && <b> *</b>}</span>{children}</label> }

function Portal(props) {
  const { role, session, tab, setTab, logout, notice, clearNotice, openedAt } = props
  const nav = role === 'admin' ? [['summary', 'Resumen', '▦'], ['professionals', 'Profesionales', '◉'], ['appointments', 'Citas', '▣'], ['reports', 'Seguimiento', '▤'], ['profile', 'Mi cuenta', '◉']] : role === 'professional' ? [['summary', 'Mi agenda', '▣'], ['activity', 'Actualizar atención', '✓'], ['availability', 'Disponibilidad', '◷']] : [['summary', 'Mi resumen', '▦'], ['book', 'Agendar cita', '▣'], ['history', 'Mis citas', '◷'], ['profile', 'Mi perfil', '◉']]
  const fechaActual = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(openedAt)
  return <main className="portal"><aside className="sidebar"><Brand short /><p>{role === 'admin' ? 'ADMINISTRADOR' : role === 'professional' ? 'PROFESIONAL' : 'USUARIO'}</p><nav>{nav.map(([id, label, icon]) => <button key={id} className={tab === id ? 'active' : ''} type="button" onClick={() => { setTab(id); clearNotice() }}><i>{icon}</i><span>{label}</span></button>)}</nav><button className="account" type="button" onClick={() => role === 'admin' && setTab('profile')} title="Abrir mi cuenta"><span>{session?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><p><b>{session?.name}</b><small>{role === 'admin' ? 'Editar cuenta' : role === 'professional' ? 'Profesional' : 'Usuario'}</small></p></button><button className="logout" type="button" onClick={logout}>↪ <span>Cerrar sesión</span></button></aside><section className="portal-main"><header className="portal-header"><div><p>Portal de Bienestar / {role === 'admin' ? 'Administrador' : role === 'professional' ? 'Profesional' : 'Usuario'}</p><h1>{titleFor(role, tab)}</h1></div><div><button className="bell" type="button" aria-label="Ver recordatorios" onClick={() => window.alert('Recordatorio: revisa las citas próximas y comunica cualquier cancelación al paciente.')}>♧<i /></button><span>{fechaActual}</span></div></header><Alert notice={notice} />{role === 'user' && <UserDashboard {...props} />}{role === 'professional' && <ProfessionalDashboard {...props} />}{role === 'admin' && <AdminDashboard {...props} />}</section></main>
}
function titleFor(role, tab) { return ({ user: { summary: 'Hola, Camila', book: 'Agenda tu cita', history: 'Mis citas', profile: 'Mi perfil' }, professional: { summary: 'Mi agenda de hoy', activity: 'Actualizar atención', availability: 'Disponibilidad' }, admin: { summary: 'Resumen general', professionals: 'Profesionales', appointments: 'Gestión de citas', reports: 'Reportes y seguimiento', profile: 'Mi cuenta' } })[role][tab] }

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

function AdminDashboard({ tab, appointments, professionals, addProfessional, setProfessionals, setAppointmentStatus }) {
  const [semana, setSemana] = useState('Actual')
  const [filtroPaciente, setFiltroPaciente] = useState('')
  const [metodo, setMetodo] = useState('correo')
  const activos = professionals.filter((p) => p.active !== false)
  const ordenadas = [...appointments].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`, 'es'))
  const alternarProfesional = (id) => setProfessionals((current) => current.map((p) => p.id === id ? { ...p, active: !p.active } : p))
  if (tab === 'professionals') return <div className="admin-grid"><Card title="Profesionales activos y próximos" text="Consulta quién atiende hoy; usa el control para desactivar perfiles que ya no pertenecen al servicio." badge={`${activos.length} activos`}><div className="week-tabs">{['Anterior','Actual','Siguiente'].map((x) => <button className={semana === x ? 'selected' : ''} type="button" key={x} onClick={() => setSemana(x)}>Semana {x.toLowerCase()}</button>)}</div><p className="ayuda">Horario de la semana {semana.toLowerCase()}: cada bloque indica atención y descanso programado.</p><div className="people">{professionals.map((person) => <article key={person.id}><i>{person.name.split(' ').slice(1).map((word) => word[0]).join('').slice(0, 2)}</i><p><b>{person.name}</b><small>{person.area}</small><small>{person.schedule || person.hours}</small></p><div><Status>{person.active === false ? 'Inactivo' : 'Activo'}</Status><button className="link-action" type="button" onClick={() => alternarProfesional(person.id)}>{person.active === false ? 'Activar' : 'Desactivar'}</button></div></article>)}</div></Card><form className="card pro-form" onSubmit={addProfessional}><p className="eyebrow">NUEVO PERFIL</p><h2>Registrar profesional</h2><p>Crea sus credenciales iniciales. La persona podrá cambiarlas después desde su cuenta.</p><Field label="Nombre completo" required><input name="fullName" placeholder="Nombre y apellido" required /></Field><Field label="Usuario inicial" required><input name="username" placeholder="Ej. vrojas" required /></Field><Field label="Contraseña temporal" required><input name="password" type="password" minLength="8" placeholder="Mínimo 8 caracteres" required /></Field><Button className="dark full" type="submit">＋ Crear profesional</Button></form><Card title="Asignar horario semanal" text="Marca si atiende cada día. Si atiende, registra horario y descanso."><WeeklySchedule professionals={activos} /></Card></div>
  if (tab === 'appointments') return <><Card title="Supervisa la agenda institucional" text="Las citas se muestran de la más próxima a la más lejana. Al cancelar, confirma la acción y comunícala al paciente."><Table items={ordenadas} admin setAppointmentStatus={setAppointmentStatus} /></Card><Card title="Paciente y horario" text="Selecciona un paciente para revisar sus citas pasadas, programadas y consultorio."><select value={filtroPaciente} onChange={(e) => setFiltroPaciente(e.target.value)}><option value="">Selecciona un paciente</option>{appointments.map((a) => <option key={a.code} value={a.code}>{a.patient}</option>)}</select>{filtroPaciente && <Table items={appointments.filter((x) => x.code === filtroPaciente)} />}</Card></>
  if (tab === 'reports') return <div className="reports"><Card extra="chart-card" title="Pacientes con menor frecuencia" text="Aparecen primero quienes llevan más de un mes sin asistir."><div className="alerta alerta-error">Prioridad: Camila R. y Santiago M. no han asistido en más de 30 días.</div>{appointments.map((a, i) => <Mini key={a.id} icon={String(i + 1)} first={a.patient} second={i < 2 ? 'Más de 30 días sin asistencia' : 'Asistencia frecuente'} badge={i < 2 ? 'Contactar' : 'Al día'} />)}</Card><Card extra="followup" title="Cambio de profesional" text="Elige el nuevo profesional y confirma el cambio."><Mini icon="CR" first="Camila R." second="Solicitud pendiente" badge="Pendiente" /><select><option>Selecciona profesional</option>{activos.map((p) => <option key={p.id}>{p.name}</option>)}</select><Button className="dark full" type="button" onClick={() => window.alert('Cambio registrado en esta demostración.')}>Asignar profesional</Button></Card></div>
  if (tab === 'profile') return <Card title="Mi cuenta de administrador" text="Para modificar cada dato se envía un código de verificación al método que elijas."><div className="profile-edit"><Field label="Nombre"><input defaultValue="Laura Mendoza" /></Field><Field label="Correo"><input type="email" defaultValue="laura@uniminuto.edu.co" /></Field><Field label="Teléfono"><input defaultValue="300 000 0000" /></Field><Field label="Usuario"><input defaultValue="laura.mendoza" /></Field><Field label="Nueva contraseña"><input type="password" placeholder="Dejar vacío para conservar" /></Field><label>Recibir código por<select value={metodo} onChange={(e) => setMetodo(e.target.value)}><option value="correo">Correo</option><option value="telefono">Teléfono</option></select></label></div><Button className="dark" type="button" onClick={() => window.alert(`Código de demostración enviado por ${metodo}. En producción, conecta un proveedor de correo o SMS.`)}>Enviar código y guardar</Button></Card>
  return <><section className="welcome purple"><div><p>Control administrativo</p><h2>La información clave, en un solo lugar.</h2><span>Usa los accesos rápidos y revisa la disponibilidad del equipo.</span></div><i>▤</i></section><div className="stats four"><Stat icon="▣" label="Citas programadas" value={String(appointments.filter((x) => x.status !== 'Cancelada').length)} text="Ordenadas para gestión" /><Stat icon="◉" label="Profesionales" value={String(activos.length)} text="Perfiles activos" /><Stat icon="♧" label="Seguimientos" value="3" text="Requieren contacto" /><Stat icon="✓" label="Atendidas" value={String(appointments.filter((x) => x.status === 'Atendida').length)} text="Durante el periodo" /></div><div className="columns"><Card title="Agenda del día" text="Quién está atendiendo y quién sigue">{activos.map((p, i) => <Mini key={p.id} icon={i === 0 ? 'Ahora' : 'Sigue'} first={p.name} second={i === 0 ? 'Atiende hasta las 4:00 p. m.' : 'Ingresa a las 9:00 a. m.'} badge={i === 0 ? 'En atención' : 'Próximo'} />)}</Card><Card title="Próximas citas" text="Agenda">{ordenadas.slice(0, 3).map((item) => <Mini key={item.id} icon={item.time.slice(0, 2)} first={item.patient} second={`${item.professional} · ${item.room}`} badge={item.status} />)}</Card></div></>
}

function WeeklySchedule({ professionals }) { const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']; const [on, setOn] = useState({ Lunes:true, Martes:true, Miércoles:true, Jueves:true, Viernes:true }); return <div className="weekly-schedule"><select><option>Selecciona profesional</option>{professionals.map((p) => <option key={p.id}>{p.name}</option>)}</select>{days.map((day) => <label className="day-row" key={day}><input type="checkbox" checked={!!on[day]} onChange={(e) => setOn((v) => ({ ...v, [day]: e.target.checked }))} /> <b>{day}</b>{on[day] && <><input type="time" defaultValue="08:00" /><span>a</span><input type="time" defaultValue="16:00" /><select defaultValue="60"><option value="0">Sin descanso</option><option value="30">Descanso 30 min</option><option value="60">Descanso 1 hora</option></select></>}</label>)}<Button className="dark" type="button" onClick={() => window.alert('Horario guardado en la demostración.')}>Guardar horario</Button></div> }

function Card({ title, text, badge, children, extra = '' }) { return <section className={`card ${extra}`}><header>{text && <p className="eyebrow">{text}</p>}<div><h2>{title}</h2>{badge && <Status>{badge}</Status>}</div></header>{children}</section> }
function Stat({ icon, label, value, text }) { return <article className="stat"><i>{icon}</i><p>{label}</p><b>{value}</b><small>{text}</small></article> }
function Detail({ label, value }) { return <p className="detail"><span>{label}</span><b>{value}</b></p> }
function Mini({ icon, first, second, badge }) { return <article className="mini"><i>{icon}</i><p><b>{first}</b><small>{second}</small></p><Status>{badge}</Status></article> }
function Table({ items, admin, setAppointmentStatus }) { const data = items.length ? items : [{ id: 'Sin citas', patient: '—', professional: '—', date: '—', time: '', room: '', status: 'Sin registros', payment: '' }]; return <div className="table"><table><thead><tr><th>{admin ? 'Usuario' : 'Cita'}</th><th>Fecha y hora</th><th>Profesional</th><th>Estado</th>{admin && <th>Acción</th>}</tr></thead><tbody>{data.map((item) => <tr key={item.id}><td><b>{admin ? item.patient : item.id}</b><small>{admin ? item.id : `Aporte: ${item.payment}`}</small></td><td>{item.date}<small>{item.time}</small></td><td>{item.professional}<small>{item.room}</small></td><td><Status>{item.status}</Status></td>{admin && <td><select defaultValue="" onChange={(event) => event.target.value && setAppointmentStatus(item.id, event.target.value)}><option value="" disabled>Gestionar</option><option>Confirmada</option><option>Cancelada</option><option>Atendida</option><option>No asistió</option></select></td>}</tr>)}</tbody></table></div> }

export default App
