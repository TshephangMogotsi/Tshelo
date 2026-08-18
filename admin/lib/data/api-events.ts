import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CompleteEventRequest,
  CreatedEventFund,
  CreateEventAnnouncementRequest,
  CreateEventFundRequest,
  Event,
  EventAnnouncement,
  EventBudget,
  EventInvitePreview,
  EventWorkspace,
  InviteEventOrganiserRequest,
  JoinedEvent,
  LeftEvent,
  UpdateEventBudgetRequest,
  UpdateEventRequest,
} from '@shared/contracts/events'
import { getApiEvent } from './api-queries'
import { getApiFundWorkspace } from './api-funds'
import { dataFailure, dataSuccess, type ApiDataResult } from './api-pagination'
import { toEvent, type EventRow } from './api-records'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validEventId(eventId: string): ApiDataResult<string> {
  return UUID_PATTERN.test(eventId)
    ? dataSuccess(eventId)
    : dataFailure({ kind: 'validation', message: 'event_id must be a valid UUID.' })
}

function money(value: unknown) {
  return String(value ?? '0')
}

export async function getApiEventWorkspace(
  client: SupabaseClient,
  actorUserId: string,
  eventId: string,
): Promise<ApiDataResult<EventWorkspace | null>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid

  const eventResult = await getApiEvent(client, eventId)
  if (eventResult.error || !eventResult.data) return eventResult as ApiDataResult<EventWorkspace | null>
  const event = eventResult.data.event

  const [budgetResult, announcementResult, organiserResult, permissionResult] = await Promise.all([
    client
      .from('event_budgets')
      .select('event_id, total_budget, currency_code')
      .eq('event_id', eventId)
      .maybeSingle(),
    client
      .from('event_announcements')
      .select('id, event_id, author_id, author_name, title, body, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
    client
      .from('event_organisers')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', actorUserId)
      .eq('status', 'active')
      .maybeSingle(),
    event.linked_fund_id
      ? client.rpc('get_my_fund_permissions', { p_fund_id: event.linked_fund_id })
      : Promise.resolve({ data: [], error: null }),
  ])

  for (const result of [budgetResult, announcementResult, organiserResult, permissionResult]) {
    if (result.error) return dataFailure({ kind: 'database', error: result.error })
  }

  let linkedFund: EventWorkspace['linked_fund'] = null
  if (event.linked_fund_id) {
    const fundResult = await getApiFundWorkspace(client, actorUserId, event.linked_fund_id)
    if (fundResult.error?.kind === 'database' && fundResult.error.error.code !== '42501') {
      return dataFailure(fundResult.error)
    }
    linkedFund = fundResult.data ?? null
  }

  const isCreator = event.creator_id === actorUserId
  const isOrganiser = Boolean(organiserResult.data)
  const isGuest = eventResult.data.guests.some(guest => guest.user_id === actorUserId)
  const permissionRows = (permissionResult.data ?? []) as Array<{ permission_key: string }>
  const linkedFundPermissions = permissionRows
    .map(row => row.permission_key)
    .filter((key: string): key is EventWorkspace['capabilities']['linked_fund_permissions'][number] => [
      'record_contributions', 'edit_contributions', 'record_expenses', 'edit_expenses',
      'manage_members', 'manage_sponsorships', 'award_recognition', 'export_reports',
      'manage_event_guests', 'post_event_announcements', 'manage_event_budget',
    ].includes(key))

  return dataSuccess({
    event,
    guests: eventResult.data.guests,
    budget: budgetResult.data ? {
      event_id: budgetResult.data.event_id as string,
      total_budget: money(budgetResult.data.total_budget),
      currency_code: budgetResult.data.currency_code as EventBudget['currency_code'],
    } : null,
    announcements: (announcementResult.data ?? []).map(row => ({
      id: row.id as string,
      event_id: row.event_id as string,
      author_id: row.author_id as string,
      author_name: String(row.author_name ?? 'Organiser'),
      title: row.title as string,
      body: row.body as string,
      created_at: row.created_at as string,
    })),
    capabilities: {
      is_creator: isCreator,
      is_organiser: isOrganiser,
      can_leave_event: !isCreator && (isOrganiser || isGuest),
      linked_fund_permissions: linkedFundPermissions,
    },
    linked_fund: linkedFund,
  })
}

export async function updateApiEvent(
  client: SupabaseClient,
  eventId: string,
  input: UpdateEventRequest,
): Promise<ApiDataResult<Event | null>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<Event | null>
  const changes = Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key,
    typeof value === 'string' ? value.trim() : value,
  ]))
  const result = await client.from('events').update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', eventId).is('deleted_at', null).select('*').maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ? toEvent(result.data as EventRow) : null)
}

