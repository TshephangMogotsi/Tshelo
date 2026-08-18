import 'server-only'

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  ConfigureFundAdminRequest,
  CreateFundSponsorshipRequest,
  Fund,
  FundActivityDetail,
  FundActivityEntry,
  FundAdminPermissionRow,
  FundInvitePreview,
  FundMemberDetails,
  FundMemberDirectoryItem,
  FundPermission,
  FundSponsorshipItem,
  FundWorkspace,
  HomeSummary,
  JoinFundResult,
  LeaveFundResult,
  ListFundActivityRequest,
  UpdateFundMemberRequest,
  UpdateFundRequest,
  UpdateFundSponsorshipRequest,
} from '@shared/contracts/funds'
import type { CurrencyCode, JsonValue, Paginated } from '@shared/contracts/common'
import { FUND_PERMISSION_KEYS } from '@shared/contracts/funds'
import { type FundRow, toFund } from './api-records'
import {
  type ApiDataResult,
  createPage,
  createQueryScope,
  dataFailure,
  dataSuccess,
  resolvePageWindow,
} from './api-pagination'
import { getApiFund } from './api-queries'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FUND_SELECT = 'id, owner_id, title, description, fund_code, fund_type, fund_emoji, type_specific_data, currency_code, goal_amount, event_date, event_time, event_location, attendees, contribution_deadline, auto_close_date, cover_photo_url, share_code, show_leaderboard, status, linked_event_id, is_private, closed_at, created_at, updated_at'

function validUuid(value: string) {
  return UUID_PATTERN.test(value)
}

function minorUnits(value: unknown) {
  const normalized = String(value ?? '0').trim()
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return BigInt(0)
  const absolute = BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? '').padEnd(2, '0'))
  return match[1] === '-' ? -absolute : absolute
}

function money(value: unknown) {
  const units = typeof value === 'bigint' ? value : minorUnits(value)
  const absolute = units < BigInt(0) ? -units : units
  return `${units < BigInt(0) ? '-' : ''}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`
}

function sumMoney(values: unknown[]) {
  return money(values.reduce<bigint>((sum, value) => sum + minorUnits(value), BigInt(0)))
}

function label(value: unknown) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

function asJsonRecord(value: unknown): Record<string, JsonValue> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, JsonValue>
}

type MemberProfile = { member_row_id: string; user_id: string; name: string; phone: string }

async function loadMemberDirectory(client: SupabaseClient, fundId: string) {
  const [membersResult, profilesResult, awardsResult] = await Promise.all([
    client
      .from('fund_members')
      .select('id, user_id, invited_name, invited_phone, role, status, joined_at, invited_at, created_at')
      .eq('fund_id', fundId)
      .in('status', ['joined', 'pending'])
      .order('created_at', { ascending: true }),
    client.rpc('get_fund_member_profiles', { p_fund_id: fundId }),
    client.from('rich_auntie_awards').select('recipient_user_id').eq('fund_id', fundId),
  ])

  if (membersResult.error) return { data: null, error: membersResult.error }
  if (profilesResult.error) return { data: null, error: profilesResult.error }
  if (awardsResult.error) return { data: null, error: awardsResult.error }

  const profiles = (profilesResult.data ?? []) as MemberProfile[]
  const profileByMemberId = new Map(profiles.map(profile => [profile.member_row_id, profile]))
  const awardedUserIds = new Set((awardsResult.data ?? []).map(row => row.recipient_user_id as string))
  const rows = (membersResult.data ?? []).map(row => {
    const profile = profileByMemberId.get(row.id as string)
    const userId = (row.user_id ?? profile?.user_id ?? null) as string | null
    return {
      id: row.id as string,
      user_id: userId,
      display_name: profile?.name ?? (row.invited_name as string | null) ?? 'Unknown',
      phone: profile?.phone ?? (row.invited_phone as string | null) ?? null,
      role: row.role as FundMemberDirectoryItem['role'],
      status: row.status as FundMemberDirectoryItem['status'],
      joined_at: row.joined_at as string | null,
      requested_at: (row.invited_at ?? row.created_at) as string | null,
      is_rich_auntie: Boolean(userId && awardedUserIds.has(userId)),
    } satisfies FundMemberDirectoryItem
  })
  return { data: rows, error: null }
}

