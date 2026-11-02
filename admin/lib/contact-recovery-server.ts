import 'server-only'

import { createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/api/auth'
import { getSupabaseAdminConfig, getSupabaseConfig } from '@/lib/config'
import { extractBearerJwt } from '@shared/contracts/auth'

const headers = { 'Cache-Control': 'no-store' }
const fail = (message: string, status = 400) => Response.json({ message }, { status, headers })
const ok = (data: Record<string, unknown>) => Response.json(data, { headers })
const validCode = (value: unknown): value is string => typeof value === 'string' && /^\d{6,10}$/.test(value)
const validId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const digits = (value: string | undefined) => (value ?? '').replace(/\D/g, '')
const normalizeEmail = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : ''
const normalizePhone = (value: unknown) => typeof value === 'string' ? value.trim().replace(/[\s()-]/g, '') : ''
const digest = (key: string, id: string, code: string) => createHmac('sha256', key).update(`${id}:${code}`).digest('hex')

function ephemeralClient() {
  const { url, key } = getSupabaseConfig()
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}
function adminClient() {
  const { url, key } = getSupabaseAdminConfig()
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

async function eligible(admin: SupabaseClient, id: string): Promise<User | null> {
  const [{ data: auth, error }, profile, platformAdmin, factors] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from('users').select('id,is_banned,deleted_at').eq('id', id).maybeSingle(),
    admin.from('platform_admins').select('user_id').eq('user_id', id).eq('is_active', true).maybeSingle(),
    admin.auth.admin.mfa.listFactors({ userId: id }),
  ])
  if (error || profile.error || platformAdmin.error || factors.error || !factors.data || factors.data.factors.some(factor => factor.status === 'verified') || !auth.user || !profile.data || profile.data.is_banned || profile.data.deleted_at || platformAdmin.data || auth.user.app_metadata?.google_play_reviewer === true) return null
  if (auth.user.banned_until && new Date(auth.user.banned_until).getTime() > Date.now()) return null
  return auth.user
}

async function sendNewEmailCode(email: string, code: string) {
  const key = process.env.RECOVERY_EMAIL_API_KEY
  const from = process.env.RECOVERY_EMAIL_FROM
  if (!key || !from) throw new Error('Email delivery unavailable')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [email], subject: 'Confirm your Tshelo sign-in email', text: `Your Tshelo verification code is ${code}. It expires in 10 minutes. Do not share this code. If you did not request this, contact Tshelo support.` }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error('Email delivery unavailable')
}

async function sendRecoveryNotice(emails: string[]) {
  const key = process.env.RECOVERY_EMAIL_API_KEY
  const from = process.env.RECOVERY_EMAIL_FROM
  if (!key || !from || emails.length === 0) return false
  const results = await Promise.allSettled([...new Set(emails)].map(email => fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [email], subject: 'Your Tshelo sign-in details changed', text: 'Your Tshelo sign-in details were changed. If you did not request this, contact Tshelo support immediately.' }),
    signal: AbortSignal.timeout(12_000),
  })))
  return results.every(result => result.status === 'fulfilled' && result.value.ok)
}

