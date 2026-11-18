import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })
const now = () => new Date()

async function hash(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function makeCode() {
  const numbers = new Uint32Array(1)
  crypto.getRandomValues(numbers)
  return String(100000 + (numbers[0] % 900000))
}

async function sendEmail(to: string, code: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL')
  if (!key || !from) throw new Error('El proveedor de correo no está configurado.')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: 'Código de seguridad de tu cuenta', text: `Tu código de verificación es ${code}. Vence en 10 minutos. No lo compartas.` }),
  })
  if (!response.ok) throw new Error('No se pudo enviar el código por correo.')
}

async function verifyCurrentPassword(email: string | undefined, password: string, expectedUserId: string) {
  if (!email || !password) throw new Error('Escribe tu contraseña actual.')
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data, error } = await authClient.auth.signInWithPassword({ email, password })
  if (error || data.user?.id !== expectedUserId) throw new Error('La contraseña actual no es correcta.')
}

async function verifyRequestCode(admin: ReturnType<typeof createClient>, userId: string, requestId: string, purpose: string, codes: Record<string, string>) {
  const { data: rows, error } = await admin.from('verificaciones_cuenta')
    .select('*').eq('solicitud_id', requestId).eq('usuario_id', userId).eq('proposito', purpose).order('creado_en')
  if (error || !rows?.length) throw new Error('Solicitud de verificación no encontrada.')
  if (rows.some((row) => new Date(row.expira_en) < now() || row.intentos >= 5)) throw new Error('El código venció o agotó los intentos. Solicita uno nuevo.')
  for (const row of rows) {
    const received = String(codes[row.canal] || '')
    if (received.length !== 6 || await hash(received) !== row.codigo_hash) {
      await admin.from('verificaciones_cuenta').update({ intentos: row.intentos + 1 }).eq('id', row.id)
      const canal = row.canal === 'sms' ? 'SMS' : row.canal === 'bootstrap' ? 'activación inicial' : 'correo'
      throw new Error(`Código de ${canal} incorrecto.`)
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = request.headers.get('Authorization')
    if (!auth) return json({ error: 'Sesión requerida.' }, 401)
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) return json({ error: 'Sesión no válida.' }, 401)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: profile } = await admin.from('perfiles').select('rol,correo,telefono,nombre_completo,usuario').eq('id', user.id).single()
    if (!profile || profile.rol !== 'administrador') return json({ error: 'Solo un administrador puede modificar esta cuenta.' }, 403)
    const body = await request.json()

    if (body.action === 'profile') {
      const email = String(body.email || '').trim().toLowerCase()
      const phone = String(body.phone || '').trim()
      const username = String(body.username || '').trim().toLowerCase()
      const name = String(body.name || '').trim()
      await verifyCurrentPassword(user.email, String(body.password || ''), user.id)
      if (email && !/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Ingresa un correo válido.' }, 400)
      if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) return json({ error: 'El teléfono debe usar formato internacional, por ejemplo +573001234567.' }, 400)
      if (username && !/^[a-z0-9._-]{3,32}$/.test(username)) return json({ error: 'El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.' }, 400)
      if (name.length < 3 || name.length > 120) return json({ error: 'El nombre debe tener entre 3 y 120 caracteres.' }, 400)
      const emailChanged = email && email !== (profile.correo || user.email || '').toLowerCase()
      const phoneChanged = phone && phone !== (profile.telefono || '')
      const usernameChanged = username !== (profile.usuario || '').toLowerCase()
      const nameChanged = name !== (profile.nombre_completo || '')
      if (!emailChanged && !phoneChanged && !usernameChanged && !nameChanged) return json({ error: 'No hay cambios para guardar.' }, 400)
      if (emailChanged || phoneChanged) {
        const { error: authUpdate } = await admin.auth.admin.updateUserById(user.id, { email: email || user.email, phone: phone || undefined })
        if (authUpdate) throw authUpdate
      }
      const { error: updateError } = await admin.from('perfiles').update({ correo: email || profile.correo, telefono: phone || profile.telefono, usuario: username || null, nombre_completo: name }).eq('id', user.id)
      if (updateError) throw updateError
      return json({ ok: true })
    }

    if (body.action === 'password-request') {
      const email = profile.correo || user.email
      if (!email) return json({ error: 'La cuenta no tiene un correo para recibir el código.' }, 400)
      const solicitudId = crypto.randomUUID()
      const code = makeCode()
      const { error: insertError } = await admin.from('verificaciones_cuenta').insert({
        solicitud_id: solicitudId, usuario_id: user.id, proposito: 'contrasena', canal: 'email', destino: email,
        codigo_hash: await hash(code), expira_en: new Date(now().getTime() + 10 * 60 * 1000).toISOString(),
      })
      if (insertError) throw insertError
      await sendEmail(email, code)
      return json({ solicitudId, canales: ['email'], venceEnMinutos: 10 })
    }

    if (body.action === 'password-confirm') {
      const newPassword = String(body.newPassword || '')
      if (newPassword.length < 12) return json({ error: 'La nueva contraseña debe tener al menos 12 caracteres.' }, 400)
      const solicitudId = String(body.solicitudId || '')
      await verifyRequestCode(admin, user.id, solicitudId, 'contrasena', body.codes || {})
      const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, { password: newPassword })
      if (passwordError) throw passwordError
      await admin.from('verificaciones_cuenta').delete().eq('solicitud_id', solicitudId).eq('proposito', 'contrasena')
      return json({ ok: true })
    }
    return json({ error: 'Acción no válida.' }, 400)
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Error interno.' }, 500) }
})