async function sponsorshipRows(client: SupabaseClient, fundId: string) {
  const [itemsResult, profilesResult] = await Promise.all([
    client
      .from('fund_sponsorship_item_progress')
      .select('id, fund_id, title, description, category, target_amount, allocated_amount, outstanding_amount, status, claimed_by_user_id, claimed_at, funded_at, fulfilled_at, linked_expense_id, created_at')
      .eq('fund_id', fundId)
      .order('created_at', { ascending: true }),
    client.rpc('get_fund_member_profiles', { p_fund_id: fundId }),
  ])
  if (itemsResult.error) return { data: null, error: itemsResult.error }
  if (profilesResult.error) return { data: null, error: profilesResult.error }
  const nameByUserId = new Map(
    ((profilesResult.data ?? []) as MemberProfile[]).map(profile => [profile.user_id, profile.name]),
  )
  return {
    data: (itemsResult.data ?? []).map(row => ({
      id: row.id as string,
      fund_id: row.fund_id as string,
      title: row.title as string,
      description: row.description as string | null,
      category: row.category as string | null,
      target_amount: money(row.target_amount),
      allocated_amount: money(row.allocated_amount),
      outstanding_amount: money(row.outstanding_amount),
      status: row.status as FundSponsorshipItem['status'],
      claimed_by_user_id: row.claimed_by_user_id as string | null,
      sponsor_name: row.claimed_by_user_id
        ? nameByUserId.get(row.claimed_by_user_id as string) ?? null
        : null,
      claimed_at: row.claimed_at as string | null,
      funded_at: row.funded_at as string | null,
      fulfilled_at: row.fulfilled_at as string | null,
      linked_expense_id: row.linked_expense_id as string | null,
      created_at: row.created_at as string,
    } satisfies FundSponsorshipItem)),
    error: null,
  }
}

export async function updateApiFund(
  client: SupabaseClient,
  fundId: string,
  input: UpdateFundRequest,
): Promise<ApiDataResult<Fund | null>> {
  if (!validUuid(fundId)) return dataFailure({ kind: 'validation', message: 'fund_id must be a valid UUID.' })
  const changes: Record<string, unknown> = { ...input }
  if (input.status === 'closed') changes.closed_at = new Date().toISOString()
  else if (input.status) changes.closed_at = null
  const result = await client.from('funds').update(changes).eq('id', fundId).is('deleted_at', null).select(FUND_SELECT).maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ? toFund(result.data as FundRow) : null)
}

export async function deleteApiFund(client: SupabaseClient, fundId: string) {
  if (!validUuid(fundId)) return dataFailure({ kind: 'validation', message: 'fund_id must be a valid UUID.' })
  const result = await client.from('funds').update({ deleted_at: new Date().toISOString() }).eq('id', fundId).is('deleted_at', null).select('id').maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ? {} : null)
}