export async function handleContactRecovery(request: Request) {
  if (process.env.TSHELO_RECOVERY_ENABLED !== 'true') return fail('Recovery is unavailable. Contact support.', 503)
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return fail('Please sign in again.', 401)
  if (!request.headers.get('content-type')?.includes('application/json')) return fail('Invalid request.')
  const raw = await request.text()
  if (raw.length > 2048) return fail('Invalid request.')
  let input: Record<string, unknown>
  try { input = JSON.parse(raw) as Record<string, unknown> } catch { return fail('Invalid request.') }
  if (!input || typeof input !== 'object' || !['phone', 'email'].includes(String(input.target))) return fail('Invalid request.')
  const target = input.target as 'phone' | 'email'
  const userId = authentication.auth.actor.user_id
  const secret = process.env.RECOVERY_CHALLENGE_SECRET
  if (!secret || secret.length < 32) return fail('Recovery is unavailable. Contact support.', 503)

  try {
    const admin = adminClient()
    const user = await eligible(admin, userId)
    if (!user) return fail('Recovery is unavailable for this account. Contact support.', 403)

    if (input.action === 'start') {
      const destination = target === 'email' ? normalizeEmail(input.destination) : normalizePhone(input.destination)
      if (!validCode(input.code) || (target === 'email' ? destination.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination) : !/^\+[1-9]\d{6,14}$/.test(destination))) return fail('Enter valid details and a verification code.')
      const source = target === 'email' ? user.phone : user.email
      const sourceConfirmed = target === 'email' ? user.phone_confirmed_at : user.email_confirmed_at
      if (!source || !sourceConfirmed) return fail('A verified alternate sign-in method is required. Contact support.', 403)
      if (target === 'email') {
        // Static beta OTPs are not proof of control of a phone. The operator
        // must audit the hosted test-OTP list and keep this denylist current.
        if (process.env.RECOVERY_STATIC_OTP_AUDITED !== 'true') return fail('Phone verification is unavailable. Contact support.', 503)
        const blocked = (process.env.RECOVERY_STATIC_OTP_BLOCKLIST ?? '').split(',').map(value => digits(value))
        if (blocked.includes(digits(source))) return fail('Recovery is unavailable for this number. Contact support.', 403)
      }
      if (target === 'email' && user.email?.toLowerCase() === destination) return fail('Enter a different email address.')
      if (target === 'phone' && digits(user.phone) === digits(destination)) return fail('Enter a different phone number.')
      if (target === 'email' && (!process.env.RECOVERY_EMAIL_API_KEY || !process.env.RECOVERY_EMAIL_FROM)) return fail('Email recovery is unavailable. Contact support.', 503)
      // Supabase can auto-confirm a phone change before the destination OTP.
      // Never attempt a change until the hosted setting is explicitly checked.
      if (target === 'phone' && process.env.RECOVERY_SMS_AUTOCONFIRM_DISABLED !== 'true') return fail('Phone recovery is unavailable. Contact support.', 503)

      // Verify the existing contact's one-time code on the server and bind the
      // result to the authenticated account, never to a user-supplied identity.
      const authClient = ephemeralClient()
      const verified = target === 'email'
        ? await authClient.auth.verifyOtp({ phone: source.startsWith('+') ? source : `+${source}`, token: input.code, type: 'sms' })
        : await authClient.auth.verifyOtp({ email: source, token: input.code, type: 'email' })
      if (verified.error || !verified.data.user || verified.data.user.id !== userId || !verified.data.session) {
        if (verified.data.session) await authClient.auth.signOut({ scope: 'local' })
        return fail('The verification code is invalid or expired.')
      }
      const id = randomUUID()
      const emailCode = target === 'email' ? String(randomInt(0, 100_000_000)).padStart(8, '0') : null
      const proof = randomBytes(32).toString('hex')
      // For phone challenges the random proof binds the follow-up request to
      // the party that completed source verification; no OTP is stored.
      const codeDigest = target === 'email' ? digest(secret, id, `${proof}:${emailCode}`) : digest(secret, id, proof)
      const created = await admin.rpc('create_contact_recovery_challenge', { p_id: id, p_user_id: userId, p_target: target, p_destination: destination, p_source: source, p_digest: codeDigest })
      if (created.error || created.data !== true) {
        await authClient.auth.signOut({ scope: 'local' })
        return fail('Too many recovery attempts. Please try later.', 429)
      }
      try {
        if (emailCode) await sendNewEmailCode(destination, emailCode)
        else {
          const change = await authClient.auth.updateUser({ phone: destination })
          if (change.error) throw change.error
        }
      } catch {
        await admin.from('contact_recovery_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
        await authClient.auth.signOut({ scope: 'local' })
        return fail('Could not send the verification code. Please try again.', 503)
      }
      await authClient.auth.signOut({ scope: 'local' })
      return ok({ challengeId: id, proof })
    }

    if (input.action === 'finish') {
      if (!validId(input.challengeId) || typeof input.proof !== 'string' || !/^[0-9a-f]{64}$/.test(input.proof) || !validCode(input.code)) return fail('Invalid request.')
      const { data: challenge, error } = await admin.from('contact_recovery_challenges').select('destination,source,expires_at,consumed_at').eq('id', input.challengeId).eq('user_id', userId).eq('target', target).maybeSingle()
      if (error || !challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now()) return fail('The recovery request has expired. Start again.')
      const actualSource = target === 'email' ? user.phone : user.email
      const sourceConfirmed = target === 'email' ? user.phone_confirmed_at : user.email_confirmed_at
      if (!actualSource || !sourceConfirmed || (target === 'email' ? digits(actualSource) !== digits(challenge.source) : actualSource.toLowerCase() !== challenge.source.toLowerCase())) return fail('Your sign-in details changed. Start again.')
      if (target === 'phone') {
        // Do not invoke Auth until the source-bound proof has been checked. A
        // correct proof is also required to consume the challenge below.
        const expectedProof = digest(secret, input.challengeId, input.proof)
        const { data: row, error: proofError } = await admin.from('contact_recovery_challenges').select('id').eq('id', input.challengeId).eq('user_id', userId).eq('code_digest', expectedProof).is('consumed_at', null).maybeSingle()
        if (proofError || !row) return fail('The recovery request is invalid. Start again.')
        const destinationClient = ephemeralClient()
        const verified = await destinationClient.auth.verifyOtp({ phone: challenge.destination, token: input.code, type: 'phone_change' })
        if (verified.data.session) await destinationClient.auth.signOut({ scope: 'local' })
        if (verified.error || !verified.data.user || verified.data.user.id !== userId || digits(verified.data.user.phone) !== digits(challenge.destination) || !verified.data.user.phone_confirmed_at) return fail('The verification code is invalid or expired.')
      }
      const codeDigest = target === 'email' ? digest(secret, input.challengeId, `${input.proof}:${input.code}`) : digest(secret, input.challengeId, input.proof)
      const consumed = await admin.rpc('consume_contact_recovery_challenge', { p_id: input.challengeId, p_user_id: userId, p_target: target, p_digest: codeDigest })
      if (consumed.error || !Array.isArray(consumed.data) || consumed.data.length !== 1) return fail('The verification code is invalid or expired.')
      if (target === 'email') {
        // Source phone and destination email were independently verified for
        // this account; no change to Supabase's global email policy is needed.
        const updated = await admin.auth.admin.updateUserById(userId, { email: challenge.destination, email_confirm: true })
        if (updated.error || updated.data.user?.email?.toLowerCase() !== challenge.destination) return fail('The email could not be updated. Contact support.', 503)
      }
      const noticeAddresses = target === 'email'
        ? [user.email, challenge.destination].filter((value): value is string => Boolean(value))
        : [user.email].filter((value): value is string => Boolean(value))
      const noticeSent = await sendRecoveryNotice(noticeAddresses)
      const token = extractBearerJwt(request.headers.get('authorization'))
      const signOut = token ? await admin.auth.admin.signOut(token, 'global') : { error: new Error('Session missing') }
      return ok({ completed: true, noticeSent, sessionsRevoked: !signOut.error })
    }
    return fail('Invalid request.')
  } catch {
    return fail('Recovery is temporarily unavailable. Please try again.', 503)
  }
}
