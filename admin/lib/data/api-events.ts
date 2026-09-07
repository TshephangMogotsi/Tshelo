import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CompleteEventRequest,
  CreatedEventFund,
  CreateEventAnnouncementRequest,
  CreateEventAnnouncementUploadSessionRequest,
  CreateEventFundRequest,
  Event,
  EventAnnouncement,
  EventAnnouncementAttachment,
  EventAnnouncementAttachmentAccess,
  EventAnnouncementAttachmentAccessRequest,
  EventAnnouncementUploadSession,
  EventBudget,
  EventGuest,
  EventGuestCapacity,
  EventGuestDirectory,
  EventGuestSummary,
  EventInvitePreview,
  EventWorkspace,
  InviteEventGuestsRequest,
  InviteEventOrganiserRequest,
  JoinedEvent,
  ListEventGuestsRequest,
  LeftEvent,
  RemoveEventGuestResult,
  RespondEventRsvpRequest,
  UnlockEventGuestCapacityResult,
  UpdateEventBudgetRequest,
  UpdateEventAnnouncementRequest,
  UpdateEventGuestRequest,
  UpdateEventRequest,
} from '@shared/contracts/events'
import { getApiEvent } from './api-queries'
import { getApiFundWorkspace } from './api-funds'
import {
  createPage,
  createQueryScope,
  dataFailure,
  dataSuccess,
  resolvePageWindow,
  type ApiDataResult,
} from './api-pagination'
import { toEvent, toEventGuest, type EventGuestRow, type EventRow } from './api-records'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT_ANNOUNCEMENT_ATTACHMENT_BUCKET = 'event-announcement-files'
const EVENT_ANNOUNCEMENT_UPLOAD_SESSION_SECONDS = 2 * 60 * 60
const EVENT_ANNOUNCEMENT_ATTACHMENT_ACCESS_SECONDS = 5 * 60
const EVENT_GUEST_SELECT = 'id, event_id, user_id, guest_name, guest_phone, guest_email, rsvp_status, rsvp_responded_at, plus_ones, allowed_plus_ones, plus_ones_names, rsvp_note, dietary_requirements, accessibility_needs, invited_by, invited_at, invitation_sent_at, invitation_channel, created_at, updated_at'

const attachmentExtensions: Record<EventAnnouncementAttachment['content_type'], string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function validEventId(eventId: string): ApiDataResult<string> {
  return UUID_PATTERN.test(eventId)
    ? dataSuccess(eventId)
    : dataFailure({ kind: 'validation', message: 'event_id must be a valid UUID.' })
}

function money(value: unknown) {
  return String(value ?? '0')
}

function eventGuestSearchPattern(value: string) {
  return `%${value.trim().replace(/[\\%_]/g, '\\$&')}%`
}

function eventGuestRpcFailure<T>(error: { code?: string; message?: string }): ApiDataResult<T> {
  const message = error.message ?? ''
  if (message.includes('EVENT_GUEST_CAPACITY_REACHED')) {
    return dataFailure({ kind: 'business', code: 'CONFLICT', message: 'This event has reached its free 100-person guest limit. Unlock additional capacity to continue.' })
  }
  if (message.includes('INSUFFICIENT_TOKENS')) {
    return dataFailure({ kind: 'business', code: 'CONFLICT', message: 'You do not have enough tokens to unlock additional guest capacity.' })
  }
  if (message.includes('EVENT_INACTIVE')) {
    return dataFailure({ kind: 'business', code: 'CONFLICT', message: 'Completed or cancelled events cannot accept guest-list changes.' })
  }
  if (message.includes('EVENT_GUEST_DUPLICATE')) {
    return dataFailure({ kind: 'business', code: 'CONFLICT', message: 'That phone number is already on this event guest list.' })
  }
  if (message.includes('EVENT_GUEST_NOT_FOUND')) {
    return dataFailure({ kind: 'business', code: 'NOT_FOUND', message: 'The requested event or guest could not be found.' })
  }
  if (message.includes('EVENT_GUEST_FORBIDDEN') || message.includes('EVENT_RSVP_CODE_REQUIRED')) {
    return dataFailure({ kind: 'business', code: 'FORBIDDEN', message: 'A valid invitation or guest-list management permission is required.' })
  }
  if (message.includes('EVENT_GUEST_INVALID') || message.includes('EVENT_RSVP_INVALID')) {
    return dataFailure({ kind: 'validation', message: 'The guest or RSVP details are invalid.' })
  }
  if (message.includes('EVENT_GUEST_CAPACITY_UNAVAILABLE')) {
    return dataFailure({ kind: 'business', code: 'CONFLICT', message: 'Additional guest capacity is temporarily unavailable.' })
  }
  return dataFailure({ kind: 'database', error })
}