export async function previewApiFundInvite(
  client: SupabaseClient,
  actorUserId: string,
  code: string,
): Promise<ApiDataResult<FundInvitePreview | null>> {
  const normalized = code.trim().toUpperCase()
  if (!normalized || normalized.length > 32) return dataFailure({ kind: 'validation', message: 'code is invalid.' })
  const fundResult = await client.rpc('find_fund_by_code', { p_code: normalized })
  if (fundResult.error) return dataFailure({ kind: 'database', error: fundResult.error })
  const row = (fundResult.data ?? [])[0]
  if (!row) return dataSuccess(null)
  const [membershipResult, countResult, privacyResult] = await Promise.all([
    client.from('fund_members').select('status').eq('fund_id', row.id).eq('user_id', actorUserId).maybeSingle(),
    client.from('fund_members').select('*', { count: 'exact', head: true }).eq('fund_id', row.id).eq('status', 'joined'),
    client.rpc('get_fund_privacy', { p_fund_id: row.id }),
  ])
  if (membershipResult.error) return dataFailure({ kind: 'database', error: membershipResult.error })
  if (countResult.error) return dataFailure({ kind: 'database', error: countResult.error })
  if (privacyResult.error) return dataFailure({ kind: 'database', error: privacyResult.error })
  return dataSuccess({
    fund_id: row.id as string,
    title: row.title as string,
    organiser_name: (row.organiser_name as string | null) ?? 'Fund organiser',
    goal_amount: money(row.goal_amount),
    currency_code: (row.currency_code ?? 'BWP') as FundInvitePreview['currency_code'],
    status: row.status as FundInvitePreview['status'],
    member_count: Math.max(1, countResult.count ?? 0),
    is_private: Boolean(privacyResult.data),
    existing_membership_status: (membershipResult.data?.status ?? null) as FundInvitePreview['existing_membership_status'],
  })
}

export async function joinApiFund(client: SupabaseClient, code: string): Promise<ApiDataResult<JoinFundResult>> {
  const result = await client.rpc('join_fund_by_code', { p_code: code.trim().toUpperCase() })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  const row = (result.data ?? [])[0]
  if (!row) return dataFailure({ kind: 'validation', message: 'The fund could not be joined.' })
  return dataSuccess({ fund_id: row.fund_id, membership_status: row.membership_status, is_private: row.is_private })
}

export async function leaveApiFund(client: SupabaseClient, fundId: string): Promise<ApiDataResult<LeaveFundResult>> {
  const result = await client.rpc('leave_fund', { p_fund_id: fundId })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  const row = (result.data ?? [])[0]
  if (!row) return dataFailure({ kind: 'validation', message: 'The fund could not be left.' })
  return dataSuccess({ fund_id: row.fund_id, membership_status: row.membership_status })
}

export async function listApiFundMembers(client: SupabaseClient, fundId: string): Promise<ApiDataResult<FundMemberDirectoryItem[]>> {
  const result = await loadMemberDirectory(client, fundId)
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ?? [])
}

export async function getApiFundMember(
  client: SupabaseClient,
  fundId: string,
  memberId: string,
): Promise<ApiDataResult<FundMemberDetails | null>> {
  const directory = await loadMemberDirectory(client, fundId)
  if (directory.error) return dataFailure({ kind: 'database', error: directory.error })
  const member = directory.data?.find(item => item.id === memberId || item.user_id === memberId)
  if (!member) return dataSuccess(null)
  if (!member.user_id) return dataSuccess({ member, confirmed_total: '0.00', pledged_total: '0.00', awards: [], sponsored_items: [] })
  const [contributions, awards, sponsorships] = await Promise.all([
    client.from('contributions').select('amount, pledged_amount, status, is_refunded').eq('fund_id', fundId).eq('user_id', member.user_id),
    client.from('rich_auntie_awards').select('id, reason_label, created_at').eq('fund_id', fundId).eq('recipient_user_id', member.user_id).order('created_at', { ascending: false }),
    client.from('fund_sponsorship_item_progress').select('title, status').eq('fund_id', fundId).eq('claimed_by_user_id', member.user_id).in('status', ['claimed', 'funded', 'fulfilled']),
  ])
  if (contributions.error) return dataFailure({ kind: 'database', error: contributions.error })
  if (awards.error) return dataFailure({ kind: 'database', error: awards.error })
  if (sponsorships.error) return dataFailure({ kind: 'database', error: sponsorships.error })
  const confirmed = (contributions.data ?? []).filter(row => row.status === 'confirmed' && !row.is_refunded)
  const pledged = (contributions.data ?? []).filter(row => row.status === 'pledged')
  return dataSuccess({
    member,
    confirmed_total: sumMoney(confirmed.map(row => row.amount)),
    pledged_total: sumMoney(pledged.map(row => row.pledged_amount ?? row.amount)),
    awards: (awards.data ?? []).map(row => ({ id: row.id as string, reason_label: row.reason_label as string, created_at: row.created_at as string })),
    sponsored_items: (sponsorships.data ?? []).map(row => ({ title: row.title as string, status: row.status as string })),
  })
}

