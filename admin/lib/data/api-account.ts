import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  RespondOrganiserInviteRequest,
  RespondOrganiserInviteResult,
  SyncOrganiserInvitesResult,
} from '@shared/contracts/events'
import type {
  ListNotificationsRequest,
  MarkNotificationsReadResult,
  Notification,
} from '@shared/contracts/notifications'
import type {
  EvaluateRewardsResult,
  RewardProgress,
  RewardProgressOverview,
  RewardSnackbarItem,
} from '@shared/contracts/rewards'
import type {
  AccountClosureRequest,
  ConnectionSummary,
  CreateSupportReportRequest,
  SupportReportReceipt,
  NotificationPreferences,
  UpdateCurrentUserRequest,
  User,
} from '@shared/contracts/users'
import type { Paginated } from '@shared/contracts/common'
import { toUser, type UserRow } from './api-records'
import {
  type ApiDataResult,
  createPage,
  createQueryScope,
  dataFailure,
  dataSuccess,
  resolvePageWindow,
} from './api-pagination'

const USER_SELECT = 'id, name, phone, email, avatar_url, country_code, preferred_currency, token_balance, trust_level, trust_score, profile_completed, onboarding_completed, notifications_enabled, notification_preferences, privacy_accepted_at, privacy_version, marketing_consent, marketing_consent_at, marketing_email_enabled, marketing_sms_enabled, data_processing_consent, data_processing_consent_at, is_flagged, is_banned, last_active_at, created_at, updated_at'
const NOTIFICATION_SELECT = 'id, user_id, fund_id, type, title, body, data, is_read, read_at, delivered_at, opened_at, clicked_at, response_action, created_at'
const ACCOUNT_CLOSURE_SELECT = 'id, ticket_number, status, created_at'
const ACTIVE_ACCOUNT_CLOSURE_STATUSES = ['open', 'pending', 'in_progress'] as const
const SUPPORT_REPORT_SELECT = 'id, ticket_number, status, created_at'

const SUPPORT_REPORT_SUBJECTS: Record<CreateSupportReportRequest['category'], string> = {
  sign_in: 'Sign-in issue',
  fund_or_event: 'Fund or event issue',
  contribution_or_expense: 'Contribution or expense issue',
  report_or_export: 'Report or export issue',
  notifications: 'Notification issue',
  technical: 'Technical issue',
  suggestion: 'Product suggestion',
  other: 'Other app issue',
}

function accountClosureRequestFromRow(row: Record<string, unknown>): AccountClosureRequest {
  return {
    id: row.id as string,
    ticket_number: row.ticket_number as string,
    status: row.status as AccountClosureRequest['status'],
    created_at: row.created_at as string,
  }
}

function supportReportReceiptFromRow(row: Record<string, unknown>): SupportReportReceipt {
  return {
    id: row.id as string,
    ticket_number: row.ticket_number as string,
    status: 'open',
    created_at: row.created_at as string,
  }
}

function values<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function notificationFromRow(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    fund_id: row.fund_id as string | null,
    type: row.type as string,
    title: row.title as string,
    body: row.body as string,
    data: (row.data ?? null) as Notification['data'],
    is_read: Boolean(row.is_read),
    read_at: row.read_at as string | null,
    delivered_at: row.delivered_at as string | null,
    opened_at: row.opened_at as string | null,
    clicked_at: row.clicked_at as string | null,
    response_action: row.response_action as string | null,
    created_at: row.created_at as string,
  }
}