async function requireEventGuestManager(client: SupabaseClient, eventId: string): Promise<ApiDataResult<true>> {
  const result = await client.rpc('can_manage_event_guests', { p_event_id: eventId })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return result.data
    ? dataSuccess(true)
    : dataFailure({ kind: 'business', code: 'FORBIDDEN', message: 'Guest-list management permission is required.' })
}

type EventGuestOverviewRow = EventGuestSummary & {
  event_id: string
  free_limit: number
  is_unlimited: boolean
  unlimited_source: EventGuestCapacity['unlimited_source']
  unlock_cost_tokens: number
}

async function loadEventGuestOverview(
  client: SupabaseClient,
  eventId: string,
): Promise<ApiDataResult<{ summary: EventGuestSummary; capacity: EventGuestCapacity }>> {
  const result = await client.rpc('get_event_guest_overview', { p_event_id: eventId }).single()
  if (result.error) return eventGuestRpcFailure(result.error)
  const row = result.data as EventGuestOverviewRow
  const summary = {
    invitation_count: Number(row.invitation_count ?? 0),
    invited_people: Number(row.invited_people ?? 0),
    confirmed_people: Number(row.confirmed_people ?? 0),
    maybe_people: Number(row.maybe_people ?? 0),
    pending_people: Number(row.pending_people ?? 0),
    declined_people: Number(row.declined_people ?? 0),
  }
  return dataSuccess({
    summary,
    capacity: {
      event_id: row.event_id,
      used: summary.invited_people,
      free_limit: Number(row.free_limit ?? 100),
      is_unlimited: Boolean(row.is_unlimited),
      unlimited_source: row.unlimited_source ?? null,
      unlock_cost_tokens: Number(row.unlock_cost_tokens ?? 10),
    },
  })
}

function toAnnouncementAttachments(value: unknown): EventAnnouncementAttachment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const attachment = item as Record<string, unknown>
    const contentType = attachment.content_type
    if (
      typeof attachment.object_path !== 'string'
      || typeof attachment.file_name !== 'string'
      || typeof attachment.size_bytes !== 'number'
      || !Object.hasOwn(attachmentExtensions, contentType as string)
    ) return []
    return [{
      object_path: attachment.object_path,
      file_name: attachment.file_name,
      content_type: contentType as EventAnnouncementAttachment['content_type'],
      size_bytes: attachment.size_bytes,
    }]
  })
}

function hasValidAnnouncementAttachmentPath(
  attachment: EventAnnouncementAttachment,
  eventId: string,
  actorUserId: string,
) {
  const extension = attachmentExtensions[attachment.content_type]
  const prefix = `${eventId}/${actorUserId}/`
  const fileName = attachment.object_path.slice(prefix.length)
  return attachment.object_path.startsWith(prefix) && new RegExp(`^[0-9a-f-]+\\.${extension}$`, 'i').test(fileName)
}