export async function updateApiFundMember(client: SupabaseClient, fundId: string, memberId: string, input: UpdateFundMemberRequest) {
  const changes: Record<string, unknown> = { status: input.status }
  if (input.status === 'joined') changes.joined_at = new Date().toISOString()
  const result = await client.from('fund_members').update(changes).eq('fund_id', fundId).eq('id', memberId).select('id').maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ? {} : null)
}

export async function getApiFundPermissions(client: SupabaseClient, fundId: string): Promise<ApiDataResult<FundPermission[]>> {
  const result = await client.rpc('get_my_fund_permissions', { p_fund_id: fundId })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  const allowed = new Set<string>(FUND_PERMISSION_KEYS)
  return dataSuccess((result.data ?? [])
    .map((row: { permission_key: string }) => row.permission_key)
    .filter((key: string): key is FundPermission => allowed.has(key)))
}

export async function listApiFundAdminPermissions(client: SupabaseClient, fundId: string): Promise<ApiDataResult<FundAdminPermissionRow[]>> {
  const result = await client.rpc('get_fund_admin_permissions', { p_fund_id: fundId })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess((result.data ?? []) as FundAdminPermissionRow[])
}

export async function configureApiFundAdmin(client: SupabaseClient, fundId: string, memberId: string, input: ConfigureFundAdminRequest) {
  const membership = await client.from('fund_members').select('id').eq('fund_id', fundId).eq('id', memberId).maybeSingle()
  if (membership.error) return dataFailure({ kind: 'database', error: membership.error })
  if (!membership.data) return dataSuccess(null)
  const result = await client.rpc('configure_fund_admin', { p_member_id: memberId, p_permissions: input.permissions })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({})
}

export async function removeApiFundAdmin(client: SupabaseClient, fundId: string, memberId: string) {
  const membership = await client.from('fund_members').select('id').eq('fund_id', fundId).eq('id', memberId).maybeSingle()
  if (membership.error) return dataFailure({ kind: 'database', error: membership.error })
  if (!membership.data) return dataSuccess(null)
  const result = await client.rpc('remove_fund_admin', { p_member_id: memberId })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({})
}

export async function listApiFundSponsorships(client: SupabaseClient, fundId: string): Promise<ApiDataResult<FundSponsorshipItem[]>> {
  const result = await sponsorshipRows(client, fundId)
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ?? [])
}

export async function createApiFundSponsorship(client: SupabaseClient, actorUserId: string, fundId: string, input: CreateFundSponsorshipRequest) {
  const result = await client.from('fund_sponsorship_items').insert({ ...input, fund_id: fundId, created_by: actorUserId }).select('id').single()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  const rows = await sponsorshipRows(client, fundId)
  if (rows.error) return dataFailure({ kind: 'database', error: rows.error })
  return dataSuccess(rows.data?.find(item => item.id === result.data.id) ?? null)
}

export async function updateApiFundSponsorship(client: SupabaseClient, fundId: string, itemId: string, input: UpdateFundSponsorshipRequest) {
  const result = await client.from('fund_sponsorship_items').update(input).eq('fund_id', fundId).eq('id', itemId).select('id').maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  if (!result.data) return dataSuccess(null)
  const rows = await sponsorshipRows(client, fundId)
  if (rows.error) return dataFailure({ kind: 'database', error: rows.error })
  return dataSuccess(rows.data?.find(item => item.id === itemId) ?? null)
}

