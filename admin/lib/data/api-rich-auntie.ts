import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Paginated } from '@shared/contracts/common'
import type {
  CreateRichAuntieAwardRequest,
  ListRichAuntieAwardsRequest,
  RichAuntieAward,
  RichAuntieCelebration,
  RichAuntieEligibility,
  RichAuntieRecipientHistory,
} from '@shared/contracts/rich-auntie'
import {
  type ApiDataResult,
  createPage,
  createQueryScope,
  dataFailure,
  dataSuccess,
  resolvePageWindow,
} from './api-pagination'

const AWARD_SELECT = 'id, fund_id, recipient_user_id, sponsorship_item_id, reason_code, reason_label, awarded_by, notify_member, created_at'

function minorUnits(value: unknown) {
  const match = String(value ?? '0').trim().match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return BigInt(0)
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0'))
}

function money(units: bigint) {
  return `${units / BigInt(100)}.${String(units % BigInt(100)).padStart(2, '0')}`
}

type AwardRow = {
  id: string
  fund_id: string
  recipient_user_id: string
  sponsorship_item_id: string | null
  reason_code: RichAuntieAward['reason_code']
  reason_label: string
  awarded_by: string
  notify_member: boolean
  created_at: string
}

async function enrichAwards(client: SupabaseClient, rows: AwardRow[]): Promise<ApiDataResult<RichAuntieAward[]>> {
  if (!rows.length) return dataSuccess([])
  const fundIds = [...new Set(rows.map(row => row.fund_id))]
  const [funds, profileResults] = await Promise.all([
    client.from('funds').select('id, title').in('id', fundIds),
    Promise.all(fundIds.map(async fundId => ({
      fundId,
      result: await client.rpc('get_fund_member_profiles', { p_fund_id: fundId }),
    }))),
  ])
  if (funds.error) return dataFailure({ kind: 'database', error: funds.error })
  const profileError = profileResults.find(entry => entry.result.error)?.result.error
  if (profileError) return dataFailure({ kind: 'database', error: profileError })
  const fundTitles = new Map((funds.data ?? []).map(row => [row.id as string, row.title as string]))
  const userNames = new Map(profileResults.flatMap(entry => (
    (entry.result.data ?? []) as Array<{ user_id: string; name: string }>
  ).map(profile => [`${entry.fundId}:${profile.user_id}`, profile.name])))
  return dataSuccess(rows.map(row => ({
    ...row,
    fund_title: fundTitles.get(row.fund_id) ?? 'Fund',
    recipient_name: userNames.get(`${row.fund_id}:${row.recipient_user_id}`) ?? 'A fund member',
    awarded_by_name: userNames.get(`${row.fund_id}:${row.awarded_by}`) ?? 'The organiser',
  })))
}

export async function getApiRichAuntieEligibility(
  client: SupabaseClient,
  fundId: string,
  recipientUserId: string,
): Promise<ApiDataResult<RichAuntieEligibility | null>> {
  const [member, profiles, items, awards, permissions] = await Promise.all([
    client.from('fund_members').select('id').eq('fund_id', fundId).eq('user_id', recipientUserId).eq('status', 'joined').maybeSingle(),
    client.rpc('get_fund_member_profiles', { p_fund_id: fundId }),
    client.from('fund_sponsorship_item_progress')
      .select('id, title, target_amount, allocated_amount, outstanding_amount, status')
      .eq('fund_id', fundId)
      .eq('claimed_by_user_id', recipientUserId)
      .in('status', ['claimed', 'funded', 'fulfilled'])
      .order('created_at', { ascending: true }),
    client.from('rich_auntie_awards').select('sponsorship_item_id').eq('fund_id', fundId).eq('recipient_user_id', recipientUserId),
    client.rpc('get_my_fund_permissions', { p_fund_id: fundId }),
  ])
  for (const result of [member, profiles, items, awards, permissions]) {
    if (result.error) return dataFailure({ kind: 'database', error: result.error })
  }
  if (!member.data) return dataSuccess(null)
  const profile = ((profiles.data ?? []) as Array<{ user_id: string; name: string }>).find(row => row.user_id === recipientUserId)
  const awardedIds = new Set((awards.data ?? []).flatMap(row => row.sponsorship_item_id ? [row.sponsorship_item_id as string] : []))
  const canAward = (permissions.data ?? []).some((row: { permission_key: string }) => row.permission_key === 'award_recognition')
  return dataSuccess({
    fund_id: fundId,
    recipient_user_id: recipientUserId,
    recipient_name: profile?.name ?? 'Fund member',
    can_award: canAward,
    sponsorship_progress: (items.data ?? []).map(row => {
      const alreadyAwarded = awardedIds.has(row.id as string)
      const status = row.status as 'claimed' | 'funded' | 'fulfilled'
      return {
        id: row.id as string,
        title: row.title as string,
        target_amount: money(minorUnits(row.target_amount)),
        allocated_amount: money(minorUnits(row.allocated_amount)),
        outstanding_amount: money(minorUnits(row.outstanding_amount)),
        status,
        already_awarded: alreadyAwarded,
        eligible: (status === 'funded' || status === 'fulfilled') && !alreadyAwarded,
      }
    }),
  })
}