function hasValidEventAnnouncementObjectPath(objectPath: string, eventId: string, actorUserId?: string) {
  const segments = objectPath.split('/')
  if (segments.length !== 3 || segments[0] !== eventId || !UUID_PATTERN.test(segments[1])) return false
  if (actorUserId && segments[1] !== actorUserId) return false
  return /^[0-9a-f-]+\.(?:pdf|jpg|png|webp)$/i.test(segments[2])
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
      .select('id, event_id, author_id, author_name, title, body, attachments, created_at')
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
      attachments: toAnnouncementAttachments(row.attachments),
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

export async function listApiEventGuests(
  client: SupabaseClient,
  eventId: string,
  request: ListEventGuestsRequest = {},
): Promise<ApiDataResult<EventGuestDirectory>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<EventGuestDirectory>
  if (request.sort_by && !['invited_at', 'guest_name', 'rsvp_status'].includes(request.sort_by)) {
    return dataFailure({ kind: 'validation', message: 'Unsupported event guest sort field.' })
  }
  if (request.sort_direction && !['asc', 'desc'].includes(request.sort_direction)) {
    return dataFailure({ kind: 'validation', message: 'Sort direction must be asc or desc.' })
  }
  if (request.q && request.q.trim().length > 100) {
    return dataFailure({ kind: 'validation', message: 'Search text cannot exceed 100 characters.' })
  }

  const permission = await requireEventGuestManager(client, eventId)
  if (permission.error) return permission as ApiDataResult<EventGuestDirectory>

  const scopeRequest = { ...request, event_id: eventId } as Record<string, unknown>
  delete scopeRequest.cursor
  delete scopeRequest.limit
  const scope = createQueryScope('event-guests', scopeRequest)
  const pageWindow = resolvePageWindow(request, scope)
  if (pageWindow.error) return pageWindow

  const sortBy = request.sort_by ?? 'invited_at'
  const ascending = (request.sort_direction ?? 'desc') === 'asc'
  let query = client.from('event_guests').select(EVENT_GUEST_SELECT).eq('event_id', eventId)
  const search = request.q?.trim()
  if (search) {
    query = /^\+?\d+$/.test(search)
      ? query.ilike('guest_phone', eventGuestSearchPattern(search))
      : search.includes('@')
        ? query.ilike('guest_email', eventGuestSearchPattern(search))
        : query.ilike('guest_name', eventGuestSearchPattern(search))
  }
  const statuses = request.status === undefined
    ? []
    : Array.isArray(request.status) ? request.status : [request.status]
  if (statuses.length) query = query.in('rsvp_status', statuses)

  const [guestResult, overview] = await Promise.all([
    query
      .order(sortBy, { ascending, nullsFirst: false })
      .order('id', { ascending })
      .range(pageWindow.data.offset, pageWindow.data.offset + pageWindow.data.limit),
    loadEventGuestOverview(client, eventId),
  ])
  if (guestResult.error) return dataFailure({ kind: 'database', error: guestResult.error })
  if (overview.error) return overview as ApiDataResult<EventGuestDirectory>

  return dataSuccess({
    ...createPage(guestResult.data as EventGuestRow[], pageWindow.data, toEventGuest),
    summary: overview.data.summary,
    capacity: overview.data.capacity,
  })
}

export async function getApiEventGuest(
  client: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<ApiDataResult<EventGuest | null>> {
  if (!UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(guestId)) {
    return dataFailure({ kind: 'validation', message: 'Event and guest IDs must be valid UUIDs.' })
  }
  const permission = await requireEventGuestManager(client, eventId)
  if (permission.error) return permission as ApiDataResult<EventGuest | null>
  const result = await client.from('event_guests').select(EVENT_GUEST_SELECT)
    .eq('event_id', eventId).eq('id', guestId).maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ? toEventGuest(result.data as EventGuestRow) : null)
}

export async function inviteApiEventGuests(
  client: SupabaseClient,
  eventId: string,
  input: InviteEventGuestsRequest,
): Promise<ApiDataResult<EventGuest[]>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<EventGuest[]>
  const result = await client.rpc('invite_event_guests', { p_event_id: eventId, p_guests: input.guests })
  if (result.error) return eventGuestRpcFailure(result.error)
  return dataSuccess(((result.data ?? []) as EventGuestRow[]).map(toEventGuest))
}

