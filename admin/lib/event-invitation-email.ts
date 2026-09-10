import 'server-only'

import type { Event, EventGuest } from '@shared/contracts/events'
import { INVITATION_WEB_ORIGIN, invitationUrl } from '@shared/invitations'

const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Tshelo <no-reply@tshelo.com>'

type EventInvitationContext = Pick<
  Event,
  'name' | 'event_date' | 'event_time' | 'venue_name' | 'share_code' | 'event_code'
>

type EventInvitationGuest = Pick<EventGuest, 'id' | 'guest_name' | 'guest_email' | 'allowed_plus_ones'>

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

function plusOneLabel(value: number) {
  if (value <= 0) return 'None included'
  return `Up to ${value} guest${value === 1 ? '' : 's'}`
}

function emailSubject(eventName: string) {
  const normalized = eventName.replace(/\s+/g, ' ').trim().slice(0, 140)
  return `You're invited to ${normalized || 'a Tshelo event'}`
}

export function eventInvitationEmailContent(event: EventInvitationContext, guest: EventInvitationGuest) {
  const inviteCode = event.share_code || event.event_code
  const inviteUrl = invitationUrl('event', inviteCode)
  const logoUrl = `${INVITATION_WEB_ORIGIN}/tshelo-icon.png`
  const details = [
    ['Date', eventDateLabel(event.event_date)],
    eventTimeLabel(event.event_time) ? ['Time', eventTimeLabel(event.event_time)] : null,
    event.venue_name?.trim() ? ['Venue', event.venue_name.trim()] : null,
    ['Plus-ones', plusOneLabel(guest.allowed_plus_ones)],
  ].filter((detail): detail is [string, string] => Boolean(detail))
  const safeName = escapeHtml(displayName(guest.guest_name))
  const safeEventName = escapeHtml(event.name)
  const safeUrl = escapeHtml(inviteUrl)
  const safeLogoUrl = escapeHtml(logoUrl)
  const safeInviteCode = escapeHtml(inviteCode)
  const detailText = details.map(([label, value]) => `${label}: ${value}`)
  const detailRows = details.map(([label, value], index) => `
                      <tr>
                        <td style="padding:${index === 0 ? '0' : '12px 0 0'};width:76px;color:#69738a;font-size:12px;font-weight:700;letter-spacing:.08em;line-height:20px;text-transform:uppercase;vertical-align:top">${escapeHtml(label)}</td>
                        <td style="padding:${index === 0 ? '0' : '12px 0 0'};color:#182138;font-size:15px;font-weight:600;line-height:20px;vertical-align:top">${escapeHtml(value)}</td>
                      </tr>`).join('')
  const previewText = escapeHtml(`${displayName(guest.guest_name)}, view the details and RSVP for ${event.name}.`)
  const year = new Date().getUTCFullYear()

  return {
    subject: emailSubject(event.name),
    text: [
      `Hi ${displayName(guest.guest_name)},`,
      '',
      `You're invited to ${event.name}.`,
      ...detailText,
      '',
      `View the invitation and RSVP: ${inviteUrl}`,
      `Invitation code: ${inviteCode}`,
      '',
      'Sent by Tshelo',
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(emailSubject(event.name))}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .email-shell { padding: 20px 12px !important; }
        .email-card { border-radius: 14px !important; }
        .email-content { padding: 32px 24px !important; }
        .email-footer { padding: 24px !important; }
        .email-heading { font-size: 30px !important; line-height: 37px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f5f4f8;color:#182138;font-family:Arial,'Helvetica Neue',sans-serif;line-height:1.5">
    <div style="display:none;font-size:1px;color:#f5f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${previewText}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f5f4f8">
      <tr>
        <td class="email-shell" align="center" style="padding:48px 20px">
          <table class="email-card" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #ebe8f0;border-radius:18px;border-collapse:separate;overflow:hidden">
            <tr>
              <td class="email-content" style="padding:40px 42px 38px">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:0 12px 0 0;vertical-align:middle">
                      <img src="${safeLogoUrl}" width="42" height="42" alt="Tshelo" style="display:block;width:42px;height:42px;border:0;border-radius:10px;object-fit:contain">
                    </td>
                    <td style="color:#151d33;font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:700;line-height:30px;vertical-align:middle">Tshelo</td>
                  </tr>
                </table>

                <div style="width:48px;height:3px;margin:26px 0 32px;background:#6840f2;border-radius:3px;font-size:0;line-height:0">&nbsp;</div>

                <h1 class="email-heading" style="margin:0 0 24px;color:#151d33;font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:700;letter-spacing:-.02em;line-height:42px">You're invited to ${safeEventName}</h1>
                <p style="margin:0 0 18px;color:#3f485b;font-size:16px;line-height:25px">Hi ${safeName},</p>
                <p style="margin:0 0 26px;color:#3f485b;font-size:16px;line-height:25px">You have been invited to join this event on Tshelo. Review the details below and let the organiser know if you can attend.</p>

                ${detailRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 30px;background:#f7f5ff;border:1px solid #e7e0ff;border-radius:12px"><tr><td style="padding:20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%">${detailRows}</table></td></tr></table>` : ''}

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">
                  <tr>
                    <td bgcolor="#6840f2" style="border-radius:9px">
                      <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;line-height:20px;text-decoration:none">View invitation &amp; RSVP</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 5px;color:#7b8496;font-size:12px;line-height:19px">Invitation code</p>
                <p style="margin:0 0 18px;color:#182138;font-family:'Courier New',monospace;font-size:15px;font-weight:700;letter-spacing:.08em;line-height:21px">${safeInviteCode}</p>
                <p style="margin:0;color:#7b8496;font-size:12px;line-height:19px">Button not working? <a href="${safeUrl}" target="_blank" style="color:#6840f2;font-weight:700;text-decoration:underline">Open the invitation in your browser</a>.</p>
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:26px 42px 30px;background:#fbfafd;border-top:1px solid #ebe8f0">
                <p style="margin:0 0 12px;color:#454e61;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-style:italic;line-height:24px">Community money, clearly organised.</p>
                <p style="margin:0 0 8px;color:#858c9b;font-size:12px;line-height:19px"><a href="${INVITATION_WEB_ORIGIN}" style="color:#6c7280;text-decoration:underline">Tshelo</a> &nbsp;·&nbsp; <a href="mailto:support@tshelo.co.bw" style="color:#6c7280;text-decoration:underline">support@tshelo.co.bw</a></p>
                <p style="margin:0;color:#9ba1ad;font-size:11px;line-height:17px">© ${year} Tshelo</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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

  const content = eventInvitationEmailContent(event, guest)
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
