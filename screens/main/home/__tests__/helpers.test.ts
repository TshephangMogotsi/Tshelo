import { activeFundItems, DEFAULT_HOME_STATUS_FILTER, HOME_STATUS_FILTER_ORDER, HomeItem, formatMoney, formatEventDate, labelFromValue, initials, matchesHomeStatus, sortHomeItems } from '../helpers'

it('defaults the Home list to active items', () => {
  expect(DEFAULT_HOME_STATUS_FILTER).toBe('active')
  expect(HOME_STATUS_FILTER_ORDER).toEqual(['active', 'all', 'closed'])
})

describe('formatMoney', () => {
  it('uses the P symbol for BWP', () => {
    expect(formatMoney(1500, 'BWP')).toBe('P 1,500')
  })

  it('falls back to the currency code for other currencies', () => {
    expect(formatMoney(2000, 'ZAR')).toBe('ZAR 2,000')
  })
})

describe('formatEventDate', () => {
  it('formats an ISO date for display', () => {
    expect(formatEventDate('2026-08-15')).toBe('15 Aug 2026')
  })

  it('returns Date TBC for empty values', () => {
    expect(formatEventDate('')).toBe('Date TBC')
  })

  it('passes through malformed values unchanged', () => {
    expect(formatEventDate('soon')).toBe('soon')
  })
})

describe('labelFromValue', () => {
  it('title-cases snake_case and kebab-case values', () => {
    expect(labelFromValue('orange_money')).toBe('Orange Money')
    expect(labelFromValue('event-fund')).toBe('Event Fund')
  })

  it('defaults to Fund for missing values', () => {
    expect(labelFromValue(null)).toBe('Fund')
    expect(labelFromValue(undefined)).toBe('Fund')
  })
})

describe('initials', () => {
  it('builds two-letter initials from a name', () => {
    expect(initials('Kgosi Moeng')).toBe('KM')
    expect(initials('Naledi')).toBe('N')
  })
})

describe('sortHomeItems', () => {
  function item(id: string, createdAt: string): HomeItem {
    return {
      id,
      kind: 'event',
      title: id,
      status: 'active',
      goal_amount: 0,
      budget_amount: null,
      budget_currency_code: 'BWP',
      total_contributions: 0,
      balance: 0,
      member_count: 0,
      guest_count: 0,
      role: 'organiser',
      event_date: '',
      venue_name: '',
      category: 'Event',
      emoji: '🎉',
      currency_code: 'BWP',
      created_at: createdAt,
    }
  }

  const oldest = item('Oldest', '2026-07-20T08:00:00Z')
  const middle = item('Middle', '2026-07-21T08:00:00Z')
  const newest = item('Newest', '2026-07-22T08:00:00Z')

  it('puts the most recently added item first by default order', () => {
    expect(sortHomeItems([oldest, newest, middle], 'newest').map(value => value.id))
      .toEqual(['Newest', 'Middle', 'Oldest'])
  })

  it('can put the oldest added item first', () => {
    expect(sortHomeItems([middle, newest, oldest], 'oldest').map(value => value.id))
      .toEqual(['Oldest', 'Middle', 'Newest'])
  })

  it('does not mutate the loaded item array', () => {
    const items = [oldest, newest, middle]
    sortHomeItems(items, 'newest')
    expect(items.map(value => value.id)).toEqual(['Oldest', 'Newest', 'Middle'])
  })

  it('keeps legacy items without a valid timestamp at the end', () => {
    const legacy = item('Legacy', '')
    expect(sortHomeItems([legacy, middle], 'newest').map(value => value.id))
      .toEqual(['Middle', 'Legacy'])
    expect(sortHomeItems([legacy, middle], 'oldest').map(value => value.id))
      .toEqual(['Middle', 'Legacy'])
  })
})

describe('matchesHomeStatus', () => {
  const item = { status: 'active' } as HomeItem

  it('matches all items when no status is selected', () => {
    expect(matchesHomeStatus(item, 'all')).toBe(true)
  })

  it('separates active and closed items', () => {
    expect(matchesHomeStatus(item, 'active')).toBe(true)
    expect(matchesHomeStatus(item, 'closed')).toBe(false)
    expect(matchesHomeStatus({ ...item, status: 'Closed' }, 'closed')).toBe(true)
    expect(matchesHomeStatus({ ...item, status: 'completed' }, 'closed')).toBe(true)
    expect(matchesHomeStatus({ ...item, status: 'cancelled' }, 'closed')).toBe(true)
  })
})

describe('activeFundItems', () => {
  const base = {
    id: 'item',
    fundId: 'fund-id',
    kind: 'fund' as const,
    title: 'Family Fund',
    status: 'active',
    goal_amount: 0,
    budget_amount: null,
    budget_currency_code: 'BWP',
    total_contributions: 0,
    balance: 0,
    member_count: 1,
    guest_count: 0,
    role: 'owner' as const,
    event_date: '',
    venue_name: '',
    category: 'Fund',
    emoji: '💜',
    currency_code: 'BWP',
    created_at: '2026-09-11T08:00:00Z',
  }

  it('keeps active Funds and Event + Funds while excluding event-only and closed items', () => {
    const fund = base
    const eventFund = { ...base, id: 'event-fund', kind: 'eventFund' as const, eventId: 'event-id' }
    const eventOnly = { ...base, id: 'event', kind: 'event' as const, fundId: undefined, eventId: 'event-id' }
    const closed = { ...base, id: 'closed', status: 'closed' }

    expect(activeFundItems([eventOnly, fund, closed, eventFund]).map(item => item.id))
      .toEqual(['item', 'event-fund'])
  })
})
