import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupabaseAdminConfig } from '@/lib/config'

export const runtime = 'nodejs'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(request: Request) {
  const form = await request.formData()
  const rawToken = form.get('token')
  const token = typeof rawToken === 'string' ? rawToken.trim() : ''
  const completeUrl = new URL('/legal/account-deletion/verify/complete', request.url)

  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) {
    completeUrl.searchParams.set('status', 'invalid')
    return NextResponse.redirect(completeUrl, 303)
  }

  try {
    const { url, key } = getSupabaseAdminConfig()
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await supabase.rpc('consume_verified_account_closure_request', {
      p_token_hash: hashToken(token),
    })
    if (error) throw error

    const ticketNumber = Array.isArray(data) ? data[0]?.ticket_number : null
    completeUrl.searchParams.set('status', typeof ticketNumber === 'string' ? 'confirmed' : 'invalid')
  } catch (error) {
    console.error('Unable to confirm account deletion request', error)
    completeUrl.searchParams.set('status', 'error')
  }

  return NextResponse.redirect(completeUrl, 303)
}