export async function claimApiFundSponsorship(client: SupabaseClient, fundId: string, itemId: string) {
  const existing = await client.from('fund_sponsorship_item_progress').select('id').eq('fund_id', fundId).eq('id', itemId).maybeSingle()
  if (existing.error) return dataFailure({ kind: 'database', error: existing.error })
  if (!existing.data) return dataSuccess(null)
  const result = await client.rpc('claim_sponsorship_item', { p_item_id: itemId })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  const rows = await sponsorshipRows(client, fundId)
  if (rows.error) return dataFailure({ kind: 'database', error: rows.error })
  return dataSuccess(rows.data?.find(item => item.id === itemId) ?? null)
}

export async function releaseApiFundSponsorship(client: SupabaseClient, fundId: string, itemId: string) {
  const existing = await client.from('fund_sponsorship_item_progress').select('id').eq('fund_id', fundId).eq('id', itemId).maybeSingle()
  if (existing.error) return dataFailure({ kind: 'database', error: existing.error })
  if (!existing.data) return dataSuccess(null)
  const result = await client.rpc('release_sponsorship_item', { p_item_id: itemId })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  const rows = await sponsorshipRows(client, fundId)
  if (rows.error) return dataFailure({ kind: 'database', error: rows.error })
  return dataSuccess(rows.data?.find(item => item.id === itemId) ?? null)
}

export async function getApiFundWorkspace(client: SupabaseClient, actorUserId: string, fundId: string): Promise<ApiDataResult<FundWorkspace | null>> {
  const fundResult = await getApiFund(client, actorUserId, fundId)
  if (fundResult.error || !fundResult.data) return fundResult as ApiDataResult<FundWorkspace | null>
  const [contributions, expenses, members, pledges, contributors, sponsorships, permissions] = await Promise.all([
    client.from('contributions').select('id, contributor_id, contributor_name, amount, pledged_amount, payment_method, reference_number, detected_via, status, is_refunded, confirmed_at, created_at, notes').eq('fund_id', fundId).order('created_at', { ascending: false }),
    client.from('expenses').select('id, vendor_name, description, category, amount, created_at, has_open_query, is_sponsored, sponsored_by_user_id, sponsored_by_name').eq('fund_id', fundId).is('deleted_at', null).order('created_at', { ascending: false }),
    loadMemberDirectory(client, fundId),
    client.from('contributor_pledge_balances').select('pledge_id, allocated_amount, outstanding_amount, pledge_state').eq('fund_id', fundId),
    client.from('fund_contributors').select('id, contributor_type').eq('fund_id', fundId),
    sponsorshipRows(client, fundId),
    client.rpc('get_my_fund_permissions', { p_fund_id: fundId }),
  ])
  for (const result of [contributions, expenses, members, pledges, contributors, sponsorships, permissions]) {
    if (result.error) return dataFailure({ kind: 'database', error: result.error })
  }
  const pledgeById = new Map((pledges.data ?? []).map(row => [row.pledge_id as string, row]))
  const contributorTypeById = new Map((contributors.data ?? []).map(row => [row.id as string, row.contributor_type]))
  const allowed = new Set<string>(FUND_PERMISSION_KEYS)
  return dataSuccess({
    fund: fundResult.data,
    contributions: (contributions.data ?? []).map(row => {
      const pledge = pledgeById.get(row.id as string)
      return {
        id: row.id as string,
        contributor_id: row.contributor_id as string,
        contributor_name: row.contributor_name as string,
        contributor_type: (contributorTypeById.get(row.contributor_id as string) ?? 'guest') as 'member' | 'guest',
        amount: money(row.amount), pledged_amount: row.pledged_amount === null ? null : money(row.pledged_amount),
        allocated_amount: money(pledge?.allocated_amount), outstanding_amount: pledge ? money(pledge.outstanding_amount) : null,
        pledge_state: (pledge?.pledge_state ?? null) as FundWorkspace['contributions'][number]['pledge_state'],
        payment_method: row.payment_method as string | null, reference_number: row.reference_number as string | null,
        detected_via: row.detected_via as string, status: row.status as string, is_refunded: Boolean(row.is_refunded),
        confirmed_at: row.confirmed_at as string | null, created_at: row.created_at as string, notes: row.notes as string | null,
      }
    }),
    expenses: (expenses.data ?? []).map(row => ({
      id: row.id as string, vendor_name: row.vendor_name as string | null, description: row.description as string,
      category: row.category as string | null, amount: money(row.amount), created_at: row.created_at as string,
      notes: null, has_open_query: Boolean(row.has_open_query), is_sponsored: Boolean(row.is_sponsored),
      sponsored_by_user_id: row.sponsored_by_user_id as string | null, sponsored_by_name: row.sponsored_by_name as string | null,
    })),
    members: members.data ?? [], sponsorship_items: sponsorships.data ?? [],
    permissions: (permissions.data ?? [])
      .map((row: { permission_key: string }) => row.permission_key)
      .filter((key: string): key is FundPermission => allowed.has(key)),
  })
}

