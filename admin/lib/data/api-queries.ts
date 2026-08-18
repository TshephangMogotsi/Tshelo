import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AdminAuditEntry,
  ListAdminAuditRequest,
  ListSupportTicketsRequest,
  SupportTicketSummary,
} from '@shared/contracts/admin'
import type {
  Contribution,
  ContributionSummary,
  ListContributionsRequest,
} from '@shared/contracts/contributions'
import type { Event, EventGuest, EventSummary, ListEventsRequest } from '@shared/contracts/events'
import type {
  FundDetail,
  FundMembership,
  FundSummary,
  ListFundsRequest,
} from '@shared/contracts/funds'
import type { ListUsersRequest, User, UserSummary } from '@shared/contracts/users'
import type { Paginated } from '@shared/contracts/common'
import {
  type ContributionRow,
  type EventRow,
  type FundRow,
  type UserRow,
  toContributionSummary,
  toContribution,
  toEvent,
  toEventSummary,
  toFund,
  toFundSummary,
  toSupportTicketSummary,
  toUserSummary,
  toUser,
} from './api-records'
import {
  type ApiDataResult,
  createPage,
  createQueryScope,
  dataFailure,
  dataSuccess,
  resolvePageWindow,
} from './api-pagination'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function values<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function searchPattern(value: string) {
  return `%${value.trim().replace(/[\\%_]/g, '\\$&')}%`
}

function scopeRequest<T extends { cursor?: string; limit?: number }>(request: T) {
  const criteria = { ...request } as Record<string, unknown>
  delete criteria.cursor
  delete criteria.limit
  return criteria
}

function validUuid(value: string) {
  return UUID_PATTERN.test(value)
}

function commonListError(
  request: { q?: string; sort_by?: string; sort_direction?: string },
  allowedSortFields: readonly string[],
) {
  if (request.sort_by && !allowedSortFields.includes(request.sort_by)) {
    return `Unsupported sort field: ${request.sort_by}.`
  }
  if (request.sort_direction && !['asc', 'desc'].includes(request.sort_direction)) {
    return 'Sort direction must be asc or desc.'
  }
  if (request.q && request.q.trim().length > 100) {
    return 'Search text cannot exceed 100 characters.'
  }
  return null
}

function invalidUuidFilter(...valuesToCheck: Array<string | undefined>) {
  return valuesToCheck.some(value => value !== undefined && !validUuid(value))
}

function moneyToMinorUnits(value: number | string | null | undefined) {
  const normalized = String(value ?? '0').trim()
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return BigInt(0)
  const sign = match[1] === '-' ? BigInt(-1) : BigInt(1)
  const major = BigInt(match[2]) * BigInt(100)
  const minor = BigInt((match[3] ?? '').padEnd(2, '0'))
  return sign * (major + minor)
}

function minorUnitsToMoney(value: bigint) {
  const negative = value < BigInt(0)
  const absolute = negative ? -value : value
  const major = absolute / BigInt(100)
  const minor = String(absolute % BigInt(100)).padStart(2, '0')
  return `${negative ? '-' : ''}${major}.${minor}`
}

function sumMoney(valuesToSum: Array<number | string | null | undefined>) {
  return valuesToSum.reduce<bigint>(
    (total, value) => total + moneyToMinorUnits(value),
    BigInt(0),
  )
}

export async function getApiUser(
  client: SupabaseClient,
  userId: string,
): Promise<ApiDataResult<User | null>> {
  if (!validUuid(userId)) {
    return dataFailure({ kind: 'validation', message: 'user_id must be a valid UUID.' })
  }

  const { data, error } = await client
    .from('users')
    .select('id, name, phone, email, avatar_url, country_code, preferred_currency, token_balance, trust_level, trust_score, profile_completed, onboarding_completed, notifications_enabled, is_flagged, is_banned, last_active_at, created_at, updated_at')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(data ? toUser(data as UserRow) : null)
}

export async function getApiContribution(
  client: SupabaseClient,
  contributionId: string,
): Promise<ApiDataResult<Contribution | null>> {
  if (!validUuid(contributionId)) {
    return dataFailure({ kind: 'validation', message: 'contribution_id must be a valid UUID.' })
  }

  const { data, error } = await client
    .from('contributions')
    .select('id, fund_id, contributor_id, user_id, contributor_name, contributor_phone, amount, pledged_amount, currency_code, payment_method, reference_number, status, detected_via, is_refunded, confirmed_at, receipt_number, notes, created_at, updated_at')
    .eq('id', contributionId)
    .maybeSingle()

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(data ? toContribution(data as ContributionRow) : null)
}

