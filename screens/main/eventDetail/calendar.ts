import { DEFAULT_EVENT_TIME_ZONE } from '@shared/contracts'
import { eventLocalDateTime, resolvedEventTimeZone } from '@shared/event-schedule'

export type CalendarEventSource = {
  title: string
  description?: string | null
  eventDate: string
  eventTime?: string | null
  eventEndDate?: string | null
  eventEndTime?: string | null
  venue?: string | null
  timeZone?: string
  rsvpDeadline?: string | null
}

export type CalendarEventDetails = {
  title: string
  startDate: Date
  endDate: Date
  allDay: boolean
  location?: string
  notes: string
}

function localDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)
  if (!year || !month || !day) return null

  const result = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (
    result.getFullYear() !== year
    || result.getMonth() !== month - 1
    || result.getDate() !== day
  ) return null
  return result
}

export function buildCalendarEventDetails(source: CalendarEventSource): CalendarEventDetails | null {
  const allDay = !source.eventTime
  const timeZone = resolvedEventTimeZone({ time_zone: source.timeZone ?? DEFAULT_EVENT_TIME_ZONE })
  const startDate = allDay
    ? localDate(source.eventDate)
    : eventLocalDateTime(source.eventDate, source.eventTime ?? null, timeZone)
  if (!startDate) return null

  let endDate = allDay && source.eventEndDate
    ? localDate(source.eventEndDate)
    : !allDay && source.eventEndDate
    ? eventLocalDateTime(source.eventEndDate, source.eventEndTime ?? source.eventTime ?? null, timeZone)
    : !allDay && source.eventEndTime
      ? eventLocalDateTime(source.eventDate, source.eventEndTime, timeZone)
      : null

  if (allDay && endDate && endDate >= startDate) {
    endDate = new Date(endDate)
    endDate.setDate(endDate.getDate() + 1)
  } else if (!endDate || endDate <= startDate) {
    endDate = new Date(startDate)
    endDate.setTime(startDate.getTime() + (allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000))
  }

  const notes = [
    source.description?.trim(),
    `Event time zone: ${timeZone}`,
    source.rsvpDeadline ? `RSVP deadline: ${source.rsvpDeadline}` : null,
  ].filter(Boolean).join('\n\n') || 'Added from Tshelo.'

  return {
    title: source.title,
    startDate,
    endDate,
    allDay,
    location: source.venue?.trim() || undefined,
    notes,
  }
}
