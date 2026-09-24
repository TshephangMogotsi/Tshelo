import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupabaseConfig } from '@/lib/config'

export const runtime = 'nodejs'

const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails'
const SUPPORT_EMAIL = 'support@tshelo.co.bw'
const MAX_REQUESTS_PER_WINDOW = 3
const REQUEST_WINDOW_MS = 15 * 60 * 1000

type RateLimitEntry = { count: number; resetAt: number }
const rateLimit = new Map<string, RateLimitEntry>()

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function requestIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
}

function allowedToSubmit(ip: string) {
  const now = Date.now()
  const entry = rateLimit.get(ip)
  if (!entry || entry.resetAt <= now) {
    rateLimit.set(ip, { count: 1, resetAt: now + REQUEST_WINDOW_MS })
    return true
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) return false
  entry.count += 1
  return true
}

async function sendReceipt(email: string, phone: string, notes: string, ticketNumber: string | null) {
  const apiKey = process.env.RESEND_ACCOUNT_DELETION_API_KEY ?? process.env.RESEND_EVENT_INVITE_API_KEY
  if (!apiKey) return false

  const safeEmail = escapeHtml(email)
  const safePhone = escapeHtml(phone || 'Not provided')
  const safeNotes = escapeHtml(notes || 'Not provided')
  const ticketLine = ticketNumber ? `Reference: ${ticketNumber}` : 'Reference: Account deletion request'
  const from = process.env.RESEND_FROM_EMAIL || 'Tshelo <no-reply@tshelo.com>'
  const deliveries = [
    {
      to: [email],
      subject: 'We received your Tshelo account deletion request',
      text: `We received your Tshelo account deletion request. ${ticketLine}\n\nWe will verify ownership before closing anything. Our target for a straightforward, verified request is 30 days. Do not send passwords, one-time codes, or bank details.\n\nNeed help? ${SUPPORT_EMAIL}`,
      html: `<p>We received your <strong>Tshelo account deletion request</strong>.</p><p>${escapeHtml(ticketLine)}</p><p>We will verify ownership before closing anything. Our target for a straightforward, verified request is 30 days.</p><p>Do not send passwords, one-time codes, or bank details.</p><p>Need help? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`,
    },
    {
      to: [SUPPORT_EMAIL],
      subject: `Account deletion request${ticketNumber ? ` · ${ticketNumber}` : ''}`,
      text: `A public account deletion request was submitted.\n${ticketLine}\nContact email: ${email}\nTshelo mobile: ${phone || 'Not provided'}\nNotes: ${notes || 'Not provided'}\n\nVerify ownership before taking any account action.`,
      html: `<p>A public account deletion request was submitted.</p><p><strong>${escapeHtml(ticketLine)}</strong></p><ul><li>Contact email: ${safeEmail}</li><li>Tshelo mobile: ${safePhone}</li><li>Notes: ${safeNotes}</li></ul><p>Verify ownership before taking any account action.</p>`,
    },
  ]

  const results = await Promise.allSettled(deliveries.map(async delivery => {
    const response = await fetch(RESEND_EMAILS_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, ...delivery }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) throw new Error(`Resend rejected the request (HTTP ${response.status}).`)
  }))
  return results[0]?.status === 'fulfilled'
}

export async function POST(request: Request) {
  if (!allowedToSubmit(requestIp(request))) {
    return NextResponse.json({ message: 'Too many requests. Please try again in a few minutes.' }, { status: 429 })
  }

  const input = await request.json().catch(() => null) as Record<string, unknown> | null
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : ''
  const phone = typeof input?.phone === 'string' ? input.phone.trim() : ''
  const notes = typeof input?.notes === 'string' ? input.notes.trim() : ''
  const acknowledged = input?.acknowledged === true
  const website = typeof input?.website === 'string' ? input.website.trim() : ''

  if (website) return NextResponse.json({ ok: true })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 || phone.length > 24 || notes.length > 500 || !acknowledged) {
    return NextResponse.json({ message: 'Please provide a valid email address and confirm the acknowledgement.' }, { status: 400 })
  }

  const { url, key } = getSupabaseConfig()
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await supabase.rpc('submit_public_account_closure_request', {
    p_contact_email: email,
    p_account_phone: phone || null,
    p_notes: notes || null,
  })
  if (error) {
    console.error('Unable to record public account deletion request', { code: error.code, message: error.message })
    return NextResponse.json({ message: 'We could not record the request. Please email support@tshelo.co.bw.' }, { status: 503 })
  }

  const ticketNumber = Array.isArray(data) ? data[0]?.ticket_number : null
  const receiptSent = await sendReceipt(email, phone, notes, typeof ticketNumber === 'string' ? ticketNumber : null)
  return NextResponse.json({ ok: true, receiptSent })
}
