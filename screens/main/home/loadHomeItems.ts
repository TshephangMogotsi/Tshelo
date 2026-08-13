import { supabase } from '../../../lib/supabase'
import { fundMemberCount } from '../../../lib/fundMembers'
import { HomeItem, MemberRole, labelFromValue } from './helpers'

// Loads every fund/event card for the home screen. Throws on any query error.
export async function loadHomeItems(userId: string): Promise<HomeItem[]> {
  // Get fund memberships, owned funds, and every event role in parallel.
  const [
    { data: myMemberships,     error: membershipsErr },
    { data: myOwnedFunds,      error: ownedFundsErr },
    { data: myEventOrgRows,    error: eventOrgErr },
    { data: myEventGuestRows,  error: eventGuestErr },
  ] = await Promise.all([
    supabase
      .from('fund_members')
      .select('fund_id, role')
      .eq('user_id', userId)
      .not('status', 'in', '(left,removed,declined,pending)'),
    supabase
      .from('funds')
      .select('id')
      .eq('owner_id', userId)
      .is('deleted_at', null),
    supabase
      .from('event_organisers')
      .select('event_id')
      .eq('user_id', userId)
      .not('status', 'in', '(left,removed)'),
    supabase
      .from('event_guests')
      .select('event_id')
      .eq('user_id', userId),
  ])

  if (membershipsErr) throw membershipsErr
  if (ownedFundsErr)  throw ownedFundsErr
  if (eventOrgErr)    throw eventOrgErr
  if (eventGuestErr)  throw eventGuestErr

  // Merge member fund IDs + owned fund IDs (owned funds always visible even if fund_members row is missing)
  const memberFundIds  = new Set((myMemberships ?? []).map(m => m.fund_id))
  const ownedFundIds   = new Set((myOwnedFunds ?? []).map(f => f.id))
  const allMyFundIds   = [...new Set([...memberFundIds, ...ownedFundIds])]

  const roleByFundId   = new Map<string, MemberRole>(
    (myMemberships ?? []).map(m => [m.fund_id, m.role as MemberRole])
  )
  // Owned funds default to 'owner' if not already in fund_members
  ownedFundIds.forEach(id => {
    if (!roleByFundId.has(id)) roleByFundId.set(id, 'owner')
  })

  const coOrgEventIds  = (myEventOrgRows ?? []).map(r => r.event_id)
  const guestEventIds  = (myEventGuestRows ?? []).map(r => r.event_id)
  const relatedEventIds = [...new Set([...coOrgEventIds, ...guestEventIds])]
  const coOrgEventIdSet = new Set(coOrgEventIds)

  // Build event filter: events the user created, organises, or joined as a guest.
  const eventFilter = relatedEventIds.length > 0
    ? `creator_id.eq.${userId},id.in.(${relatedEventIds.join(',')})`
    : `creator_id.eq.${userId}`

  const [
    { data: funds,          error: fundsErr },
    { data: events,         error: eventsErr },
    { data: eventFundLinks, error: linksErr },
  ] = await Promise.all([
    allMyFundIds.length > 0
      ? supabase
          .from('funds')
          .select('id, title, status, goal_amount, currency_code, fund_type, fund_emoji, linked_event_id, created_at')
          .in('id', allMyFundIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase
      .from('events')
      .select('id, creator_id, name, status, event_type, event_emoji, event_date, venue_name, linked_fund_id, created_at')
      .or(eventFilter)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('event_fund_links')
      .select('event_id, fund_id')
      .eq('is_active', true),
  ])

  if (fundsErr)  throw fundsErr
  if (eventsErr) throw eventsErr
  if (linksErr)  throw linksErr

  const fundIds  = (funds  ?? []).map(f => f.id)
  const eventIds = (events ?? []).map(e => e.id)

  let contributions: { fund_id: string; amount: number | string }[] = []
  let expenses:      { fund_id: string; amount: number | string; is_sponsored: boolean | null }[] = []
  let fundMembers:   { fund_id: string }[]                          = []
  let eventGuests:   { event_id: string; plus_ones: number | null }[] = []
  let eventBudgets:  { event_id: string; total_budget: number | string; currency_code: string | null }[] = []

  if (fundIds.length > 0) {
    const [contribRes, expenseRes, memberRes] = await Promise.all([
      supabase.from('contributions').select('fund_id, amount').in('fund_id', fundIds).eq('status', 'confirmed').eq('is_refunded', false),
      supabase.from('expenses').select('fund_id, amount, is_sponsored').in('fund_id', fundIds).is('deleted_at', null),
      supabase.from('fund_members').select('fund_id').in('fund_id', fundIds).not('status', 'in', '(left,removed,declined,pending)'),
    ])
    if (contribRes.error) throw contribRes.error
    if (expenseRes.error) throw expenseRes.error
    if (memberRes.error)  throw memberRes.error
    contributions = contribRes.data ?? []
    expenses      = expenseRes.data ?? []
    fundMembers   = memberRes.data  ?? []
  }

  if (eventIds.length > 0) {
    const [guestRes, budgetRes] = await Promise.all([
      supabase.from('event_guests').select('event_id, plus_ones').in('event_id', eventIds),
      supabase.from('event_budgets').select('event_id, total_budget, currency_code').in('event_id', eventIds),
    ])
    if (guestRes.error) throw guestRes.error
    if (budgetRes.error) throw budgetRes.error
    eventGuests  = guestRes.data  ?? []
    eventBudgets = budgetRes.data ?? []
  }

  const contribByFund  = new Map<string, number>()
  contributions.forEach(c => contribByFund.set(c.fund_id, (contribByFund.get(c.fund_id) ?? 0) + Number(c.amount ?? 0)))

  const expenseByFund  = new Map<string, number>()
  expenses
    .filter(expense => !expense.is_sponsored)
    .forEach(expense => expenseByFund.set(
      expense.fund_id,
      (expenseByFund.get(expense.fund_id) ?? 0) + Number(expense.amount ?? 0),
    ))

  const membersByFund  = new Map<string, number>()
  fundMembers.forEach(m => membersByFund.set(m.fund_id, (membersByFund.get(m.fund_id) ?? 0) + 1))

  const guestsByEvent  = new Map<string, number>()
  eventGuests.forEach(g => {
    const size = 1 + Math.max(0, Number(g.plus_ones ?? 0))
    guestsByEvent.set(g.event_id, (guestsByEvent.get(g.event_id) ?? 0) + size)
  })

  const budgetByEvent = new Map(eventBudgets.map(b => [b.event_id, b]))

  const eventById = new Map((events ?? []).map(e => [e.id, e]))
  const linkedEventByFundId = new Map<string, string>()
  ;(events ?? []).forEach(e => { if (e.linked_fund_id) linkedEventByFundId.set(e.linked_fund_id, e.id) })
  ;(eventFundLinks ?? []).forEach(l => linkedEventByFundId.set(l.fund_id, l.event_id))

  const renderedEventIds = new Set<string>()

  const fundItems: HomeItem[] = (funds ?? []).map(fund => {
    const linkedEventId = fund.linked_event_id ?? linkedEventByFundId.get(fund.id)
    const linkedEvent   = linkedEventId ? eventById.get(linkedEventId) : null
    if (linkedEvent) renderedEventIds.add(linkedEvent.id)

    const kind   = linkedEvent ? 'eventFund' : 'fund'
    const total  = contribByFund.get(fund.id) ?? 0
    const spent  = expenseByFund.get(fund.id) ?? 0
    const eventBudget = linkedEvent ? budgetByEvent.get(linkedEvent.id) : null
    const fundGoal = Number(fund.goal_amount ?? 0)

    return {
      id:                  kind === 'eventFund' ? `eventFund-${linkedEvent!.id}-${fund.id}` : fund.id,
      fundId:              fund.id,
      eventId:             linkedEvent?.id,
      kind,
      title:               linkedEvent?.name ?? fund.title,
      status:              fund.status ?? 'active',
      goal_amount:         fundGoal,
      budget_amount:       linkedEvent
        ? eventBudget ? Number(eventBudget.total_budget) : null
        : fundGoal > 0 ? fundGoal : null,
      budget_currency_code: eventBudget?.currency_code ?? fund.currency_code ?? 'BWP',
      total_contributions: total,
      balance:             total - spent,
      member_count:        fundMemberCount(membersByFund.get(fund.id)),
      guest_count:         linkedEvent ? guestsByEvent.get(linkedEvent.id) ?? 0 : 0,
      role:                roleByFundId.get(fund.id) ?? 'member',
      event_date:          linkedEvent?.event_date ?? '',
      venue_name:          linkedEvent?.venue_name ?? '',
      category:            kind === 'eventFund' ? 'Event + Fund' : labelFromValue(fund.fund_type),
      emoji:               linkedEvent?.event_emoji ?? fund.fund_emoji ?? '💜',
      currency_code:       fund.currency_code ?? 'BWP',
      created_at:          linkedEvent?.created_at ?? fund.created_at,
    } as HomeItem
  })

  const eventItems: HomeItem[] = (events ?? [])
    .filter(e => !renderedEventIds.has(e.id))
    .map(e => {
      const budget = budgetByEvent.get(e.id)
      return {
        id:                  e.id,
        eventId:             e.id,
        kind:                'event',
        title:               e.name,
        status:              e.status ?? 'active',
      goal_amount:         0,
      // Event-only records focus on invitations and RSVPs. Legacy budgets stay
      // in storage but are no longer presented as active event accounting.
      budget_amount:       null,
        budget_currency_code: budget?.currency_code ?? 'BWP',
        total_contributions: 0,
        balance:             0,
        member_count:        0,
        guest_count:         guestsByEvent.get(e.id) ?? 0,
        role:                e.creator_id === userId || coOrgEventIdSet.has(e.id) ? 'organiser' : 'member',
        event_date:          e.event_date ?? '',
        venue_name:          e.venue_name ?? '',
        category:            labelFromValue(e.event_type),
        emoji:               e.event_emoji ?? '🎉',
        currency_code:       budget?.currency_code ?? 'BWP',
        created_at:          e.created_at,
      } as HomeItem
    })

  return [...fundItems, ...eventItems]
}
