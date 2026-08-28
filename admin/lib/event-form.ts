/** Browser time inputs submit `HH:mm`; the Events API stores and validates
 * times with seconds. Keep the conversion at the web boundary. */
export function normalizeEventTime(value: FormDataEntryValue | null) {
  const time = typeof value === 'string' ? value.trim() : ''
  if (!time) return null
  return /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time
}