export async function completeApiEvent(
  client: SupabaseClient,
  eventId: string,
  input: CompleteEventRequest,
): Promise<ApiDataResult<Event | null>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<Event | null>
  const completedAt = new Date().toISOString()
  const result = await client.from('events').update({
    status: 'completed',
    completed_at: completedAt,
    estimated_spend_amount: input.estimated_spend_amount,
    updated_at: completedAt,
  }).eq('id', eventId).is('linked_fund_id', null).is('deleted_at', null).select('*').maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ? toEvent(result.data as EventRow) : null)
}

export async function deleteApiEvent(client: SupabaseClient, eventId: string): Promise<ApiDataResult<boolean>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<boolean>
  const result = await client.rpc('delete_event_only', { p_event_id: eventId })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(Boolean(result.data))
}

export async function leaveApiEvent(client: SupabaseClient, eventId: string): Promise<ApiDataResult<LeftEvent>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<LeftEvent>
  const result = await client.rpc('leave_event', { p_event_id: eventId }).single()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data as LeftEvent)
}

export async function previewApiEventInvite(client: SupabaseClient, code: string): Promise<ApiDataResult<EventInvitePreview | null>> {
  const result = await client.rpc('find_event_by_code', { p_code: code.trim() }).maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data as EventInvitePreview | null)
}

export async function joinApiEvent(client: SupabaseClient, code: string): Promise<ApiDataResult<JoinedEvent>> {
  const result = await client.rpc('join_event_by_code', { p_code: code.trim() }).single()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data as JoinedEvent)
}

export async function createApiEventFund(client: SupabaseClient, input: CreateEventFundRequest): Promise<ApiDataResult<CreatedEventFund>> {
  const result = await client.rpc('create_event_fund', {
    p_event_name: input.event_name,
    p_event_type: input.event_type,
    p_event_emoji: input.event_emoji ?? null,
    p_event_date: input.event_date,
    p_event_time: input.event_time,
    p_event_venue: input.event_venue,
    p_fund_title: input.fund_title,
    p_currency_code: input.currency_code,
    p_budget: input.budget,
    p_goal_percentage: input.goal_percentage,
    p_is_private: input.is_private ?? false,
    p_organisers: input.organisers ?? [],
  }).single()
  if (result.error) {
    if (result.error.message.includes('INSUFFICIENT_TOKENS')) {
      return dataFailure({ kind: 'validation', message: 'You do not have enough tokens to create an Event + Fund.' })
    }
    return dataFailure({ kind: 'database', error: result.error })
  }

  const created = result.data as Omit<CreatedEventFund, 'venue_address_saved'>
  let venueAddressSaved = !input.venue_address
  if (input.venue_address) {
    const venueResult = await client.from('events').update({ venue_address: input.venue_address })
      .eq('id', created.event_id).select('id').maybeSingle()
    venueAddressSaved = !venueResult.error && Boolean(venueResult.data)
  }
  return dataSuccess({ ...created, venue_address_saved: venueAddressSaved })
}

export async function updateApiEventBudget(client: SupabaseClient, eventId: string, input: UpdateEventBudgetRequest): Promise<ApiDataResult<EventBudget>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<EventBudget>
  const result = await client.from('event_budgets').upsert({
    event_id: eventId,
    total_budget: input.total_budget,
    currency_code: input.currency_code,
  }, { onConflict: 'event_id' }).select('event_id, total_budget, currency_code').single()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({
    event_id: result.data.event_id as string,
    total_budget: money(result.data.total_budget),
    currency_code: result.data.currency_code as EventBudget['currency_code'],
  })
}

export async function getApiEventBudget(client: SupabaseClient, eventId: string): Promise<ApiDataResult<EventBudget | null>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<EventBudget | null>
  const result = await client.from('event_budgets').select('event_id, total_budget, currency_code')
    .eq('event_id', eventId).maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ? {
    event_id: result.data.event_id as string,
    total_budget: money(result.data.total_budget),
    currency_code: result.data.currency_code as EventBudget['currency_code'],
  } : null)
}

export async function createApiEventAnnouncement(
  client: SupabaseClient,
  actorUserId: string,
  eventId: string,
  input: CreateEventAnnouncementRequest,
): Promise<ApiDataResult<EventAnnouncement>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<EventAnnouncement>
  const result = await client.from('event_announcements').insert({
    event_id: eventId,
    author_id: actorUserId,
    title: input.title.trim(),
    body: input.body.trim(),
  }).select('id, event_id, author_id, author_name, title, body, created_at').single()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({
    id: result.data.id as string,
    event_id: result.data.event_id as string,
    author_id: result.data.author_id as string,
    author_name: String(result.data.author_name ?? 'Organiser'),
    title: result.data.title as string,
    body: result.data.body as string,
    created_at: result.data.created_at as string,
  })
}

export async function inviteApiEventOrganiser(
  client: SupabaseClient,
  eventId: string,
  input: InviteEventOrganiserRequest,
): Promise<ApiDataResult<Record<string, never>>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<Record<string, never>>
  const result = await client.rpc('invite_event_fund_organiser', {
    p_event_id: eventId,
    p_name: input.name.trim(),
    p_phone: input.phone,
  })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({})
}
