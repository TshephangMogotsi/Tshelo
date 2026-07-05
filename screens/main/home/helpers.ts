export type MemberRole = 'owner' | 'admin' | 'member' | 'organiser'

export type HomeItemKind = 'fund' | 'event' | 'eventFund'

export type HomeItem = {
  id:                  string
  fundId?:             string
  eventId?:            string
  kind:                HomeItemKind
  title:               string
  status:              string
  goal_amount:         number
  total_contributions: number
  balance:             number
  member_count:        number
  guest_count:         number
  role:                MemberRole
  event_date:          string
  venue_name:          string
  category:            string
  emoji:               string
  currency_code:       string
}

export const KIND_LABELS: Record<HomeItemKind, string> = {
  fund:      'Fund',
  eventFund: 'Event + Fund',
  event:     'Event',
}

export function formatMoney(amount: number, currencyCode: string) {
  const symbol = currencyCode === 'BWP' ? 'P' : currencyCode
  return `${symbol} ${amount.toLocaleString('en-BW', { maximumFractionDigits: 0 })}`
}

export function formatEventDate(value: string) {
  if (!value) return 'Date TBC'
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString('en-BW', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function labelFromValue(value: string | null | undefined) {
  if (!value) return 'Fund'
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(part => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