export async function listApiFundActivity(client: SupabaseClient, fundId: string, input: ListFundActivityRequest): Promise<ApiDataResult<Paginated<FundActivityEntry>>> {
  const criteria = { entity_type: input.entity_type, edits_only: input.edits_only }
  const window = resolvePageWindow(input, createQueryScope(`fund-activity:${fundId}`, criteria))
  if (window.error) return window
  let query = client.from('audit_log').select('id, entity_id, user_id, action, entity_type, old_values, new_values, created_at').eq('fund_id', fundId)
  if (input.entity_type) query = query.eq('entity_type', input.entity_type)
  if (input.edits_only) query = query.eq('action', 'updated')
  const result = await query.order('created_at', { ascending: false }).range(window.data.offset, window.data.offset + window.data.limit)
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(createPage(result.data ?? [], window.data, row => ({
    id: row.id as string, entity_id: row.entity_id as string, user_id: row.user_id as string | null,
    action: row.action as string, entity_type: row.entity_type as string,
    old_values: asJsonRecord(row.old_values), new_values: asJsonRecord(row.new_values), created_at: row.created_at as string,
  })))
}

export async function getApiFundActivityDetail(client: SupabaseClient, fundId: string, entryId: string): Promise<ApiDataResult<FundActivityDetail | null>> {
  const entryResult = await client.from('audit_log').select('id, entity_id, user_id, action, entity_type, old_values, new_values, created_at').eq('fund_id', fundId).eq('id', entryId).maybeSingle()
  if (entryResult.error) return dataFailure({ kind: 'database', error: entryResult.error })
  if (!entryResult.data) return dataSuccess(null)
  const row = entryResult.data
  let current: { data: unknown; error: PostgrestError | null } = { data: null, error: null }
  if (row.entity_type === 'contribution') current = await client.from('contributions').select('contributor_name, amount, pledged_amount, payment_method, reference_number, receipt_number, status, is_refunded, notes').eq('id', row.entity_id).maybeSingle()
  if (row.entity_type === 'expense') current = await client.from('expenses').select('description, vendor_name, amount, category, receipt_url').eq('id', row.entity_id).maybeSingle()
  if (current.error) return dataFailure({ kind: 'database', error: current.error })
  return dataSuccess({
    entry: { id: row.id as string, entity_id: row.entity_id as string, user_id: row.user_id as string | null, action: row.action as string, entity_type: row.entity_type as string, old_values: asJsonRecord(row.old_values), new_values: asJsonRecord(row.new_values), created_at: row.created_at as string },
    current_record: asJsonRecord(current.data),
  })
}

