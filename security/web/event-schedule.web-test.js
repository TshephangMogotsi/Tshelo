const {
  createEventCalendar,
  eventCountdownLabel,
  eventDurationLabel,
  eventLocalDateTime,
  eventTimeZoneLabel,
  isEventRsvpClosed,
  rsvpDeadlineDetails,
} = require('@/lib/event-schedule')

const event = {
  id: 'event-1',
  name: 'Garden celebration',
  description: 'Please arrive early.',
  event_date: '2026-09-19',
  event_time: '14:00:00',
  event_end_date: '2026-09-19',
  event_end_time: '20:00:00',
  time_zone: 'Africa/Gaborone',
  rsvp_deadline: '2026-09-18',
  venue_name: 'Garden Hall',
  venue_address: 'Plot 12, Gaborone',
  status: 'active',
}

it('interprets wall-clock event times in the stored IANA time zone', () => {
  expect(eventLocalDateTime('2026-09-19', '14:00:00', 'Africa/Gaborone').toISOString())
    .toBe('2026-09-19T12:00:00.000Z')
  expect(eventCountdownLabel(event, new Date('2026-09-19T10:00:00Z'))).toBe('Starts in 2 hours')
  expect(eventDurationLabel(event)).toBe('6 hours')
  expect(eventTimeZoneLabel(event)).toBe('Africa/Gaborone · UTC+2')
})

it('keeps the RSVP deadline open for its full local day and then closes it', () => {
  expect(rsvpDeadlineDetails(event, new Date('2026-09-09T12:00:00Z'))).toEqual({
    date: '18 Sept 2026',
    countdown: 'Closes in 9 days',
  })
  expect(isEventRsvpClosed(event, new Date('2026-09-18T21:59:00Z'))).toBe(false)
  expect(isEventRsvpClosed(event, new Date('2026-09-18T22:00:00Z'))).toBe(true)
})

it('creates a private portable calendar file using unambiguous UTC instants', () => {
  const calendar = createEventCalendar(event, new Date('2026-09-09T08:30:00Z'))
  const unfolded = calendar.contents.replaceAll('\r\n ', '')
  expect(calendar.fileName).toBe('garden-celebration.ics')
  expect(unfolded).toContain('DTSTART:20260919T120000Z')
  expect(unfolded).toContain('DTEND:20260919T180000Z')
  expect(unfolded).toContain('Event time zone: Africa/Gaborone')
  expect(unfolded).toContain('RSVP deadline: 2026-09-18')
  expect(unfolded).toContain('LOCATION:Garden Hall\\, Plot 12\\, Gaborone')
  expect(unfolded).not.toContain('share_code')
  expect(unfolded).not.toContain('/invite/')
})

it('escapes calendar text injection and folds long content to RFC-safe lines', () => {
  const calendar = createEventCalendar({
    ...event,
    name: `Celebration ${'🎉'.repeat(30)}`,
    description: 'Safe details\r\nATTENDEE:malicious@example.test',
  })
  const unfolded = calendar.contents.replaceAll('\r\n ', '')
  expect(unfolded).not.toContain('\r\nATTENDEE:malicious@example.test')
  expect(unfolded).toContain('Safe details\\nATTENDEE:malicious@example.test')
  for (const line of calendar.contents.split('\r\n')) {
    expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
  }
})

it('exports date-only events as all-day calendar ranges and uses the safe default zone', () => {
  const allDay = { ...event, event_time: null, event_end_date: '2026-09-20', event_end_time: null, time_zone: undefined }
  expect(eventDurationLabel(allDay)).toBe('2 days')
  expect(eventTimeZoneLabel(allDay)).toBe('Africa/Gaborone · UTC+2')
  expect(eventCountdownLabel(allDay, new Date('2026-09-20T10:00:00Z'))).toBe('Happening today')
  expect(eventCountdownLabel(allDay, new Date('2026-09-21T10:00:00Z'))).toBe('Ended 1 day ago')
  const calendar = createEventCalendar(allDay)
  expect(calendar.contents).toContain('DTSTART;VALUE=DATE:20260919')
  expect(calendar.contents).toContain('DTEND;VALUE=DATE:20260921')
})

it('shows the event-date offset for daylight-saving zones, not today’s offset', () => {
  expect(eventTimeZoneLabel({ ...event, event_date: '2026-07-10', event_time: null, time_zone: 'Europe/London' }, new Date('2026-01-10T12:00:00Z')))
    .toBe('Europe/London · UTC+1')
})
