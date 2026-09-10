import { DEFAULT_EVENT_TIME_ZONE, type Event } from '@shared/contracts/events'

type ScheduleEvent = Pick<Event,
  | 'id'
  | 'name'
  | 'description'
  | 'event_date'
  | 'event_time'
  | 'event_end_date'
  | 'event_end_time'
  | 'time_zone'
  | 'rsvp_deadline'
  | 'venue_name'
  | 'venue_address'
  | 'status'
>

export const EVENT_TIME_ZONE_SUGGESTIONS = [
  'Africa/Gaborone',
  'Africa/Johannesburg',
  'Africa/Harare',
  'Africa/Lusaka',
  'Africa/Maputo',
  'Africa/Windhoek',
  'Africa/Nairobi',
  'Africa/Lagos',
  'Europe/London',
  'UTC',
] as const

export function resolvedEventTimeZone(event: Pick<ScheduleEvent, 'time_zone'>) {
  return event.time_zone || DEFAULT_EVENT_TIME_ZONE
}

function dateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function timeParts(value: string | null) {
  if (!value) return null
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return null
  return { hour: Number(match[1]), minute: Number(match[2]), second: Number(match[3] ?? 0) }
}

function partsInZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    calendar: 'gregory',
    numberingSystem: 'latn',
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value)
  return {
    year: number('year'), month: number('month'), day: number('day'),
    hour: number('hour'), minute: number('minute'), second: number('second'),
  }
}

export function eventLocalDateTime(
  dateValue: string,
  timeValue: string | null,
  timeZone: string,
) {
  const date = dateParts(dateValue)
  const time = timeParts(timeValue)
  if (!date || !time) return null
  const target = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second)
  let instant = target

  // Iterate because the offset at the UTC guess can differ from the offset at
  // the target wall time across daylight-saving transitions.
  for (let pass = 0; pass < 3; pass += 1) {
    const shown = partsInZone(new Date(instant), timeZone)
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second)
    const adjustment = target - shownAsUtc
    instant += adjustment
    if (adjustment === 0) break
  }

  const result = new Date(instant)
  const shown = partsInZone(result, timeZone)
  return shown.year === date.year && shown.month === date.month && shown.day === date.day
    && shown.hour === time.hour && shown.minute === time.minute && shown.second === time.second
    ? result
    : null
}

function isoDateOrdinal(value: string) {
  const parts = dateParts(value)
  return parts ? Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000) : 0
}

