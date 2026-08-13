export function sanitizeAmountInput(text: string) {
  return text.replace(/[^0-9.,]/g, '')
}

export function parseAmount(text: string) {
  const parsed = parseFloat(text.replace(/,/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

export function formatWholeAmount(amount: number) {
  return `P${amount.toLocaleString('en-BW', { maximumFractionDigits: 0 })}`
}

export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-BW', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatEventDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-BW', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString('en-BW', { hour: 'numeric', minute: '2-digit' })
}

export function formatDateISO(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function formatTimeISO(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')

  return `${hours}:${minutes}:${seconds}`
}

export function getInitials(value: string) {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return initials || '?'
}

export function suggestedEventFundName(eventName: string, eventTypeLabel: string): string {
  const trimmedEventName = eventName.trim()
  const fallbackEventName = `${eventTypeLabel.trim() || 'Event'} Event`
  return `${trimmedEventName || fallbackEventName} Fund`
}

export function shouldSyncSuggestedFundName(
  currentFundName: string,
  previousEventName: string,
  eventTypeLabel: string,
): boolean {
  const trimmedFundName = currentFundName.trim()
  return !trimmedFundName
    || trimmedFundName === suggestedEventFundName(previousEventName, eventTypeLabel)
}
