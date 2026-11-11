import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupabaseAdminConfig } from '@/lib/config'

export const runtime = 'nodejs'

// Registration stays closed unless the operator explicitly enables it and
// supplies approved email addresses in server-only configuration.
export async function POST(request: Request) {
  const denied = () => NextResponse.json({ message: 'Registration is unavailable. Contact the Tshelo team.' }, { status: 403 })
  if (process.env.BETA_WEB_REGISTRATION_ENABLED !== 'true') return denied()

  const input = await request.json().catch(() => null) as { email?: unknown } | null
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return denied()
  const approved = (process.env.BETA_WEB_APPROVED_EMAILS ?? '').split(',').map(value => value.trim().toLowerCase())
  if (!approved.includes(email)) return denied()

  try {
    const { url, key } = getSupabaseAdminConfig()
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    // Bind approval to an unpredictable Auth ID before insertion. Auth applies
    // custom app_metadata after the profile trigger has already run.
    const id = randomUUID()
    const approval = await supabase.rpc('authorize_beta_signup', { p_user_id: id, p_email: email })
    if (approval.error) throw new Error('Signup authorization failed')
    let error: { code?: string } | null
    try {
      const created = await supabase.auth.admin.createUser({ id, email, app_metadata: { beta_web_approved: true } })
      error = created.error
    } finally {
      await supabase.from('beta_signup_authorizations').delete().eq('user_id', id)
    }
    // An existing approved account can use the same verification and onboarding flow.
    if (error && error.code !== 'email_exists' && error.code !== 'user_already_exists') {
      return NextResponse.json({ message: 'Registration is temporarily unavailable. Please try again.' }, { status: 503 })
    }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ message: 'Registration is temporarily unavailable. Please try again.' }, { status: 503 })
  }
}
