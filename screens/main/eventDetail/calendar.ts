export type CalendarEventSource = {
  title: string
  description?: string | null
  eventDate: string
  eventTime?: string | null
  eventEndDate?: string | null
  eventEndTime?: string | null
  venue?: string | null
  shareCode?: string | null
}

export type CalendarEventDetails = {
  title: string
  startDate: Date
  endDate: Date
  allDay: boolean
  location?: string
  notes: string
}

function localDate(dateValue: string, timeValue?: string | null) {
  const [year, month, day] = dateValue.split('-').map(Number)
  if (!year || !month || !day) return null

  const [hour = 0, minute = 0, second = 0] = (timeValue ?? '00:00:00').split(':').map(Number)
  const result = new Date(year, month - 1, day, hour, minute, second, 0)
  if (
    result.getFullYear() !== year
    || result.getMonth() !== month - 1
    || result.getDate() !== day
  ) return null
  return result
}

export function buildCalendarEventDetails(source: CalendarEventSource): CalendarEventDetails | null {
  const allDay = !source.eventTime
  const startDate = localDate(source.eventDate, source.eventTime)
  if (!startDate) return null

  let endDate = source.eventEndDate
    ? localDate(source.eventEndDate, source.eventEndTime ?? source.eventTime)
    : source.eventEndTime
      ? localDate(source.eventDate, source.eventEndTime)
      : null

  if (!endDate || endDate <= startDate) {
    endDate = new Date(startDate)
    endDate.setTime(startDate.getTime() + (allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000))
  }

  const notes = [
    source.description?.trim(),
    source.shareCode ? `Tshelo RSVP code: ${source.shareCode}` : null,
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