export async function getApiHomeSummary(client: SupabaseClient, actorUserId: string): Promise<ApiDataResult<HomeSummary>> {
  const [memberships, ownedFunds, organisers, guestRoles, unread] = await Promise.all([
    client.from('fund_members').select('fund_id, role').eq('user_id', actorUserId).not('status', 'in', '(left,removed,declined,pending)'),
    client.from('funds').select('id').eq('owner_id', actorUserId).is('deleted_at', null),
    client.from('event_organisers').select('event_id').eq('user_id', actorUserId).not('status', 'in', '(left,removed)'),
    client.from('event_guests').select('event_id').eq('user_id', actorUserId),
    client.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', actorUserId).eq('is_read', false),
  ])
  for (const result of [memberships, ownedFunds, organisers, guestRoles, unread]) if (result.error) return dataFailure({ kind: 'database', error: result.error })
  const memberFundIds = new Set((memberships.data ?? []).map(row => row.fund_id as string))
  const ownedFundIds = new Set((ownedFunds.data ?? []).map(row => row.id as string))
  const fundIds = [...new Set([...memberFundIds, ...ownedFundIds])]
  const roleByFund = new Map((memberships.data ?? []).map(row => [row.fund_id as string, row.role as 'owner' | 'admin' | 'member']))
  ownedFundIds.forEach(id => { if (!roleByFund.has(id)) roleByFund.set(id, 'owner') })
  const coOrgIds = (organisers.data ?? []).map(row => row.event_id as string)
  const relatedEventIds = [...new Set([...coOrgIds, ...(guestRoles.data ?? []).map(row => row.event_id as string)])]
  const eventFilter = relatedEventIds.length ? `creator_id.eq.${actorUserId},id.in.(${relatedEventIds.join(',')})` : `creator_id.eq.${actorUserId}`
  const [funds, events, links] = await Promise.all([
    fundIds.length ? client.from('funds').select('id, title, status, goal_amount, currency_code, fund_type, fund_emoji, linked_event_id, created_at').in('id', fundIds).is('deleted_at', null).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    client.from('events').select('id, creator_id, name, status, event_type, event_emoji, event_date, venue_name, linked_fund_id, created_at').or(eventFilter).is('deleted_at', null).order('created_at', { ascending: false }),
    client.from('event_fund_links').select('event_id, fund_id').eq('is_active', true),
  ])
  if (funds.error) return dataFailure({ kind: 'database', error: funds.error })
  if (events.error) return dataFailure({ kind: 'database', error: events.error })
  if (links.error) return dataFailure({ kind: 'database', error: links.error })
  const visibleFundIds = (funds.data ?? []).map(row => row.id as string)
  const visibleEventIds = (events.data ?? []).map(row => row.id as string)
  const [contributions, expenses, memberRows, guests, budgets] = await Promise.all([
    visibleFundIds.length ? client.from('contributions').select('fund_id, amount').in('fund_id', visibleFundIds).eq('status', 'confirmed').eq('is_refunded', false) : Promise.resolve({ data: [], error: null }),
    visibleFundIds.length ? client.from('expenses').select('fund_id, amount, is_sponsored').in('fund_id', visibleFundIds).is('deleted_at', null) : Promise.resolve({ data: [], error: null }),
    visibleFundIds.length ? client.from('fund_members').select('fund_id').in('fund_id', visibleFundIds).not('status', 'in', '(left,removed,declined,pending)') : Promise.resolve({ data: [], error: null }),
    visibleEventIds.length ? client.from('event_guests').select('event_id, plus_ones').in('event_id', visibleEventIds) : Promise.resolve({ data: [], error: null }),
    visibleEventIds.length ? client.from('event_budgets').select('event_id, total_budget, currency_code').in('event_id', visibleEventIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (contributions.error) return dataFailure({ kind: 'database', error: contributions.error })
  if (expenses.error) return dataFailure({ kind: 'database', error: expenses.error })
  if (memberRows.error) return dataFailure({ kind: 'database', error: memberRows.error })
  if (guests.error) return dataFailure({ kind: 'database', error: guests.error })
  if (budgets.error) return dataFailure({ kind: 'database', error: budgets.error })
  const contributionsByFund = new Map<string, bigint>(); (contributions.data ?? []).forEach(row => contributionsByFund.set(row.fund_id as string, (contributionsByFund.get(row.fund_id as string) ?? BigInt(0)) + minorUnits(row.amount)))
  const expensesByFund = new Map<string, bigint>(); (expenses.data ?? []).filter(row => !row.is_sponsored).forEach(row => expensesByFund.set(row.fund_id as string, (expensesByFund.get(row.fund_id as string) ?? BigInt(0)) + minorUnits(row.amount)))
  const membersByFund = new Map<string, number>(); (memberRows.data ?? []).forEach(row => membersByFund.set(row.fund_id as string, (membersByFund.get(row.fund_id as string) ?? 0) + 1))
  const guestsByEvent = new Map<string, number>(); (guests.data ?? []).forEach(row => guestsByEvent.set(row.event_id as string, (guestsByEvent.get(row.event_id as string) ?? 0) + 1 + Math.max(0, Number(row.plus_ones ?? 0))))
  const budgetByEvent = new Map((budgets.data ?? []).map(row => [row.event_id as string, row]))
  const eventById = new Map((events.data ?? []).map(row => [row.id as string, row])); const linkedEventByFund = new Map<string, string>()
  ;(events.data ?? []).forEach(row => { if (row.linked_fund_id) linkedEventByFund.set(row.linked_fund_id as string, row.id as string) }); (links.data ?? []).forEach(row => linkedEventByFund.set(row.fund_id as string, row.event_id as string))
  const renderedEvents = new Set<string>()
  const fundItems = (funds.data ?? []).map(row => {
    const linkedId = (row.linked_event_id as string | null) ?? linkedEventByFund.get(row.id as string); const event = linkedId ? eventById.get(linkedId) : null
    if (event) renderedEvents.add(event.id as string)
    const kind = event ? 'eventFund' as const : 'fund' as const; const total = contributionsByFund.get(row.id as string) ?? BigInt(0); const spent = expensesByFund.get(row.id as string) ?? BigInt(0); const budget = event ? budgetByEvent.get(event.id as string) : null; const goal = minorUnits(row.goal_amount)
    return { id: kind === 'eventFund' ? `eventFund-${event!.id}-${row.id}` : row.id as string, fund_id: row.id as string, event_id: event?.id as string | undefined, kind, title: (event?.name ?? row.title) as string, status: row.status as string, goal_amount: money(goal), budget_amount: event ? budget ? money(budget.total_budget) : null : goal > BigInt(0) ? money(goal) : null, budget_currency_code: (budget?.currency_code ?? row.currency_code ?? 'BWP') as CurrencyCode, total_contributions: money(total), balance: money(total - spent), member_count: Math.max(1, membersByFund.get(row.id as string) ?? 0), guest_count: event ? guestsByEvent.get(event.id as string) ?? 0 : 0, role: roleByFund.get(row.id as string) ?? 'member', event_date: (event?.event_date ?? null) as string | null, venue_name: (event?.venue_name ?? null) as string | null, category: kind === 'eventFund' ? 'Event + Fund' : label(row.fund_type), emoji: (event?.event_emoji ?? row.fund_emoji ?? '💜') as string, currency_code: (row.currency_code ?? 'BWP') as CurrencyCode, created_at: (event?.created_at ?? row.created_at) as string }
  })
  const coOrgSet = new Set(coOrgIds)
  const eventItems = (events.data ?? []).filter(row => !renderedEvents.has(row.id as string)).map(row => { const budget = budgetByEvent.get(row.id as string); return { id: row.id as string, event_id: row.id as string, kind: 'event' as const, title: row.name as string, status: row.status as string, goal_amount: '0.00', budget_amount: null, budget_currency_code: (budget?.currency_code ?? 'BWP') as CurrencyCode, total_contributions: '0.00', balance: '0.00', member_count: 0, guest_count: guestsByEvent.get(row.id as string) ?? 0, role: row.creator_id === actorUserId || coOrgSet.has(row.id as string) ? 'organiser' as const : 'member' as const, event_date: row.event_date as string | null, venue_name: row.venue_name as string | null, category: label(row.event_type), emoji: (row.event_emoji ?? '🎉') as string, currency_code: (budget?.currency_code ?? 'BWP') as CurrencyCode, created_at: row.created_at as string } })
  return dataSuccess({ items: [...fundItems, ...eventItems], unread_notification_count: unread.count ?? 0 })
}
