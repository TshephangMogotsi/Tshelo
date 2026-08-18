import 'server-only'

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  ModerateFundRequest,
  ModerateUserRequest,
  PlatformAdmin,
  SupportTicketSummary,
  UpdateSupportTicketRequest,
  UpsertPlatformAdminRequest,
} from '@shared/contracts/admin'
import type { Event, CreateEventRequest } from '@shared/contracts/events'
import type { CreateFundRequest, Fund, FundSummary } from '@shared/contracts/funds'
import type { UserSummary } from '@shared/contracts/users'
import {
  type EventRow,
  type FundRow,
  type UserRow,
  toEvent,
  toFund,
  toFundSummary,
  toUserSummary,
} from './api-records'

type MutationResult<T> =
  | { data: T; error: null }
  | { data: null; error: PostgrestError }

function success<T>(data: T): MutationResult<T> {
  return { data, error: null }
}

function failure<T>(error: PostgrestError): MutationResult<T> {
  return { data: null, error }
}

export async function createApiEvent(
  client: SupabaseClient,
  request: CreateEventRequest,
): Promise<MutationResult<Event>> {
  const { data, error } = await client.rpc('create_standalone_event', {
    p_name: request.name,
    p_event_type: request.event_type,
    p_event_date: request.event_date,
    p_currency_code: request.currency_code,
    p_description: request.description ?? null,
    p_event_emoji: request.event_emoji ?? null,
    p_event_time: request.event_time ?? null,
    p_event_end_date: request.event_end_date ?? null,
    p_event_end_time: request.event_end_time ?? null,
    p_venue_name: request.venue_name ?? null,
    p_venue_address: request.venue_address ?? null,
    p_organisers: request.organisers ?? [],
  }).single()

  if (error) return failure(error)
  return success(toEvent(data as EventRow))
}

export async function createApiFund(
  client: SupabaseClient,
  actorUserId: string,
  request: CreateFundRequest,
): Promise<MutationResult<Fund>> {
  if (request.linked_event_id) {
    const { data, error } = await client.rpc('create_fund_for_existing_event', {
      p_event_id: request.linked_event_id,
      p_title: request.title,
      p_currency_code: request.currency_code,
      p_description: request.description ?? null,
      p_fund_emoji: request.fund_emoji ?? null,
      p_goal_amount: request.goal_amount ?? null,
      p_type_specific_data: request.type_specific_data ?? {},
      p_contribution_deadline: request.contribution_deadline ?? null,
      p_is_private: request.is_private ?? false,
    }).single()

    if (error) return failure(error)
    return success(toFund(data as FundRow))
  }

  const { data, error } = await client
    .from('funds')
    .insert({
      owner_id: actorUserId,
      title: request.title.trim(),
      description: request.description?.trim() || null,
      fund_type: request.fund_type.trim(),
      fund_emoji: request.fund_emoji?.trim() || null,
      currency_code: request.currency_code,
      goal_amount: request.goal_amount ?? null,
      type_specific_data: request.type_specific_data ?? {},
      event_date: request.event_date ?? null,
      event_time: request.event_time ?? null,
      event_location: request.event_location?.trim() || null,
      contribution_deadline: request.contribution_deadline ?? null,
      is_private: request.is_private ?? false,
    })
    .select('*')
    .single()

  if (error) return failure(error)
  return success(toFund(data as FundRow))
}

export async function updateApiSupportTicket(
  client: SupabaseClient,
  request: UpdateSupportTicketRequest,
): Promise<MutationResult<SupportTicketSummary>> {
  const patch: Record<string, string | null> = {}
  if (request.status !== undefined) patch.status = request.status
  if (request.priority !== undefined) patch.priority = request.priority
  if (request.assigned_to !== undefined) patch.assigned_to = request.assigned_to
  if (request.resolution_note !== undefined) patch.resolution_note = request.resolution_note

  const { data, error } = await client.rpc('platform_admin_update_support_ticket', {
    p_ticket_id: request.ticket_id,
    p_patch: patch,
  }).single()

  if (error) return failure(error)
  const row = data as SupportTicketSummary
  return success({
    id: row.id,
    ticket_number: row.ticket_number,
    category: row.category,
    subject: row.subject,
    priority: row.priority,
    status: row.status,
    assigned_to: row.assigned_to,
    created_at: row.created_at,
  })
}

export async function moderateApiUser(
  client: SupabaseClient,
  request: ModerateUserRequest,
): Promise<MutationResult<UserSummary>> {
  const { data, error } = await client.rpc('platform_admin_moderate_user', {
    p_user_id: request.user_id,
    p_action: request.action,
    p_reason: request.reason ?? null,
  }).single()

  if (error) return failure(error)
  return success(toUserSummary(data as UserRow))
}

export async function moderateApiFund(
  client: SupabaseClient,
  request: ModerateFundRequest,
): Promise<MutationResult<FundSummary>> {
  const { data, error } = await client.rpc('platform_admin_moderate_fund', {
    p_fund_id: request.fund_id,
    p_action: request.action,
    p_reason: request.reason ?? null,
  }).single()

  if (error) return failure(error)
  return success(toFundSummary(data as FundRow))
}

export async function upsertApiPlatformAdmin(
  client: SupabaseClient,
  request: UpsertPlatformAdminRequest,
): Promise<MutationResult<PlatformAdmin>> {
  const { data, error } = await client.rpc('platform_admin_upsert', {
    p_user_id: request.user_id,
    p_role: request.role,
    p_status: request.status,
  }).single()

  if (error) return failure(error)
  return success(data as PlatformAdmin)
}
