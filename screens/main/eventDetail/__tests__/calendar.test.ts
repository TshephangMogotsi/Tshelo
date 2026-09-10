import { buildCalendarEventDetails } from '../calendar'

describe('buildCalendarEventDetails', () => {
  it('builds a timed event and defaults its duration to one hour', () => {
    const result = buildCalendarEventDetails({
      title: 'Wedding',
      eventDate: '2026-08-20',
      eventTime: '14:30:00',
      venue: 'Cresta Botsalo',
      timeZone: 'Africa/Gaborone',
      rsvpDeadline: '2026-08-18',
    })

    expect(result?.title).toBe('Wedding')
    expect(result?.startDate.toISOString()).toBe('2026-08-20T12:30:00.000Z')
    expect(result?.endDate.getTime()).toBe((result?.startDate.getTime() ?? 0) + 60 * 60 * 1000)
    expect(result?.location).toBe('Cresta Botsalo')
    expect(result?.notes).toContain('Africa/Gaborone')
    expect(result?.notes).toContain('2026-08-18')
    expect(result?.notes).not.toContain('EVT-')
    expect(result?.allDay).toBe(false)
  })

  it('uses the configured end date and time', () => {
    const result = buildCalendarEventDetails({
      title: 'Conference',
      eventDate: '2026-08-20',
      eventTime: '09:00:00',
      eventEndDate: '2026-08-21',
      eventEndTime: '16:00:00',
      timeZone: 'Africa/Gaborone',
    })

    expect(result?.endDate.toISOString()).toBe('2026-08-21T14:00:00.000Z')
  })

  it('creates an all-day entry when no time is available', () => {
    const result = buildCalendarEventDetails({ title: 'Festival', eventDate: '2026-08-20' })
    expect(result?.allDay).toBe(true)
    expect(result?.endDate.getTime()).toBe((result?.startDate.getTime() ?? 0) + 24 * 60 * 60 * 1000)
  })

  it('keeps a multi-day all-day event inclusive of its saved end date', () => {
    const result = buildCalendarEventDetails({
      title: 'Festival',
      eventDate: '2026-08-20',
      eventEndDate: '2026-08-22',
    })
    expect(result?.allDay).toBe(true)
    expect((result?.endDate.getTime() ?? 0) - (result?.startDate.getTime() ?? 0)).toBe(3 * 24 * 60 * 60 * 1000)
  })

  it('rejects an invalid event date', () => {
    expect(buildCalendarEventDetails({ title: 'Invalid', eventDate: '2026-02-31' })).toBeNull()
  })
})
