export type MemberRole = 'owner' | 'admin' | 'member' | 'organiser'

export type HomeItemKind = 'fund' | 'event' | 'eventFund'

export type HomeSortOrder = 'newest' | 'oldest'

export type HomeStatusFilter = 'all' | 'active' | 'closed'

export type HomeItem = {
  id:                  string
  fundId?:             string
  eventId?:            string
  kind:                HomeItemKind
  title:               string
  status:              string
  goal_amount:         number
  budget_amount:       number | null
  budget_currency_code: string
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
  created_at:          string
}

export const HOME_SORT_LABELS: Record<HomeSortOrder, string> = {
  newest: 'Newest added',
  oldest: 'Oldest added',
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

export function sortHomeItems(items: HomeItem[], order: HomeSortOrder) {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.created_at)
    const bTime = Date.parse(b.created_at)
    const aHasDate = Number.isFinite(aTime)
    const bHasDate = Number.isFinite(bTime)

    // Incomplete legacy records remain visible but do not jump ahead of
    // items whose creation time is known.
    if (!aHasDate && !bHasDate) return a.title.localeCompare(b.title)
    if (!aHasDate) return 1
    if (!bHasDate) return -1

    const difference = order === 'newest' ? bTime - aTime : aTime - bTime
    return difference || a.title.localeCompare(b.title)
  })
}

export function matchesHomeStatus(item: HomeItem, filter: HomeStatusFilter) {
  if (filter === 'all') return true
  const status = item.status.trim().toLowerCase()
  if (filter === 'closed') return status === 'closed' || status === 'completed'
  return status === filter
}