export async function getApiCurrentUser(
  client: SupabaseClient,
  actorUserId: string,
): Promise<ApiDataResult<User | null>> {
  const { data, error } = await client
    .from('users')
    .select(USER_SELECT)
    .eq('id', actorUserId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(data ? toUser(data as UserRow) : null)
}

export async function updateApiCurrentUser(
  client: SupabaseClient,
  actorUserId: string,
  request: UpdateCurrentUserRequest,
): Promise<ApiDataResult<User | null>> {
  const patch: Record<string, string | boolean | NotificationPreferences | null> = {}
  const paymentFields = new Set(['mobile_money_provider', 'mobile_money_number', 'mobile_money_name', 'bank_name', 'bank_account_number', 'bank_account_name', 'bank_branch_code'])
  const consentFields = new Set(['terms_version', 'privacy_version', 'marketing_consent', 'marketing_email_enabled', 'marketing_sms_enabled', 'marketing_push_enabled', 'data_processing_consent'])
  const paymentDetails: Record<string, unknown> = {}
  const consents: Record<string, unknown> = {}
  for (const [field, rawValue] of Object.entries(request)) {
    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue
    // Acceptance timestamps are never accepted from the client. The database
    // stamps and audits consent in record_own_consents.
    if (field.endsWith('_accepted_at') || field.endsWith('_consent_at')) continue
    if (paymentFields.has(field)) paymentDetails[field] = value
    else if (consentFields.has(field)) consents[field] = value
    else patch[field] = value as string | boolean | NotificationPreferences | null
  }

  if (Object.keys(paymentDetails).length) {
    const { error } = await client.rpc('update_own_payment_details', { p_details: paymentDetails })
    if (error) return dataFailure({ kind: 'database', error })
  }
  if (Object.keys(consents).length) {
    const { error } = await client.rpc('record_own_consents', { p_consents: consents })
    if (error) return dataFailure({ kind: 'database', error })
  }

  if (Object.keys(patch).length) {
    const { error } = await client.from('users').update(patch).eq('id', actorUserId).is('deleted_at', null)
    if (error) return dataFailure({ kind: 'database', error })
  }

  const { data, error } = await client.from('users').select(USER_SELECT).eq('id', actorUserId).is('deleted_at', null).maybeSingle()

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(data ? toUser(data as UserRow) : null)
}

export async function getApiAccountClosureRequest(
  client: SupabaseClient,
  actorUserId: string,
): Promise<ApiDataResult<AccountClosureRequest | null>> {
  const { data, error } = await client
    .from('support_tickets')
    .select(ACCOUNT_CLOSURE_SELECT)
    .eq('user_id', actorUserId)
    .eq('category', 'account_closure')
    .in('status', [...ACTIVE_ACCOUNT_CLOSURE_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(data ? accountClosureRequestFromRow(data) : null)
}

export async function requestApiAccountClosure(
  client: SupabaseClient,
  actorUserId: string,
): Promise<ApiDataResult<AccountClosureRequest>> {
  const existing = await getApiAccountClosureRequest(client, actorUserId)
  if (existing.error) return existing
  if (existing.data) return dataSuccess(existing.data)

  const { data, error } = await client
    .from('support_tickets')
    .insert({
      user_id: actorUserId,
      category: 'account_closure',
      subject: 'Account closure request',
      description: 'Authenticated user requested account closure from the Tshelo Security screen. Confirm ownership and review shared fund, event, financial, audit, and legal-retention obligations before processing.',
      priority: 'normal',
      status: 'open',
    })
    .select(ACCOUNT_CLOSURE_SELECT)
    .single()

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(accountClosureRequestFromRow(data))
}

/**
 * Stores a member's app feedback as an authenticated support ticket. The
 * subject, reporter identity, priority, and technical context are owned by
 * the server so the mobile client cannot impersonate another reporter.
 */
export async function createApiSupportReport(
  client: SupabaseClient,
  actorUserId: string,
  request: CreateSupportReportRequest,
): Promise<ApiDataResult<SupportReportReceipt>> {
  const context = request.platform ? `\n\n---\nSubmitted from Tshelo app · Platform: ${request.platform}` : ''
  const { data, error } = await client
    .from('support_tickets')
    .insert({
      user_id: actorUserId,
      category: request.category,
      subject: SUPPORT_REPORT_SUBJECTS[request.category],
      description: `${request.description.trim()}${context}`,
      priority: request.category === 'suggestion' ? 'low' : 'normal',
      status: 'open',
    })
    .select(SUPPORT_REPORT_SELECT)
    .single()

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(supportReportReceiptFromRow(data))
}

export async function searchApiConnections(
  client: SupabaseClient,
  query: string,
): Promise<ApiDataResult<ConnectionSummary[]>> {
  const { data, error } = await client.rpc('search_my_connections', { p_query: query })
  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess((data ?? []).map((row: Record<string, unknown>) => ({
    user_id: row.user_id as string,
    name: row.name as string,
    phone: row.phone as string,
  })))
}

export async function listApiNotifications(
  client: SupabaseClient,
  actorUserId: string,
  request: ListNotificationsRequest,
): Promise<ApiDataResult<Paginated<Notification>>> {
  if (request.sort_by && request.sort_by !== 'created_at') {
    return dataFailure({ kind: 'validation', message: `Unsupported sort field: ${request.sort_by}.` })
  }
  const scopeRequest = { ...request }
  delete scopeRequest.cursor
  delete scopeRequest.limit
  const scope = createQueryScope('notifications', scopeRequest)
  const pageWindow = resolvePageWindow(request, scope)
  if (pageWindow.error) return pageWindow

  const ascending = (request.sort_direction ?? 'desc') === 'asc'
  let query = client
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', actorUserId)

  const types = values(request.type)
  if (types.length) query = query.in('type', types)
  if (request.unread_only) query = query.eq('is_read', false)

  const { data, error } = await query
    .order('created_at', { ascending })
    .order('id', { ascending })
    .range(pageWindow.data.offset, pageWindow.data.offset + pageWindow.data.limit)

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(createPage(
    (data ?? []) as Record<string, unknown>[],
    pageWindow.data,
    notificationFromRow,
  ))
}

export async function getApiNotification(
  client: SupabaseClient,
  actorUserId: string,
  notificationId: string,
): Promise<ApiDataResult<Notification | null>> {
  const { data, error } = await client
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('id', notificationId)
    .eq('user_id', actorUserId)
    .maybeSingle()

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess(data ? notificationFromRow(data) : null)
}

export async function markApiNotificationsRead(
  client: SupabaseClient,
  actorUserId: string,
  notificationIds: string[],
): Promise<ApiDataResult<MarkNotificationsReadResult>> {
  const { data, error } = await client
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', actorUserId)
    .in('id', notificationIds)
    .select('id')

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess({ updated_ids: (data ?? []).map(row => row.id as string) })
}

export async function syncApiOrganiserInvites(
  client: SupabaseClient,
): Promise<ApiDataResult<SyncOrganiserInvitesResult>> {
  const { data, error } = await client.rpc('sync_my_event_fund_organiser_invites')
  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess({ synced_count: Number(data ?? 0) })
}

export async function respondApiOrganiserInvite(
  client: SupabaseClient,
  request: RespondOrganiserInviteRequest,
): Promise<ApiDataResult<RespondOrganiserInviteResult>> {
  const { data, error } = await client
    .rpc('respond_to_event_fund_organiser_invite', {
      p_invite_id: request.invite_id,
      p_accept: request.accepted,
    })
    .single()

  if (error) return dataFailure({ kind: 'database', error })
  const row = data as Record<string, unknown>
  return dataSuccess({
    event_id: row.event_id as string,
    fund_id: row.fund_id as string,
    accepted: Boolean(row.accepted),
  })
}

export async function evaluateApiRewards(
  client: SupabaseClient,
): Promise<ApiDataResult<EvaluateRewardsResult>> {
  const { data, error } = await client.rpc('evaluate_my_rewards')
  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess({ reward_count: Number(data ?? 0) })
}

export async function getApiRewardProgress(
  client: SupabaseClient,
  actorUserId: string,
): Promise<ApiDataResult<RewardProgressOverview>> {
  const [progressResult, trustResult] = await Promise.all([
    client.rpc('get_my_reward_progress'),
    client
      .from('users')
      .select('trust_score, trust_level')
      .eq('id', actorUserId)
      .maybeSingle(),
  ])
  if (progressResult.error) return dataFailure({ kind: 'database', error: progressResult.error })
  if (trustResult.error) return dataFailure({ kind: 'database', error: trustResult.error })

  const rewards: RewardProgress[] = (progressResult.data ?? []).map((row: Record<string, unknown>) => ({
    reward_code: row.reward_code as string,
    name: row.reward_name as string,
    description: row.reward_description as string,
    category: row.category as string,
    trust_points_reward: Number(row.trust_points_reward ?? 0),
    threshold: Number(row.threshold ?? 0),
    unit: row.progress_unit as string,
    icon: row.icon_name as string | null,
    current: Number(row.current_progress ?? 0),
    is_earned: Boolean(row.is_earned),
    earned_at: row.earned_at as string | null,
  }))
  return dataSuccess({
    rewards,
    trust: {
      trust_score: Number(trustResult.data?.trust_score ?? 0),
      trust_level: String(trustResult.data?.trust_level ?? 'new'),
    },
  })
}

export async function listApiUnseenRewards(
  client: SupabaseClient,
  actorUserId: string,
): Promise<ApiDataResult<RewardSnackbarItem[]>> {
  const { data, error } = await client
    .from('user_rewards')
    .select('id, reward_code, trust_points_awarded, earned_at, reward_definitions!inner(name, description, category, icon_name)')
    .eq('user_id', actorUserId)
    .is('snackbar_seen_at', null)
    .order('earned_at', { ascending: true })

  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess((data ?? []).flatMap(row => {
    const joined = Array.isArray(row.reward_definitions)
      ? row.reward_definitions[0]
      : row.reward_definitions
    if (!joined) return []
    return [{
      user_reward_id: row.id as string,
      reward_code: row.reward_code as string,
      name: joined.name as string,
      description: joined.description as string,
      category: joined.category as string,
      icon: joined.icon_name as string | null,
      trust_points_awarded: Number(row.trust_points_awarded ?? 0),
      earned_at: row.earned_at as string,
    }]
  }))
}

export async function markApiRewardSeen(
  client: SupabaseClient,
  rewardId: string,
): Promise<ApiDataResult<Record<string, never>>> {
  const { error } = await client.rpc('mark_reward_snackbar_seen', { p_reward_id: rewardId })
  if (error) return dataFailure({ kind: 'database', error })
  return dataSuccess({})
}
