import { buildCalendarEventDetails } from '../calendar'

describe('buildCalendarEventDetails', () => {
  it('builds a timed event and defaults its duration to one hour', () => {
    const result = buildCalendarEventDetails({
      title: 'Wedding',
      eventDate: '2026-08-20',
      eventTime: '14:30:00',
      venue: 'Cresta Botsalo',
      shareCode: 'EVT-123',
    })

    expect(result?.title).toBe('Wedding')
    expect(result?.startDate.getHours()).toBe(14)
    expect(result?.startDate.getMinutes()).toBe(30)
    expect(result?.endDate.getTime()).toBe((result?.startDate.getTime() ?? 0) + 60 * 60 * 1000)
    expect(result?.location).toBe('Cresta Botsalo')
    expect(result?.notes).toContain('EVT-123')
    expect(result?.allDay).toBe(false)
  })

  it('uses the configured end date and time', () => {
    const result = buildCalendarEventDetails({
      title: 'Conference',
      eventDate: '2026-08-20',
      eventTime: '09:00:00',
      eventEndDate: '2026-08-21',
      eventEndTime: '16:00:00',
    })

    expect(result?.endDate.getDate()).toBe(21)
    expect(result?.endDate.getHours()).toBe(16)
  })

  it('creates an all-day entry when no time is available', () => {
    const result = buildCalendarEventDetails({ title: 'Festival', eventDate: '2026-08-20' })
    expect(result?.allDay).toBe(true)
    expect(result?.endDate.getTime()).toBe((result?.startDate.getTime() ?? 0) + 24 * 60 * 60 * 1000)
  })

  it('rejects an invalid event date', () => {
    expect(buildCalendarEventDetails({ title: 'Invalid', eventDate: '2026-02-31' })).toBeNull()
  })
})
