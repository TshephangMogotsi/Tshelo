import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { getSupabaseAdminConfig } from '@/lib/config'

export const runtime = 'nodejs'
const response = (status: number, message: string) => Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  // Explicit rollout gate: CAPTCHA, trusted proxy and cleanup must be ready.
  const secret = process.env.WAITLIST_TURNSTILE_SECRET_KEY
  const hashKey = process.env.WAITLIST_RATE_LIMIT_KEY
  const hostname = process.env.WAITLIST_TURNSTILE_HOSTNAME
  if (process.env.WAITLIST_ENABLED !== 'true' || process.env.VERCEL !== '1' || !secret || !hashKey || !hostname) {
    return response(503, 'The waitlist is currently unavailable.')
  }
  const ip = request.headers.get('x-vercel-forwarded-for')?.trim() ?? ''
  if (!isIP(ip)) return response(503, 'The waitlist is currently unavailable.')
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return response(400, 'Use a JSON request.')
  if (Number(request.headers.get('content-length')) > 4096) return response(413, 'Request too large.')
  let input: Record<string, unknown>
  try {
    const reader = request.body?.getReader()
    if (!reader) return response(400, 'Invalid request.')
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 4096) { await reader.cancel(); return response(413, 'Request too large.') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    input = JSON.parse(new TextDecoder().decode(bytes))
    if (!input || typeof input !== 'object' || Array.isArray(input)) return response(400, 'Invalid request.')
  } catch { return response(400, 'Invalid request.') }
  if (Object.keys(input).some(k => !['country_code','email','phone','captcha_token'].includes(k))) return response(400, 'Invalid request.')
  const country = typeof input.country_code === 'string' ? input.country_code.trim().toUpperCase() : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : null
  const phone = typeof input.phone === 'string' ? input.phone.trim() : null
  const token = typeof input.captcha_token === 'string' ? input.captcha_token : ''
  if ((input.email !== undefined && typeof input.email !== 'string') || (input.phone !== undefined && typeof input.phone !== 'string')
    || !/^[A-Z]{3}$/.test(country) || (!email && !phone)
    || (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    || (phone && !/^\+[1-9][0-9]{6,14}$/.test(phone)) || !token || token.length > 2048) return response(400, 'Invalid request.')
  const digest = (kind: string, value: string) => createHmac('sha256', hashKey).update(`${kind}:${value}`).digest('hex')
  try {
    const { url, key } = getSupabaseAdminConfig()
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const limits = await client.rpc('consume_country_waitlist_limits', {
      p_ip_key: digest('ip', ip), p_contact_keys: [email ? digest('email', email) : null, phone ? digest('phone', phone) : null].filter(Boolean),
    })
    if (limits.error) return response(503, 'The waitlist is currently unavailable.')
    if (limits.data !== true) return response(429, 'Please try again later.')
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: token, remoteip: ip }), signal: AbortSignal.timeout(8000),
    })
    if (!verification.ok) return response(503, 'The waitlist is currently unavailable.')
    const result = await verification.json()
    if (result.success !== true || result.hostname !== hostname || result.action !== 'country_waitlist') return response(400, 'Please complete the verification again.')
    const submitted = await client.rpc('submit_country_waitlist', { p_country: country, p_email: email || null, p_phone: phone || null })
    if (submitted.error) return response(submitted.error.message.includes('WAITLIST_INVALID') ? 400 : 503, 'Unable to accept this request.')
    return response(200, 'Your request has been received.')
  } catch { return response(503, 'The waitlist is currently unavailable.') }
}