/**
 * Records that Resend accepted an event invitation. Call this from the trusted
 * API route with the authenticated event manager's RLS-scoped client.
 */
export async function markApiEventGuestEmailInvitationSent(
  client: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<ApiDataResult<EventGuest>> {
  if (!UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(guestId)) {
    return dataFailure({ kind: 'validation', message: 'Event and guest IDs must be valid UUIDs.' })
  }

  const result = await client
    .from('event_guests')
    .update({ invitation_sent_at: new Date().toISOString(), invitation_channel: 'email' })
    .eq('event_id', eventId)
    .eq('id', guestId)
    .select(EVENT_GUEST_SELECT)
    .maybeSingle()

  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  if (!result.data) {
    return dataFailure({
      kind: 'business',
      code: 'NOT_FOUND',
      message: 'The invited guest could not be found.',
    })
  }
  return dataSuccess(toEventGuest(result.data as EventGuestRow))
}

export async function updateApiEventGuest(
  client: SupabaseClient,
  eventId: string,
  guestId: string,
  input: UpdateEventGuestRequest,
): Promise<ApiDataResult<EventGuest | null>> {
  if (!UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(guestId)) {
    return dataFailure({ kind: 'validation', message: 'Event and guest IDs must be valid UUIDs.' })
  }
  const result = await client.rpc('update_event_guest', {
    p_event_id: eventId,
    p_guest_id: guestId,
    p_changes: input,
  }).maybeSingle()
  if (result.error) return eventGuestRpcFailure(result.error)
  return dataSuccess(result.data ? toEventGuest(result.data as EventGuestRow) : null)
}

export async function removeApiEventGuest(
  client: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<ApiDataResult<RemoveEventGuestResult>> {
  if (!UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(guestId)) {
    return dataFailure({ kind: 'validation', message: 'Event and guest IDs must be valid UUIDs.' })
  }
  const result = await client.rpc('remove_event_guest', { p_event_id: eventId, p_guest_id: guestId })
  if (result.error) return eventGuestRpcFailure(result.error)
  return dataSuccess({ guest_id: String(result.data) })
}

export async function getApiMyEventRsvp(
  client: SupabaseClient,
  actorUserId: string,
  eventId: string,
): Promise<ApiDataResult<EventGuest | null>> {
  if (!UUID_PATTERN.test(actorUserId) || !UUID_PATTERN.test(eventId)) {
    return dataFailure({ kind: 'validation', message: 'Actor and event IDs must be valid UUIDs.' })
  }
  const result = await client.from('event_guests').select(EVENT_GUEST_SELECT)
    .eq('event_id', eventId).eq('user_id', actorUserId).maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ? toEventGuest(result.data as EventGuestRow) : null)
}

export async function respondApiEventRsvp(
  client: SupabaseClient,
  eventId: string,
  input: RespondEventRsvpRequest,
): Promise<ApiDataResult<EventGuest>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<EventGuest>
  const result = await client.rpc('respond_event_rsvp', {
    p_event_id: eventId,
    p_code: input.code?.trim() || null,
    p_status: input.status,
    p_plus_ones: input.status === 'no' ? 0 : input.plus_ones ?? 0,
    p_plus_ones_names: input.status === 'no' ? [] : input.plus_ones_names ?? [],
    p_rsvp_note: input.rsvp_note ?? null,
    p_dietary_requirements: input.dietary_requirements ?? null,
    p_accessibility_needs: input.accessibility_needs ?? null,
  }).single()
  if (result.error) return eventGuestRpcFailure(result.error)
  return dataSuccess(toEventGuest(result.data as EventGuestRow))
}