function localIsoDate(value: Date, timeZone: string) {
  const parts = partsInZone(value, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function plural(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? '' : 's'}`
}

function countdownDistance(milliseconds: number) {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000))
  if (minutes < 60) return plural(minutes, 'min')
  const hours = Math.ceil(milliseconds / 3_600_000)
  if (hours < 48) return plural(hours, 'hour')
  const days = Math.ceil(milliseconds / 86_400_000)
  if (days < 60) return plural(days, 'day')
  const months = Math.max(2, Math.round(days / 30.4375))
  if (months < 24) return plural(months, 'month')
  return plural(Math.round(months / 12), 'year')
}

function durationDistance(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60_000))
  const days = Math.floor(totalMinutes / 1_440)
  const hours = Math.floor((totalMinutes % 1_440) / 60)
  const minutes = totalMinutes % 60
  return [
    days ? plural(days, 'day') : '',
    hours ? plural(hours, 'hour') : '',
    minutes ? plural(minutes, 'min') : '',
  ].filter(Boolean).slice(0, 2).join(' ') || '0 min'
}

function shortDate(value: string) {
  const parts = dateParts(value)
  if (!parts) return value
  return new Intl.DateTimeFormat('en-BW', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)))
}

export function eventCountdownLabel(event: ScheduleEvent, now = new Date()) {
  if (event.status === 'cancelled') return 'Event cancelled'
  if (event.status === 'completed') return 'Event completed'
  const timeZone = resolvedEventTimeZone(event)
  const start = eventLocalDateTime(event.event_date, event.event_time, timeZone)
  if (!start) {
    const today = isoDateOrdinal(localIsoDate(now, timeZone))
    const startDay = isoDateOrdinal(event.event_date)
    const endDay = isoDateOrdinal(event.event_end_date || event.event_date)
    const daysUntilStart = startDay - today
    if (today >= startDay && today <= endDay) return 'Happening today'
    if (daysUntilStart === 1) return 'Starts tomorrow'
    if (daysUntilStart > 1) return `Starts in ${plural(daysUntilStart, 'day')}`
    return `Ended ${plural(today - endDay, 'day')} ago`
  }

  const end = event.event_end_time
    ? eventLocalDateTime(event.event_end_date || event.event_date, event.event_end_time, timeZone)
    : null
  const untilStart = start.getTime() - now.getTime()
  if (untilStart > 0) return `Starts in ${countdownDistance(untilStart)}`
  if (end && end.getTime() > now.getTime()) return `Happening now · ends in ${countdownDistance(end.getTime() - now.getTime())}`
  if (end) return `Ended ${countdownDistance(now.getTime() - end.getTime())} ago`
  return `Started ${countdownDistance(now.getTime() - start.getTime())} ago`
}

export function eventDurationLabel(event: ScheduleEvent) {
  const timeZone = resolvedEventTimeZone(event)
  const start = eventLocalDateTime(event.event_date, event.event_time, timeZone)
  const end = event.event_end_time
    ? eventLocalDateTime(event.event_end_date || event.event_date, event.event_end_time, timeZone)
    : null
  if (start && end && end.getTime() >= start.getTime()) return durationDistance(end.getTime() - start.getTime())
  if (!event.event_time && event.event_end_date && event.event_end_date > event.event_date) {
    return plural(isoDateOrdinal(event.event_end_date) - isoDateOrdinal(event.event_date) + 1, 'day')
  }
  return event.event_time ? 'End time not set' : 'Time to be confirmed'
}

export function rsvpDeadlineDetails(event: ScheduleEvent, now = new Date()) {
  if (!event.rsvp_deadline) return { date: 'Not set', countdown: 'No RSVP cut-off' }
  const timeZone = resolvedEventTimeZone(event)
  const days = isoDateOrdinal(event.rsvp_deadline) - isoDateOrdinal(localIsoDate(now, timeZone))
  const countdown = days === 0
    ? 'Closes at the end of today'
    : days === 1
      ? 'Closes tomorrow'
      : days > 1
        ? `Closes in ${plural(days, 'day')}`
        : `Closed ${plural(Math.abs(days), 'day')} ago`
  return { date: shortDate(event.rsvp_deadline), countdown }
}

export function isEventRsvpClosed(event: ScheduleEvent, now = new Date()) {
  return Boolean(event.rsvp_deadline)
    && isoDateOrdinal(localIsoDate(now, resolvedEventTimeZone(event)))
      > isoDateOrdinal(event.rsvp_deadline as string)
}

export function eventTimeZoneLabel(event: ScheduleEvent, at = new Date()) {
  const timeZone = resolvedEventTimeZone(event)
  const reference = eventLocalDateTime(event.event_date, event.event_time || '12:00:00', timeZone) || at
  const zoneName = new Intl.DateTimeFormat('en-BW', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(reference).find(part => part.type === 'timeZoneName')?.value || 'UTC'
  return `${timeZone.replaceAll('_', ' ')} · ${zoneName.replace('GMT', 'UTC')}`
}

function calendarDate(value: string) {
  return value.replaceAll('-', '')
}

function nextCalendarDate(value: string) {
  const parts = dateParts(value)
  if (!parts) return calendarDate(value)
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1))
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
}

function calendarInstant(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeCalendarText(value: string) {
  return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
    .replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,')
}

function foldCalendarLine(line: string) {
  const chunks: string[] = []
  let chunk = ''
  let bytes = 0
  let limit = 75
  for (const character of line) {
    const codePoint = character.codePointAt(0) ?? 0
    const characterBytes = codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4
    if (chunk && bytes + characterBytes > limit) {
      chunks.push(chunk)
      chunk = character
      bytes = characterBytes
      limit = 74 // Continuation lines begin with one required folding space.
    } else {
      chunk += character
      bytes += characterBytes
    }
  }
  chunks.push(chunk)
  return chunks.join('\r\n ')
}

function calendarFileName(name: string) {
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug || 'tshelo-event'}.ics`
}

export function createEventCalendar(event: ScheduleEvent, now = new Date()) {
  const timeZone = resolvedEventTimeZone(event)
  const start = eventLocalDateTime(event.event_date, event.event_time, timeZone)
  const end = event.event_end_time
    ? eventLocalDateTime(event.event_end_date || event.event_date, event.event_end_time, timeZone)
    : null
  const description = [
    event.description?.trim(),
    `Event time zone: ${timeZone}`,
    event.rsvp_deadline ? `RSVP deadline: ${event.rsvp_deadline}` : '',
  ].filter(Boolean).join('\n\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tshelo//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeCalendarText(event.id)}@tshelo.com`,
    `DTSTAMP:${calendarInstant(now)}`,
    start ? `DTSTART:${calendarInstant(start)}` : `DTSTART;VALUE=DATE:${calendarDate(event.event_date)}`,
  ]
  if (start && end && end.getTime() >= start.getTime()) lines.push(`DTEND:${calendarInstant(end)}`)
  if (!start) lines.push(`DTEND;VALUE=DATE:${nextCalendarDate(event.event_end_date || event.event_date)}`)
  lines.push(
    `SUMMARY:${escapeCalendarText(event.name)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
  )
  const location = [event.venue_name, event.venue_address].filter(Boolean).join(', ')
  if (location) lines.push(`LOCATION:${escapeCalendarText(location)}`)
  if (event.status === 'cancelled') lines.push('STATUS:CANCELLED')
  lines.push('END:VEVENT', 'END:VCALENDAR', '')
  return { fileName: calendarFileName(event.name), contents: lines.map(foldCalendarLine).join('\r\n') }
}
