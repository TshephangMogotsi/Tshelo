import {
  eventCountdownLabel,
  eventDurationLabel,
  eventLocalDateTime,
  eventTimeZoneLabel,
  isEventRsvpClosed,
  isRecognisedTimeZone,
  resolvedEventTimeZone,
  rsvpDeadlineDetails,
  type ScheduleEvent,
} from '../event-schedule'

const event: ScheduleEvent = {
  event_date: '2026-09-12',
  event_time: '18:00:00',
  event_end_date: '2026-09-12',
  event_end_time: '21:30:00',
  time_zone: 'Africa/Gaborone',
  rsvp_deadline: '2026-09-10',
  status: 'active',
}

describe('event schedule helpers', () => {
  it('turns an event wall-clock time into the correct UTC instant', () => {
    expect(eventLocalDateTime('2026-09-12', '18:00:00', 'Africa/Gaborone')?.toISOString())
      .toBe('2026-09-12T16:00:00.000Z')
  })

  it('handles daylight-saving zones without using the device zone', () => {
    expect(eventLocalDateTime('2026-07-15', '18:00:00', 'Europe/London')?.toISOString())
      .toBe('2026-07-15T17:00:00.000Z')
  })

  it('formats countdown, duration, deadline and zone metadata', () => {
    const now = new Date('2026-09-10T16:00:00.000Z')
    expect(eventCountdownLabel(event, now)).toBe('Starts in 2 days')
    expect(eventDurationLabel(event)).toBe('3 hours 30 mins')
    expect(rsvpDeadlineDetails(event, now)).toEqual({
      date: '10 Sept 2026',
      countdown: 'Closes at end of today',
    })
    expect(eventTimeZoneLabel(event)).toContain('Africa/Gaborone · UTC+2')
    expect(isEventRsvpClosed(event, now)).toBe(false)
    expect(isEventRsvpClosed(event, new Date('2026-09-11T08:00:00.000Z'))).toBe(true)
  })

  it('falls back safely from invalid rolling-deployment time zones', () => {
    expect(isRecognisedTimeZone('Not/AZone')).toBe(false)
    expect(resolvedEventTimeZone({ time_zone: 'Not/AZone' })).toBe('Africa/Gaborone')
  })
})