export async function getApiEvent(
  client: SupabaseClient,
  eventId: string,
): Promise<ApiDataResult<{ event: Event; guests: EventGuest[] } | null>> {
  if (!validUuid(eventId)) {
    return dataFailure({ kind: 'validation', message: 'event_id must be a valid UUID.' })
  }

  const [eventResult, guestResult] = await Promise.all([
    client
      .from('events')
      .select('id, creator_id, event_code, name, description, event_type, event_emoji, event_date, event_time, event_end_date, event_end_time, venue_name, venue_address, venue_lat, venue_lng, cover_photo_url, currency_code, linked_fund_id, share_code, estimated_spend_amount, status, completed_at, cancelled_at, created_at, updated_at')
      .eq('id', eventId)
      .is('deleted_at', null)
      .maybeSingle(),
    client
      .from('event_guests')
      .select('id, event_id, user_id, guest_name, guest_phone, guest_email, rsvp_status, plus_ones, rsvp_note, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }),
  ])

  if (eventResult.error) return dataFailure({ kind: 'database', error: eventResult.error })
  if (guestResult.error) return dataFailure({ kind: 'database', error: guestResult.error })
  if (!eventResult.data) return dataSuccess(null)

  return dataSuccess({
    event: toEvent(eventResult.data as EventRow),
    guests: (guestResult.data ?? []).map(row => ({
      id: row.id as string,
      event_id: row.event_id as string,
      user_id: row.user_id as string | null,
      guest_name: row.guest_name as string | null,
      guest_phone: row.guest_phone as string | null,
      guest_email: row.guest_email as string | null,
      rsvp_status: row.rsvp_status as EventGuest['rsvp_status'],
      plus_ones: Number(row.plus_ones ?? 0),
      rsvp_note: row.rsvp_note as string | null,
      created_at: row.created_at as string,
    })),
  })
}

export async function getApiFund(
  client: SupabaseClient,
  actorUserId: string,
  fundId: string,
): Promise<ApiDataResult<FundDetail | null>> {
  if (!validUuid(actorUserId) || !validUuid(fundId)) {
    return dataFailure({ kind: 'validation', message: 'actor and fund IDs must be valid UUIDs.' })
  }

  const [fundResult, membershipResult, contributionsResult, expensesResult, memberCountResult] = await Promise.all([
    client
      .from('funds')
      .select('id, owner_id, title, description, fund_code, fund_type, fund_emoji, type_specific_data, currency_code, goal_amount, event_date, event_time, event_location, attendees, contribution_deadline, auto_close_date, cover_photo_url, share_code, show_leaderboard, status, linked_event_id, is_private, closed_at, created_at, updated_at')
      .eq('id', fundId)
      .is('deleted_at', null)
      .maybeSingle(),
    client
      .from('fund_members')
      .select('id, fund_id, user_id, invited_phone, invited_name, role, status, suggested_contribution, contribution_goal, joined_at, created_at')
      .eq('fund_id', fundId)
      .eq('user_id', actorUserId)
      .maybeSingle(),
    client
      .from('contributions')
      .select('amount, status, is_refunded')
      .eq('fund_id', fundId),
    client
      .from('expenses')
      .select('amount, is_sponsored')
      .eq('fund_id', fundId)
      .is('deleted_at', null),
    client
      .from('fund_members')
      .select('*', { count: 'exact', head: true })
      .eq('fund_id', fundId)
      .not('status', 'in', '(left,removed,declined,pending)'),
  ])

  if (fundResult.error) return dataFailure({ kind: 'database', error: fundResult.error })
  if (membershipResult.error) return dataFailure({ kind: 'database', error: membershipResult.error })
  if (contributionsResult.error) return dataFailure({ kind: 'database', error: contributionsResult.error })
  if (expensesResult.error) return dataFailure({ kind: 'database', error: expensesResult.error })
  if (memberCountResult.error) return dataFailure({ kind: 'database', error: memberCountResult.error })
  if (!fundResult.data) return dataSuccess(null)

  const confirmedContributions = (contributionsResult.data ?? []).filter(
    row => row.status === 'confirmed' && !row.is_refunded,
  )
  const raised = sumMoney(confirmedContributions.map(row => row.amount))
  const spent = sumMoney(
    (expensesResult.data ?? [])
      .filter(row => !row.is_sponsored)
      .map(row => row.amount),
  )
  const membershipRow = membershipResult.data
  const membership: FundMembership | null = membershipRow
    ? {
      id: membershipRow.id as string,
      fund_id: membershipRow.fund_id as string,
      user_id: membershipRow.user_id as string | null,
      invited_phone: membershipRow.invited_phone as string | null,
      invited_name: membershipRow.invited_name as string | null,
      role: membershipRow.role as FundMembership['role'],
      status: membershipRow.status as FundMembership['status'],
      suggested_contribution: membershipRow.suggested_contribution === null
        ? null
        : String(membershipRow.suggested_contribution),
      contribution_goal: membershipRow.contribution_goal === null
        ? null
        : String(membershipRow.contribution_goal),
      joined_at: membershipRow.joined_at as string | null,
      created_at: membershipRow.created_at as string,
    }
    : null

  return dataSuccess({
    ...toFund(fundResult.data as FundRow),
    membership,
    totals: {
      raised: minorUnitsToMoney(raised),
      spent: minorUnitsToMoney(spent),
      balance: minorUnitsToMoney(raised - spent),
      contribution_count: confirmedContributions.length,
      member_count: memberCountResult.count ?? 0,
    },
  })
}

export async function listApiUsers(
  client: SupabaseClient,
  request: ListUsersRequest,
): Promise<ApiDataResult<Paginated<UserSummary>>> {
  const requestError = commonListError(request, ['created_at', 'name', 'trust_score'])
  if (requestError) return dataFailure({ kind: 'validation', message: requestError })
  const scope = createQueryScope('users', scopeRequest(request))
  const pageWindow = resolvePageWindow(request, scope)
  if (pageWindow.error) return pageWindow

  const sortBy = request.sort_by ?? 'created_at'
  const ascending = (request.sort_direction ?? 'desc') === 'asc'
  let query = client
    .from('users')
    .select('id, name, phone, country_code, trust_level, trust_score, is_flagged, is_banned, profile_completed, created_at')
    .is('deleted_at', null)

  if (request.q?.trim()) {
    const q = request.q.trim()
    query = /^\+?\d+$/.test(q)
      ? query.ilike('phone', searchPattern(q))
      : query.ilike('name', searchPattern(q))
  }
  const trustLevels = values(request.trust_level)
  if (trustLevels.length) query = query.in('trust_level', trustLevels)

  const statuses = values(request.status)
  if (statuses.length) {
    const statusClauses = statuses.map(status => {
      if (status === 'banned') return 'is_banned.eq.true'
      if (status === 'flagged') return 'and(is_banned.eq.false,is_flagged.eq.true)'
      return 'and(is_banned.eq.false,is_flagged.eq.false)'
    })
    query = query.or(statusClauses.join(','))
  }

  const { data, error } = await query
    .order(sortBy, { ascending, nullsFirst: false })
    .order('id', { ascending })
    .range(pageWindow.data.offset, pageWindow.data.offset + pageWindow.data.limit)

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(createPage(data as UserRow[], pageWindow.data, toUserSummary))
}

export async function listApiFunds(
  client: SupabaseClient,
  request: ListFundsRequest,
): Promise<ApiDataResult<Paginated<FundSummary>>> {
  const requestError = commonListError(request, ['created_at', 'title', 'goal_amount', 'contribution_deadline'])
  if (requestError) return dataFailure({ kind: 'validation', message: requestError })
  if (invalidUuidFilter(request.owner_id, request.member_user_id, request.linked_event_id)) {
    return dataFailure({ kind: 'validation', message: 'Fund filter IDs must be valid UUIDs.' })
  }
  const scope = createQueryScope('funds', scopeRequest(request))
  const pageWindow = resolvePageWindow(request, scope)
  if (pageWindow.error) return pageWindow

  let relatedFundIds: string[] | null = null
  if (request.member_user_id) {
    const [memberships, ownedFunds] = await Promise.all([
      client
        .from('fund_members')
        .select('fund_id')
        .eq('user_id', request.member_user_id)
        .not('status', 'in', '(left,removed,declined,pending)'),
      client
        .from('funds')
        .select('id')
        .eq('owner_id', request.member_user_id)
        .is('deleted_at', null),
    ])
    if (memberships.error) return dataFailure({ kind: 'database', error: memberships.error })
    if (ownedFunds.error) return dataFailure({ kind: 'database', error: ownedFunds.error })
    relatedFundIds = [...new Set([
      ...(memberships.data ?? []).map(row => row.fund_id as string),
      ...(ownedFunds.data ?? []).map(row => row.id as string),
    ])]
    if (!relatedFundIds.length) {
      return dataSuccess(createPage([], pageWindow.data, toFundSummary))
    }
  }

  const sortBy = request.sort_by ?? 'created_at'
  const ascending = (request.sort_direction ?? 'desc') === 'asc'
  let query = client
    .from('funds')
    .select('id, owner_id, title, fund_code, fund_type, fund_emoji, currency_code, goal_amount, status, contribution_deadline, linked_event_id, is_private, created_at')
    .is('deleted_at', null)

  if (request.q?.trim()) {
    const q = request.q.trim()
    query = /^\d+$/.test(q)
      ? query.ilike('fund_code', searchPattern(q))
      : query.ilike('title', searchPattern(q))
  }
  if (request.owner_id) query = query.eq('owner_id', request.owner_id)
  if (relatedFundIds) query = query.in('id', relatedFundIds)
  if (request.linked_event_id) query = query.eq('linked_event_id', request.linked_event_id)
  const types = values(request.type)
  if (types.length) query = query.in('fund_type', types)
  const statuses = values(request.status)
  if (statuses.length) query = query.in('status', statuses)

  const { data, error } = await query
    .order(sortBy, { ascending, nullsFirst: false })
    .order('id', { ascending })
    .range(pageWindow.data.offset, pageWindow.data.offset + pageWindow.data.limit)

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(createPage(data as FundRow[], pageWindow.data, toFundSummary))
}

export async function listApiEvents(
  client: SupabaseClient,
  request: ListEventsRequest,
): Promise<ApiDataResult<Paginated<EventSummary>>> {
  const requestError = commonListError(request, ['created_at', 'event_date', 'name'])
  if (requestError) return dataFailure({ kind: 'validation', message: requestError })
  if (invalidUuidFilter(request.creator_id, request.participant_user_id)) {
    return dataFailure({ kind: 'validation', message: 'Event filter IDs must be valid UUIDs.' })
  }
  const scope = createQueryScope('events', scopeRequest(request))
  const pageWindow = resolvePageWindow(request, scope)
  if (pageWindow.error) return pageWindow

  let participantEventIds: string[] | null = null
  if (request.participant_user_id) {
    const [organisers, guests] = await Promise.all([
      client
        .from('event_organisers')
        .select('event_id')
        .eq('user_id', request.participant_user_id)
        .not('status', 'in', '(left,removed)'),
      client
        .from('event_guests')
        .select('event_id')
        .eq('user_id', request.participant_user_id),
    ])
    if (organisers.error) return dataFailure({ kind: 'database', error: organisers.error })
    if (guests.error) return dataFailure({ kind: 'database', error: guests.error })
    participantEventIds = [...new Set([
      ...(organisers.data ?? []).map(row => row.event_id as string),
      ...(guests.data ?? []).map(row => row.event_id as string),
    ])]
  }

  const sortBy = request.sort_by ?? 'created_at'
  const ascending = (request.sort_direction ?? 'desc') === 'asc'
  let query = client
    .from('events')
    .select('id, creator_id, event_code, name, event_type, event_emoji, event_date, event_time, venue_name, currency_code, linked_fund_id, status, created_at')
    .is('deleted_at', null)

  if (request.q?.trim()) query = query.ilike('name', searchPattern(request.q))
  if (request.creator_id) query = query.eq('creator_id', request.creator_id)
  if (request.participant_user_id) {
    query = participantEventIds?.length
      ? query.or(`creator_id.eq.${request.participant_user_id},id.in.(${participantEventIds.join(',')})`)
      : query.eq('creator_id', request.participant_user_id)
  }
  const types = values(request.type)
  if (types.length) query = query.in('event_type', types)
  const statuses = values(request.status)
  if (statuses.length) query = query.in('status', statuses)

  const { data, error } = await query
    .order(sortBy, { ascending, nullsFirst: false })
    .order('id', { ascending })
    .range(pageWindow.data.offset, pageWindow.data.offset + pageWindow.data.limit)

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(createPage(data as EventRow[], pageWindow.data, toEventSummary))
}

export async function listApiContributions(
  client: SupabaseClient,
  request: ListContributionsRequest,
): Promise<ApiDataResult<Paginated<ContributionSummary>>> {
  const requestError = commonListError(request, ['created_at', 'confirmed_at', 'amount'])
  if (requestError) return dataFailure({ kind: 'validation', message: requestError })
  if (invalidUuidFilter(request.fund_id, request.user_id)) {
    return dataFailure({ kind: 'validation', message: 'Contribution filter IDs must be valid UUIDs.' })
  }
  if (request.from && request.to && request.from > request.to) {
    return dataFailure({ kind: 'validation', message: 'The from date cannot be after the to date.' })
  }
  const scope = createQueryScope('contributions', scopeRequest(request))
  const pageWindow = resolvePageWindow(request, scope)
  if (pageWindow.error) return pageWindow

  const sortBy = request.sort_by ?? 'created_at'
  const ascending = (request.sort_direction ?? 'desc') === 'asc'
  let query = client
    .from('contributions')
    .select('id, fund_id, contributor_id, user_id, contributor_name, amount, pledged_amount, currency_code, payment_method, status, is_refunded, confirmed_at, created_at')

  if (request.fund_id) query = query.eq('fund_id', request.fund_id)
  if (request.user_id) query = query.eq('user_id', request.user_id)
  const statuses = values(request.status)
  if (statuses.length) query = query.in('status', statuses)
  const paymentMethods = values(request.payment_method)
  if (paymentMethods.length) query = query.in('payment_method', paymentMethods)
  if (request.from) query = query.gte('created_at', `${request.from}T00:00:00.000Z`)
  if (request.to) query = query.lte('created_at', `${request.to}T23:59:59.999Z`)

  const { data, error } = await query
    .order(sortBy, { ascending, nullsFirst: false })
    .order('id', { ascending })
    .range(pageWindow.data.offset, pageWindow.data.offset + pageWindow.data.limit)

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(createPage(data as ContributionRow[], pageWindow.data, toContributionSummary))
}

export async function listApiSupportTickets(
  client: SupabaseClient,
  request: ListSupportTicketsRequest,
): Promise<ApiDataResult<Paginated<SupportTicketSummary>>> {
  const requestError = commonListError(request, ['created_at', 'priority', 'status'])
  if (requestError) return dataFailure({ kind: 'validation', message: requestError })
  const scope = createQueryScope('support-tickets', scopeRequest(request))
  const pageWindow = resolvePageWindow(request, scope)
  if (pageWindow.error) return pageWindow

  const sortBy = request.sort_by ?? 'created_at'
  const ascending = (request.sort_direction ?? 'desc') === 'asc'
  let query = client
    .from('support_tickets')
    .select('id, ticket_number, category, subject, priority, status, assigned_to, created_at')

  if (request.q?.trim()) {
    const q = request.q.trim()
    query = /^\d+$/.test(q)
      ? query.ilike('ticket_number', searchPattern(q))
      : query.ilike('subject', searchPattern(q))
  }
  const statuses = values(request.status)
  if (statuses.length) query = query.in('status', statuses)
  const priorities = values(request.priority)
  if (priorities.length) query = query.in('priority', priorities)
  if (request.assigned_to) query = query.eq('assigned_to', request.assigned_to)

  const { data, error } = await query
    .order(sortBy, { ascending, nullsFirst: false })
    .order('id', { ascending })
    .range(pageWindow.data.offset, pageWindow.data.offset + pageWindow.data.limit)

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(createPage(
    data as SupportTicketSummary[],
    pageWindow.data,
    toSupportTicketSummary,
  ))
}

export async function listApiAdminAudit(
  client: SupabaseClient,
  request: ListAdminAuditRequest,
): Promise<ApiDataResult<Paginated<AdminAuditEntry>>> {
  const requestError = commonListError(request, ['created_at'])
  if (requestError) return dataFailure({ kind: 'validation', message: requestError })
  if (invalidUuidFilter(request.actor_user_id, request.entity_id)) {
    return dataFailure({ kind: 'validation', message: 'Audit filter IDs must be valid UUIDs.' })
  }
  const scope = createQueryScope('admin-audit', scopeRequest(request))
  const pageWindow = resolvePageWindow(request, scope)
  if (pageWindow.error) return pageWindow

  const ascending = (request.sort_direction ?? 'desc') === 'asc'
  let query = client
    .from('platform_admin_audit_log')
    .select('id, actor_user_id, action, entity_type, entity_id, metadata, created_at')

  if (request.actor_user_id) query = query.eq('actor_user_id', request.actor_user_id)
  if (request.entity_type) query = query.eq('entity_type', request.entity_type)
  if (request.entity_id) query = query.eq('entity_id', request.entity_id)
  if (request.action) query = query.eq('action', request.action)

  const { data, error } = await query
    .order('created_at', { ascending })
    .order('id', { ascending })
    .range(pageWindow.data.offset, pageWindow.data.offset + pageWindow.data.limit)

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(createPage(
    data as AdminAuditEntry[],
    pageWindow.data,
    row => ({
      id: row.id,
      actor_user_id: row.actor_user_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      metadata: row.metadata,
      created_at: row.created_at,
    }),
  ))
}