export async function createApiRichAuntieAward(
  client: SupabaseClient,
  actorUserId: string,
  input: CreateRichAuntieAwardRequest,
): Promise<ApiDataResult<RichAuntieAward>> {
  const result = await client.from('rich_auntie_awards').insert({
    ...input,
    sponsorship_item_id: input.sponsorship_item_id ?? null,
    reason_label: input.reason_label.trim(),
    awarded_by: actorUserId,
  }).select(AWARD_SELECT).single()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  const enriched = await enrichAwards(client, [result.data as AwardRow])
  if (enriched.error) return enriched
  return dataSuccess(enriched.data[0])
}

export async function listApiRichAuntieAwards(
  client: SupabaseClient,
  input: ListRichAuntieAwardsRequest,
): Promise<ApiDataResult<Paginated<RichAuntieAward>>> {
  const scope = createQueryScope('rich-auntie-awards', {
    fund_id: input.fund_id,
    recipient_user_id: input.recipient_user_id,
    awarded_by: input.awarded_by,
    sort_direction: input.sort_direction,
  })
  const window = resolvePageWindow(input, scope)
  if (window.error) return window
  const ascending = (input.sort_direction ?? 'desc') === 'asc'
  let query = client.from('rich_auntie_awards').select(AWARD_SELECT)
  if (input.fund_id) query = query.eq('fund_id', input.fund_id)
  if (input.recipient_user_id) query = query.eq('recipient_user_id', input.recipient_user_id)
  if (input.awarded_by) query = query.eq('awarded_by', input.awarded_by)
  const result = await query.order('created_at', { ascending }).order('id', { ascending }).range(window.data.offset, window.data.offset + window.data.limit)
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  const rows = (result.data ?? []) as AwardRow[]
  const enriched = await enrichAwards(client, rows.slice(0, window.data.limit))
  if (enriched.error) return enriched
  const byId = new Map(enriched.data.map(row => [row.id, row]))
  return dataSuccess(createPage(rows, window.data, row => byId.get(row.id) ?? ({
    ...row,
    fund_title: 'Fund',
    recipient_name: 'A fund member',
    awarded_by_name: 'The organiser',
  })))
}

export async function getApiRichAuntieRecipientHistory(
  client: SupabaseClient,
  recipientUserId: string,
): Promise<ApiDataResult<RichAuntieRecipientHistory | null>> {
  const [profile, contributions, awardRows, awardFunds] = await Promise.all([
    client.from('users').select('id, name').eq('id', recipientUserId).maybeSingle(),
    client.from('contributions').select('fund_id, amount, status, is_refunded').eq('user_id', recipientUserId),
    client.from('rich_auntie_awards').select(AWARD_SELECT, { count: 'exact' }).eq('recipient_user_id', recipientUserId).order('created_at', { ascending: false }).limit(100),
    client.from('rich_auntie_awards').select('fund_id').eq('recipient_user_id', recipientUserId),
  ])
  if (profile.error) return dataFailure({ kind: 'database', error: profile.error })
  if (contributions.error) return dataFailure({ kind: 'database', error: contributions.error })
  if (awardRows.error) return dataFailure({ kind: 'database', error: awardRows.error })
  if (awardFunds.error) return dataFailure({ kind: 'database', error: awardFunds.error })
  const enriched = await enrichAwards(client, (awardRows.data ?? []) as AwardRow[])
  if (enriched.error) return enriched
  if (!profile.data && !contributions.data?.length && !enriched.data.length) return dataSuccess(null)
  const confirmed = (contributions.data ?? []).filter(row => row.status === 'confirmed' && !row.is_refunded)
  const contributedFunds = new Set(confirmed.map(row => row.fund_id as string))
  const helpedFunds = new Set([...contributedFunds, ...(awardFunds.data ?? []).map(row => row.fund_id as string)])
  const cash = confirmed.reduce((sum, row) => sum + minorUnits(row.amount), BigInt(0))
  const awardCount = awardRows.count ?? enriched.data.length
  return dataSuccess({
    recipient_user_id: recipientUserId,
    recipient_name: (profile.data?.name as string | undefined) ?? enriched.data[0]?.recipient_name ?? 'Fund member',
    cash_given: money(cash),
    fund_count: helpedFunds.size,
    award_count: awardCount,
    is_rich_auntie: awardCount > 0,
    is_consistent_contributor: contributedFunds.size >= 3,
    awards: enriched.data,
  })
}

export async function getApiRichAuntieCelebration(
  client: SupabaseClient,
  actorUserId: string,
  awardId: string,
): Promise<ApiDataResult<RichAuntieCelebration | null>> {
  const result = await client.from('rich_auntie_awards').select(AWARD_SELECT).eq('id', awardId).maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  if (!result.data) return dataSuccess(null)
  const enriched = await enrichAwards(client, [result.data as AwardRow])
  if (enriched.error) return enriched
  return dataSuccess({ award: enriched.data[0], is_recipient: enriched.data[0].recipient_user_id === actorUserId })
}