export async function getApiEventGuestCapacity(
  client: SupabaseClient,
  eventId: string,
): Promise<ApiDataResult<EventGuestCapacity>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<EventGuestCapacity>
  const overview = await loadEventGuestOverview(client, eventId)
  return overview.error
    ? overview as ApiDataResult<EventGuestCapacity>
    : dataSuccess(overview.data.capacity)
}

export async function unlockApiEventGuestCapacity(
  client: SupabaseClient,
  eventId: string,
): Promise<ApiDataResult<UnlockEventGuestCapacityResult>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<UnlockEventGuestCapacityResult>
  const result = await client.rpc('unlock_event_guest_capacity', { p_event_id: eventId }).single()
  if (result.error) return eventGuestRpcFailure(result.error)
  const capacity = result.data as UnlockEventGuestCapacityResult
  return dataSuccess({
    event_id: capacity.event_id,
    is_unlimited: Boolean(capacity.is_unlimited),
    tokens_spent: Number(capacity.tokens_spent ?? 0),
    remaining_tokens: Number(capacity.remaining_tokens ?? 0),
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
  const attachments = input.attachments ?? []
  if (!attachments.every(attachment => hasValidAnnouncementAttachmentPath(attachment, eventId, actorUserId))) {
    return dataFailure({ kind: 'validation', message: 'Announcement attachments must belong to this event and uploader.' })
  }
  const result = await client.from('event_announcements').insert({
    event_id: eventId,
    author_id: actorUserId,
    title: input.title.trim(),
    body: input.body.trim(),
    attachments,
  }).select('id, event_id, author_id, author_name, title, body, attachments, created_at').single()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({
    id: result.data.id as string,
    event_id: result.data.event_id as string,
    author_id: result.data.author_id as string,
    author_name: String(result.data.author_name ?? 'Organiser'),
    title: result.data.title as string,
    body: result.data.body as string,
    attachments: toAnnouncementAttachments(result.data.attachments),
    created_at: result.data.created_at as string,
  })
}

export async function updateApiEventAnnouncement(
  client: SupabaseClient,
  actorUserId: string,
  eventId: string,
  announcementId: string,
  input: UpdateEventAnnouncementRequest,
): Promise<ApiDataResult<EventAnnouncement | null>> {
  const validEvent = validEventId(eventId)
  if (validEvent.error) return validEvent as ApiDataResult<EventAnnouncement | null>
  if (!UUID_PATTERN.test(announcementId)) return dataFailure({ kind: 'validation', message: 'announcement_id must be a valid UUID.' })
  const currentResult = await client.from('event_announcements').select('attachments')
    .eq('id', announcementId)
    .eq('event_id', eventId)
    .maybeSingle()
  if (currentResult.error) return dataFailure({ kind: 'database', error: currentResult.error })
  if (!currentResult.data) return dataSuccess(null)
  const existingAttachments = toAnnouncementAttachments(currentResult.data.attachments)
  const changes: UpdateEventAnnouncementRequest = {}
  if (input.title !== undefined) changes.title = input.title.trim()
  if (input.body !== undefined) changes.body = input.body.trim()
  let removedAttachmentPaths: string[] = []
  if (input.attachments !== undefined) {
    const existingByPath = new Map(existingAttachments.map(attachment => [attachment.object_path, attachment]))
    const attachments = input.attachments.map(attachment => existingByPath.get(attachment.object_path) ?? attachment)
    if (!attachments.every(attachment => existingByPath.has(attachment.object_path) || hasValidAnnouncementAttachmentPath(attachment, eventId, actorUserId))) {
      return dataFailure({ kind: 'validation', message: 'New announcement attachments must belong to this event and editor.' })
    }
    changes.attachments = attachments
    const retainedPaths = new Set(attachments.map(attachment => attachment.object_path))
    removedAttachmentPaths = existingAttachments.filter(attachment => !retainedPaths.has(attachment.object_path)).map(attachment => attachment.object_path)
  }
  const result = await client.from('event_announcements').update(changes)
    .eq('id', announcementId)
    .eq('event_id', eventId)
    .select('id, event_id, author_id, author_name, title, body, attachments, created_at')
    .maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  if (result.data && removedAttachmentPaths.length > 0) {
    await client.storage.from(EVENT_ANNOUNCEMENT_ATTACHMENT_BUCKET).remove(removedAttachmentPaths)
  }
  return dataSuccess(result.data ? {
    id: result.data.id as string,
    event_id: result.data.event_id as string,
    author_id: result.data.author_id as string,
    author_name: String(result.data.author_name ?? 'Organiser'),
    title: result.data.title as string,
    body: result.data.body as string,
    attachments: toAnnouncementAttachments(result.data.attachments),
    created_at: result.data.created_at as string,
  } : null)
}

export async function createApiEventAnnouncementUploadSession(
  client: SupabaseClient,
  actorUserId: string,
  eventId: string,
  input: CreateEventAnnouncementUploadSessionRequest,
): Promise<ApiDataResult<EventAnnouncementUploadSession>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<EventAnnouncementUploadSession>
  const extension = attachmentExtensions[input.content_type]
  if (!extension) return dataFailure({ kind: 'validation', message: 'Only PDF and image attachments are supported.' })
  const objectPath = `${eventId}/${actorUserId}/${crypto.randomUUID()}.${extension}`
  const result = await client.storage.from(EVENT_ANNOUNCEMENT_ATTACHMENT_BUCKET).createSignedUploadUrl(objectPath)
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({
    object_path: objectPath,
    file_name: input.file_name.trim(),
    content_type: input.content_type,
    size_bytes: input.size_bytes,
    upload_url: result.data.signedUrl,
    expires_at: new Date(Date.now() + EVENT_ANNOUNCEMENT_UPLOAD_SESSION_SECONDS * 1000).toISOString(),
  })
}

