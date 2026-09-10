jest.mock('server-only', () => ({}), { virtual: true })

import { validateUpdateEventRequest } from '../../admin/lib/api/validation'

describe('event schedule request validation', () => {
  it('accepts recognised IANA zones and optional ordered RSVP deadlines', () => {
    expect(validateUpdateEventRequest({ time_zone: 'Africa/Gaborone' }).ok).toBe(true)
    expect(validateUpdateEventRequest({ rsvp_deadline: null }).ok).toBe(true)
    expect(validateUpdateEventRequest({
      event_date: '2026-09-19',
      rsvp_deadline: '2026-09-18',
      event_time: '14:00:00',
      event_end_time: '20:00:00',
    }).ok).toBe(true)
  })

  it.each([
    { time_zone: '' },
    { time_zone: null },
    { time_zone: 'Mars/Olympus' },
    { time_zone: 'africa/gaborone' },
    { time_zone: 'US/Eastern' },
    { time_zone: 'A'.repeat(101) },
    { rsvp_deadline: '18-09-2026' },
    { event_date: '2026-09-19', rsvp_deadline: '2026-09-20' },
    { time_zone: 'Africa/Gaborone', utc_offset: '+02:00' },
  ])('rejects ambiguous or invalid schedule metadata: %o', body => {
    expect(validateUpdateEventRequest(body).ok).toBe(false)
  })
})
