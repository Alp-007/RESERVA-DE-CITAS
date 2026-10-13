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
  { id: 'CIT-2401', patient: 'Camila R.', code: 'P-014', professional: 'Ps. Valentina Rojas', date: 'Martes 14 de octubre', time: '9:00 a. m.', room: 'Consultorio 204', status: 'Confirmada', payment: 'Aprobado', amount: 5000, reference: 'BRB-740021' },
  { id: 'CIT-2402', patient: 'Santiago M.', code: 'P-027', professional: 'Ps. Valentina Rojas', date: 'Jueves 16 de octubre', time: '2:00 p. m.', room: 'Consultorio 204', status: 'Pendiente de validación', payment: 'Reportado', amount: 12000, reference: 'BRB-740155' },
  { id: 'CIT-2398', patient: 'Andrea C.', code: 'P-031', professional: 'Ps. Julián Torres', date: 'Viernes 10 de octubre', time: '3:30 p. m.', room: 'Consultorio 108', status: 'Atendida', payment: 'Aprobado', amount: 5000, reference: 'BRB-739875' },
]

const seedProfessionals = [
  { id: 'PRO-01', name: 'Ps. Valentina Rojas', area: 'Psicología clínica', hours: 'Lun - Vie · 8:00 a. m. - 4:00 p. m.' },
  { id: 'PRO-02', name: 'Ps. Julián Torres', area: 'Orientación y bienestar', hours: 'Mar - Sáb · 9:00 a. m. - 5:00 p. m.' },
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
    setAppointments((current) => current.map((item) => item.id === id ? { ...item, status } : item))
    setNotice({ tone: 'success', text: `La cita ${id} fue actualizada como ${status.toLowerCase()}.` })
  }

  function addProfessional(event) {
    event.preventDefault()
    const form = event.currentTarget
    setProfessionals((current) => [...current, { id: `PRO-${String(current.length + 1).padStart(2, '0')}`, name: `Ps. ${form.fullName.value.trim()}`, area: form.area.value, hours: form.hours.value || 'Horario por definir' }])
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
    {screen === 'register' && <Register submit={handleRegister} notice={notice} loading={loading} home={() => setScreen('home')} login={() => { setNotice(null); setScreen('login') }} />}
    {screen === 'portal' && <Portal role={role} session={session} tab={tab} setTab={setTab} logout={logout} notice={notice} clearNotice={() => setNotice(null)} appointments={appointments} professionals={professionals} contribution={contribution} profileType={profileType} setProfileType={setProfileType} slot={slot} setSlot={setSlot} bookingStep={bookingStep} setBookingStep={setBookingStep} reference={reference} setReference={setReference} reportPayment={reportPayment} approvePayment={approvePayment} setAppointmentStatus={setAppointmentStatus} addProfessional={addProfessional} approvedTotal={approvedTotal} />}
  </div>
}

function Mark() { return <span className="mark">M</span> }
function Brand({ short = false }) { return <div className="brand"><Mark />{!short && <span><b>UNIMINUTO</b><small>Bienestar Universitario</small></span>}</div> }
function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }
function Alert({ notice }) { return notice && <div className={`alert ${notice.tone}`} role="status"><Icon>{notice.tone === 'success' ? '✓' : '!'}</Icon><span>{notice.text}</span></div> }
function Status({ children }) { return <span className={`status ${String(children).toLowerCase().replaceAll(' ', '-')}`}>{children}</span> }
function Button({ children, className = '', ...props }) { return <button className={`button ${className}`} {...props}>{children}</button> }

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