export async function createApiEventAnnouncementAttachmentAccess(
  client: SupabaseClient,
  eventId: string,
  input: EventAnnouncementAttachmentAccessRequest,
): Promise<ApiDataResult<EventAnnouncementAttachmentAccess>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<EventAnnouncementAttachmentAccess>
  if (!hasValidEventAnnouncementObjectPath(input.object_path, eventId)) {
    return dataFailure({ kind: 'validation', message: 'Attachment path is invalid for this event.' })
  }
  const result = await client.storage
    .from(EVENT_ANNOUNCEMENT_ATTACHMENT_BUCKET)
    .createSignedUrl(input.object_path, EVENT_ANNOUNCEMENT_ATTACHMENT_ACCESS_SECONDS)
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({
    object_path: input.object_path,
    download_url: result.data.signedUrl,
    expires_at: new Date(Date.now() + EVENT_ANNOUNCEMENT_ATTACHMENT_ACCESS_SECONDS * 1000).toISOString(),
  })
}

export async function deleteApiEventAnnouncementUpload(
  client: SupabaseClient,
  actorUserId: string,
  eventId: string,
  input: EventAnnouncementAttachmentAccessRequest,
): Promise<ApiDataResult<Record<string, never>>> {
  const valid = validEventId(eventId)
  if (valid.error) return valid as ApiDataResult<Record<string, never>>
  if (!hasValidEventAnnouncementObjectPath(input.object_path, eventId, actorUserId)) {
    return dataFailure({ kind: 'validation', message: 'Only your own pending upload can be removed.' })
  }
  const referenceResult = await client
    .from('event_announcements')
    .select('id')
    .eq('event_id', eventId)
    .contains('attachments', [{ object_path: input.object_path }])
    .limit(1)
  if (referenceResult.error) return dataFailure({ kind: 'database', error: referenceResult.error })
  if ((referenceResult.data ?? []).length > 0) {
    return dataFailure({ kind: 'validation', message: 'Published attachments must be removed by editing the announcement.' })
  }
  const result = await client.storage.from(EVENT_ANNOUNCEMENT_ATTACHMENT_BUCKET).remove([input.object_path])
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({})
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
