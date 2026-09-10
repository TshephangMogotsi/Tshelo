jest.mock('server-only', () => ({}), { virtual: true })

import { eventInvitationEmailContent } from '../../admin/lib/event-invitation-email'

describe('event invitation email', () => {
  const event = {
    name: "Kabo & Neo's Celebration",
    event_date: '2026-09-19',
    event_time: '14:30:00',
    venue_name: 'Cresta Botsalo',
    share_code: 'INVITE-ABC123',
    event_code: 'EVENT-ABC123',
  }

  const guest = {
    id: 'guest-1',
    guest_name: '<Tshephang>',
    guest_email: 'guest@example.com',
    allowed_plus_ones: 2,
  }

  it('renders a branded card with escaped event details and one canonical RSVP target', () => {
    const content = eventInvitationEmailContent(event, guest)

    expect(content.subject).toBe("You're invited to Kabo & Neo's Celebration")
    expect(content.html).toContain('https://app.tshelo.com/tshelo-icon.png')
    expect(content.html).toContain('background:#6840f2')
    expect(content.html).toContain('Community money, clearly organised.')
    expect(content.html).toContain('Hi &lt;Tshephang&gt;,')
    expect(content.html).toContain('Kabo &amp; Neo&#39;s Celebration')
    expect(content.html).toContain('Plus-ones')
    expect(content.html).toContain('Up to 2 guests')
    expect(content.html).not.toContain("Hi <Tshephang>,")
    expect(content.html.match(/https:\/\/app\.tshelo\.com\/invite\/event\/INVITE-ABC123/g)).toHaveLength(2)
  })

  it('keeps an accessible plain-text fallback with the invitation code', () => {
    const content = eventInvitationEmailContent(event, guest)

    expect(content.text).toContain('Date: Saturday, September 19, 2026')
    expect(content.text).toContain('Time: 14:30')
    expect(content.text).toContain('Venue: Cresta Botsalo')
    expect(content.text).toContain('Plus-ones: Up to 2 guests')
    expect(content.text).toContain('View the invitation and RSVP: https://app.tshelo.com/invite/event/INVITE-ABC123')
    expect(content.text).toContain('Invitation code: INVITE-ABC123')
  })

  it('states clearly when the invitation does not include a plus-one', () => {
    const content = eventInvitationEmailContent(event, { ...guest, allowed_plus_ones: 0 })

    expect(content.html).toContain('None included')
    expect(content.text).toContain('Plus-ones: None included')
  })
})