function Register({ submit, notice, loading, home, login }) {
  const [birth, setBirth] = useState('')
  const age = birth ? Math.max(0, Math.floor((Date.now() - new Date(birth).getTime()) / 31557600000)) : ''
  return <main className="register-page"><aside><Brand /><p className="eyebrow">CREA TU CUENTA</p><h1>Comienza tu proceso de atención.</h1><p>Completa la información inicial. Los campos con <b>*</b> son obligatorios.</p><div className="privacy"><i>⌾</i><span><strong>Información protegida</strong><small>Los documentos de identidad, dirección y remisión serán de acceso exclusivo del equipo administrador autorizado.</small></span></div><button className="back" type="button" onClick={home}>← Volver al inicio</button></aside><form className="registration" onSubmit={submit}><div><p className="eyebrow">REGISTRO</p><h2>Datos de la persona</h2><p>Tu perfil se verificará después de confirmar el correo.</p></div><Alert notice={notice} /><div className="form-grid"><Field label="Nombre completo" required><input name="fullName" placeholder="Escribe tu nombre completo" required /></Field><Field label="Tipo de documento" required><select name="documentType" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Tarjeta de identidad</option><option>Cédula de extranjería</option><option>Pasaporte</option></select></Field><Field label="Número de documento" required><input name="documentNumber" inputMode="numeric" placeholder="Sin puntos ni espacios" required /></Field><Field label="Fecha de nacimiento" required><input name="birthDate" type="date" value={birth} onChange={(event) => setBirth(event.target.value)} required /></Field><Field label="Edad calculada"><input value={age === '' ? 'Se calcula automáticamente' : `${age} años`} readOnly /></Field><Field label="Teléfono de contacto" required><input name="phone" type="tel" placeholder="300 000 0000" required /></Field><Field label="Dirección" required wide><input name="address" placeholder="Dirección de residencia" required /></Field><Field label="Correo electrónico" required><input name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required /></Field><Field label="Tipo de usuario" required><select name="userType" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option value="estudiante">Estudiante UNIMINUTO</option><option value="docente">Docente</option><option value="administrativo">Administrativo</option><option value="externo">Usuario externo</option></select></Field><Field label="Jornada de preferencia" required><select name="preference" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Mañana</option><option>Tarde</option><option>Indiferente</option></select></Field><Field label="Documento de remisión (opcional)" wide><input name="referral" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" /><small>PDF, JPG, PNG o WEBP · Máximo 8 MB</small></Field><Field label="Crear contraseña" required wide><input name="password" type="password" minLength="8" autoComplete="new-password" placeholder="Mínimo 8 caracteres" required /></Field></div><label className="consent"><input type="checkbox" required /><span>Autorizo el tratamiento de mis datos personales y confirmo que la información suministrada es veraz. <b>*</b></span></label><Button className="dark full" type="submit" disabled={loading}>{loading ? 'Creando cuenta...' : 'Crear cuenta y verificar correo'} <Icon>→</Icon></Button><div className="switch">¿Ya tienes cuenta? <button type="button" onClick={login}>Inicia sesión</button></div></form></main>
}
function Field({ label, required, wide, children }) { return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}{required && <b> *</b>}</span>{children}</label> }

