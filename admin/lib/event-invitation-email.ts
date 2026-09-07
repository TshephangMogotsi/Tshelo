import 'server-only'

import type { Event, EventGuest } from '@shared/contracts/events'
import { invitationUrl } from '@shared/invitations'

const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Tshelo <no-reply@tshelo.com>'

type EventInvitationContext = Pick<
  Event,
  'name' | 'event_date' | 'event_time' | 'venue_name' | 'share_code' | 'event_code'
>

type EventInvitationGuest = Pick<EventGuest, 'id' | 'guest_name' | 'guest_email'>

type ResendEmailResponse = {
  id?: string
}

export class EventInvitationEmailError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EventInvitationEmailError'
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function eventDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(date)
}

function eventTimeLabel(value: string | null) {
  if (!value) return null
  return value.slice(0, 5)
}

function displayName(value: string | null) {
  return value?.trim() || 'there'
}

function emailSubject(eventName: string) {
  const normalized = eventName.replace(/\s+/g, ' ').trim().slice(0, 140)
  return `You're invited to ${normalized || 'a Tshelo event'}`
}

function emailContent(event: EventInvitationContext, guest: EventInvitationGuest) {
  const inviteCode = event.share_code || event.event_code
  const inviteUrl = invitationUrl('event', inviteCode)
  const details = [
    `Date: ${eventDateLabel(event.event_date)}`,
    eventTimeLabel(event.event_time) ? `Time: ${eventTimeLabel(event.event_time)}` : null,
    event.venue_name?.trim() ? `Venue: ${event.venue_name.trim()}` : null,
  ].filter((detail): detail is string => Boolean(detail))
  const safeName = escapeHtml(displayName(guest.guest_name))
  const safeEventName = escapeHtml(event.name)
  const safeUrl = escapeHtml(inviteUrl)
  const safeDetails = details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')

  return {
    subject: emailSubject(event.name),
    text: [
      `Hi ${displayName(guest.guest_name)},`,
      '',
      `You're invited to ${event.name}.`,
      ...details,
      '',
      `View the invitation and RSVP: ${inviteUrl}`,
      '',
      'Sent by Tshelo',
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6f7f9;color:#1f2937;font-family:Arial,sans-serif;line-height:1.5">
    <main style="max-width:560px;margin:32px auto;padding:32px;background:#ffffff;border-radius:16px">
      <p style="margin:0 0 16px">Hi ${safeName},</p>
      <h1 style="margin:0 0 16px;font-size:24px">You're invited to ${safeEventName}</h1>
      ${safeDetails ? `<ul style="padding-left:20px;margin:0 0 24px">${safeDetails}</ul>` : ''}
      <p style="margin:0 0 28px"><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px">View invitation &amp; RSVP</a></p>
      <p style="margin:0;color:#6b7280;font-size:13px">If the button does not open, use this link:<br><a href="${safeUrl}">${safeUrl}</a></p>
    </main>
  </body>
</html>`,
  }
}

/** Sends one guest invitation through Resend. This module is server-only. */
export async function sendEventInvitationEmail(
  event: EventInvitationContext,
  guest: EventInvitationGuest,
) {
  const apiKey = process.env.RESEND_EVENT_INVITE_API_KEY
  if (!apiKey) {
    throw new EventInvitationEmailError('RESEND_EVENT_INVITE_API_KEY is not configured.')
  }
  if (!guest.guest_email) {
    throw new EventInvitationEmailError('The guest does not have an email address.')
  }

  const content = emailContent(event, guest)
  let response: Response
  try {
    response = await fetch(RESEND_EMAILS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `event-guest-invite-${guest.id}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to: [guest.guest_email],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw new EventInvitationEmailError('Resend could not be reached.')
  }

  if (!response.ok) {
    throw new EventInvitationEmailError(`Resend rejected the invitation email (HTTP ${response.status}).`)
  }

  const data = await response.json().catch(() => null) as ResendEmailResponse | null
  if (!data?.id) {
    throw new EventInvitationEmailError('Resend did not return an email identifier.')
  }

  return { id: data.id }
}