function Portal(props) {
  const { role, session, tab, setTab, logout, notice, clearNotice } = props
  const nav = role === 'admin' ? [['summary', 'Resumen', '▦'], ['professionals', 'Profesionales', '◉'], ['appointments', 'Citas', '▣'], ['payments', 'Aportes', '◇'], ['reports', 'Reportes', '▤']] : role === 'professional' ? [['summary', 'Mi agenda', '▣'], ['activity', 'Actualizar atención', '✓'], ['availability', 'Disponibilidad', '◷']] : [['summary', 'Mi resumen', '▦'], ['book', 'Agendar cita', '▣'], ['history', 'Mis citas', '◷'], ['profile', 'Mi perfil', '◉']]
  return <main className="portal"><aside className="sidebar"><Brand short /><p>{role === 'admin' ? 'ADMINISTRADOR' : role === 'professional' ? 'PROFESIONAL' : 'USUARIO'}</p><nav>{nav.map(([id, label, icon]) => <button key={id} className={tab === id ? 'active' : ''} type="button" onClick={() => { setTab(id); clearNotice() }}><i>{icon}</i><span>{label}</span></button>)}</nav><div className="account"><span>{session?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><p><b>{session?.name}</b><small>{role === 'admin' ? 'Administrador' : role === 'professional' ? 'Profesional' : 'Usuario'}</small></p></div><button className="logout" type="button" onClick={logout}>↪ <span>Cerrar sesión</span></button></aside><section className="portal-main"><header className="portal-header"><div><p>Portal de Bienestar / {role === 'admin' ? 'Administrador' : role === 'professional' ? 'Profesional' : 'Usuario'}</p><h1>{titleFor(role, tab)}</h1></div><div><button className="bell" type="button">♧<i /></button><span>Octubre 2026</span></div></header><Alert notice={notice} />{role === 'user' && <UserDashboard {...props} />}{role === 'professional' && <ProfessionalDashboard {...props} />}{role === 'admin' && <AdminDashboard {...props} />}</section></main>
}
function titleFor(role, tab) { return ({ user: { summary: 'Hola, Camila', book: 'Agenda tu cita', history: 'Mis citas', profile: 'Mi perfil' }, professional: { summary: 'Mi agenda de hoy', activity: 'Actualizar atención', availability: 'Disponibilidad' }, admin: { summary: 'Resumen general', professionals: 'Profesionales', appointments: 'Gestión de citas', payments: 'Gestión de aportes', reports: 'Reportes y seguimiento' } })[role][tab] }

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

function AdminDashboard({ tab, appointments, professionals, addProfessional, approvePayment, setAppointmentStatus, approvedTotal }) {
  if (tab === 'professionals') return <div className="admin-grid"><Card title="Profesionales activos" text="Administra perfiles, estado y horario de atención." badge={`${professionals.length} activos`}><div className="people">{professionals.map((person) => <article key={person.id}><i>{person.name.split(' ').slice(1).map((word) => word[0]).join('').slice(0, 2)}</i><p><b>{person.name}</b><small>{person.area}</small><small>{person.hours}</small></p><Status>Activo</Status></article>)}</div></Card><form className="card pro-form" onSubmit={addProfessional}><p className="eyebrow">NUEVO PERFIL</p><h2>Registrar profesional</h2><p>Solo el administrador puede crear perfiles de profesionales.</p><Field label="Nombre completo" required><input name="fullName" placeholder="Nombre y apellido" required /></Field><Field label="Área de atención" required><input name="area" placeholder="Ej. Psicología clínica" required /></Field><Field label="Horario inicial"><input name="hours" placeholder="Ej. Lun - Vie · 8:00 a. m. - 4:00 p. m." /></Field><Button className="dark full" type="submit">＋ Crear perfil</Button></form></div>
  if (tab === 'appointments') return <Card title="Supervisa la agenda institucional" text="Modifica o cancela las solicitudes cuando sea necesario."><Table items={appointments} admin setAppointmentStatus={setAppointmentStatus} /></Card>
  if (tab === 'payments') { const pending = appointments.filter((item) => item.payment === 'Reportado'); return <Card title="Pagos reportados" text="Compara el número de aprobación con la plataforma financiera antes de confirmar la cita." badge={`${pending.length} pendientes`}><Alert notice={{ tone: 'warning', text: 'El QR mostrado al usuario es una demostración. Configura el QR de comercio Bre-B real antes de recibir pagos.' }} /><div className="payments">{pending.length ? pending.map((item) => <article key={item.id}><p><b>{item.patient}</b><small>{item.id} · {item.date} · {item.time}</small></p><p><b>{money(item.amount)}</b><small>Aprobación: {item.reference}</small></p><Button className="dark" type="button" onClick={() => approvePayment(item.id)}>Validar aporte ✓</Button></article>) : <Empty title="No hay aportes pendientes" text="Los pagos reportados por los usuarios aparecerán aquí para validación." />}</div></Card> }
  if (tab === 'reports') return <div className="reports"><Card extra="chart-card" title="Indicadores del periodo"><div className="bars">{[52,72,44,88,65,78].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><div className="months"><span>May</span><span>Jun</span><span>Jul</span><span>Ago</span><span>Sep</span><span>Oct</span></div></Card><Card extra="followup" title="Seguimiento requerido" text="3 usuarios llevan más de 60 días sin solicitar una nueva cita."><Button className="soft" type="button">Ver usuarios</Button></Card><Card title="Resumen administrativo"><div className="details"><Detail label="Aportes aprobados" value={money(approvedTotal)} /><Detail label="Citas atendidas" value={String(appointments.filter((item) => item.status === 'Atendida').length)} /><Detail label="Citas por validar" value={String(appointments.filter((item) => item.payment === 'Reportado').length)} /></div></Card></div>
  return <><section className="welcome purple"><div><p>Control administrativo</p><h2>La información clave, en un solo lugar.</h2><span>Gestiona profesionales, citas, aportes y seguimientos desde el portal.</span></div><i>▤</i></section><div className="stats four"><Stat icon="▣" label="Citas del periodo" value={String(appointments.length + 21)} text="4 programadas para hoy" /><Stat icon="◇" label="Aportes aprobados" value={money(approvedTotal)} text="En el periodo actual" /><Stat icon="◉" label="Profesionales" value={String(professionals.length)} text="Perfiles activos" /><Stat icon="♧" label="Seguimientos" value="3" text="Requieren contacto" /></div><div className="columns"><Card title="Aportes por validar" text="Recientes">{appointments.filter((item) => item.payment === 'Reportado').map((item) => <Mini key={item.id} icon="◇" first={item.patient} second={`${item.reference} · ${money(item.amount)}`} badge="Reportado" />)}</Card><Card title="Próximas citas" text="Agenda">{appointments.slice(0, 3).map((item) => <Mini key={item.id} icon={item.time.slice(0, 2)} first={item.patient} second={item.professional} badge={item.status} />)}</Card></div></>
}

function Card({ title, text, badge, children, extra = '' }) { return <section className={`card ${extra}`}><header>{text && <p className="eyebrow">{text}</p>}<div><h2>{title}</h2>{badge && <Status>{badge}</Status>}</div></header>{children}</section> }
function Stat({ icon, label, value, text }) { return <article className="stat"><i>{icon}</i><p>{label}</p><b>{value}</b><small>{text}</small></article> }
function Detail({ label, value }) { return <p className="detail"><span>{label}</span><b>{value}</b></p> }
function Mini({ icon, first, second, badge }) { return <article className="mini"><i>{icon}</i><p><b>{first}</b><small>{second}</small></p><Status>{badge}</Status></article> }
function Empty({ title, text }) { return <div className="empty"><i>◇</i><b>{title}</b><small>{text}</small></div> }
function Table({ items, admin, setAppointmentStatus }) { const data = items.length ? items : [{ id: 'Sin citas', patient: '—', professional: '—', date: '—', time: '', room: '', status: 'Sin registros', payment: '' }]; return <div className="table"><table><thead><tr><th>{admin ? 'Usuario' : 'Cita'}</th><th>Fecha y hora</th><th>Profesional</th><th>Estado</th>{admin && <th>Acción</th>}</tr></thead><tbody>{data.map((item) => <tr key={item.id}><td><b>{admin ? item.patient : item.id}</b><small>{admin ? item.id : `Aporte: ${item.payment}`}</small></td><td>{item.date}<small>{item.time}</small></td><td>{item.professional}<small>{item.room}</small></td><td><Status>{item.status}</Status></td>{admin && <td><select defaultValue="" onChange={(event) => event.target.value && setAppointmentStatus(item.id, event.target.value)}><option value="" disabled>Gestionar</option><option>Confirmada</option><option>Cancelada</option><option>Atendida</option><option>No asistió</option></select></td>}</tr>)}</tbody></table></div> }

export default App
