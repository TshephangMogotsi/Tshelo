import 'server-only'

import type { MoneyAmount } from '@shared/contracts/common'
import type { ContributionStatus, ContributionSummary } from '@shared/contracts/contributions'
import type { Fund, FundMemberRole, FundMemberStatus, FundSummary } from '@shared/contracts/funds'
import type { AppUser } from '@/lib/app-user'
import type { ServerClient } from './client'

export type AccountFundSummary = Pick<FundSummary, 'id' | 'title' | 'fund_code' | 'status' | 'goal_amount' | 'currency_code' | 'created_at'>

export type AccountMembership = {
  id: string
  role: FundMemberRole
  status: FundMemberStatus
  fund: AccountFundSummary | null
}

export type AccountContribution = Pick<ContributionSummary, 'id' | 'amount' | 'currency_code' | 'status' | 'created_at'> & {
  fund: { title: string } | null
}

type AccountFundSummaryRow = Omit<AccountFundSummary, 'goal_amount'> & {
  goal_amount: number | string | null
}

type AccountMembershipRow = Omit<AccountMembership, 'fund'> & {
  funds: AccountFundSummaryRow | AccountFundSummaryRow[] | null
}

type AccountContributionRow = Omit<AccountContribution, 'amount' | 'fund'> & {
  amount: number | string
  funds: { title: string } | { title: string }[] | null
}

export type AccountOverviewData = {
  user: AppUser
  ownedFundCount: number
  joinedFundCount: number
  memberships: AccountMembership[]
  contributions: AccountContribution[]
  eventCount: number
}

export type ContributionFund = Pick<FundSummary, 'id' | 'title'>

export type ContributionHistoryItem = Pick<ContributionSummary, 'id' | 'amount' | 'currency_code' | 'payment_method' | 'status' | 'created_at'> & {
  fund: ContributionFund | null
}

type ContributionMembershipRow = {
  fund_id: string
  funds: ContributionFund | ContributionFund[] | null
}

type ContributionHistoryRow = Omit<ContributionHistoryItem, 'amount' | 'fund'> & {
  amount: number | string
  funds: ContributionFund | ContributionFund[] | null
}

export type ContributionHistoryFilters = {
  fundId?: string
  from: string
  to: string
}

export type ContributionHistoryData = {
  funds: ContributionFund[]
  contributions: ContributionHistoryItem[]
  hasError: boolean
}

export type MemberFundSummary = Pick<Fund, 'id' | 'owner_id' | 'title' | 'fund_code' | 'fund_type' | 'currency_code' | 'goal_amount' | 'status' | 'contribution_deadline' | 'auto_close_date' | 'closed_at' | 'linked_event_id' | 'created_at'>

export type MemberFundMembership = {
  id: string
  role: FundMemberRole
  status: FundMemberStatus
  suggested_contribution: MoneyAmount | null
  contribution_goal: MoneyAmount | null
  fund: MemberFundSummary | null
}

type MemberFundSummaryRow = Omit<MemberFundSummary, 'goal_amount'> & {
  goal_amount: number | string | null
}

type MemberFundMembershipRow = Omit<MemberFundMembership, 'suggested_contribution' | 'contribution_goal' | 'fund'> & {
  suggested_contribution: number | string | null
  contribution_goal: number | string | null
  funds: MemberFundSummaryRow | MemberFundSummaryRow[] | null
}

type MemberFundContributionRow = {
  fund_id: string
  amount: number | string
  status: ContributionStatus
  is_refunded: boolean
}

type MemberFundRow = {
  fund_id: string
}

export type MemberFundStats = {
  raised: number
  contributionCount: number
  memberCount: number
}

export type MemberFundsData = {
  organisedFunds: MemberFundMembership[]
  joinedFunds: MemberFundMembership[]
  closedFunds: MemberFundMembership[]
  statsByFund: Record<string, MemberFundStats>
  hasError: boolean
}

function relatedRecord<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function optionalMoneyAmount(value: number | string | null): string | null {
  return value === null ? null : String(value)
}

function toAccountFund(row: AccountFundSummaryRow | null): AccountFundSummary | null {
  return row ? { ...row, goal_amount: optionalMoneyAmount(row.goal_amount) } : null
}

function toMemberFund(row: MemberFundSummaryRow | null): MemberFundSummary | null {
  return row ? { ...row, goal_amount: optionalMoneyAmount(row.goal_amount) } : null
}

export async function getAccountOverviewData(
  client: ServerClient,
  userId: string,
  userPromise: Promise<AppUser>,
): Promise<AccountOverviewData> {
  const [user, ownedFundsResult, membershipCountResult, membershipsResult, contributionsResult, eventsResult] = await Promise.all([
    userPromise,
    client
      .from('funds')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .is('deleted_at', null),
    client
      .from('fund_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'joined'),
    client
      .from('fund_members')
      .select('id, role, status, funds(id, title, fund_code, status, goal_amount, currency_code, created_at)')
      .eq('user_id', userId)
      .in('status', ['joined', 'pending'])
      .order('created_at', { ascending: false })
      .limit(6),
    client
      .from('contributions')
      .select('id, amount, currency_code, status, created_at, funds(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    client
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', userId)
      .is('deleted_at', null),
  ])

  const memberships = ((membershipsResult.data ?? []) as unknown as AccountMembershipRow[]).map(({ funds, ...membership }) => ({
    ...membership,
    fund: toAccountFund(relatedRecord(funds)),
  }))
  const contributions = ((contributionsResult.data ?? []) as unknown as AccountContributionRow[]).map(({ amount, funds, ...contribution }) => ({
    ...contribution,
    amount: String(amount),
    fund: relatedRecord(funds),
  }))

  return {
    user,
    ownedFundCount: ownedFundsResult.count ?? 0,
    joinedFundCount: membershipCountResult.count ?? 0,
    memberships,
    contributions,
    eventCount: eventsResult.count ?? 0,
  }
}

export async function getContributionHistory(
  client: ServerClient,
  userId: string,
  filters: ContributionHistoryFilters,
): Promise<ContributionHistoryData> {
  let contributionsRequest = client
    .from('contributions')
    .select('id, amount, currency_code, payment_method, status, created_at, funds(id, title)')
    .eq('user_id', userId)
    .gte('created_at', `${filters.from}T00:00:00.000Z`)
    .lte('created_at', `${filters.to}T23:59:59.999Z`)
    .order('created_at', { ascending: false })

  if (filters.fundId) contributionsRequest = contributionsRequest.eq('fund_id', filters.fundId)

  const [membershipsResult, contributionsResult] = await Promise.all([
    client
      .from('fund_members')
      .select('fund_id, funds(id, title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    contributionsRequest,
  ])

  const memberships = (membershipsResult.data ?? []) as ContributionMembershipRow[]
  const contributions = ((contributionsResult.data ?? []) as unknown as ContributionHistoryRow[]).map(({ amount, funds, ...contribution }) => ({
    ...contribution,
    amount: String(amount),
    fund: relatedRecord(funds),
  }))
  const funds = Array.from(
    new Map(
      memberships
        .map((membership) => relatedRecord(membership.funds))
        .filter((fund): fund is ContributionFund => Boolean(fund))
        .map((fund) => [fund.id, fund]),
    ).values(),
  ).sort((a, b) => a.title.localeCompare(b.title))

  return {
    funds,
    contributions,
    hasError: Boolean(membershipsResult.error || contributionsResult.error),
  }
}

export async function getMemberFunds(client: ServerClient, userId: string): Promise<MemberFundsData> {
  const membershipsResult = await client
    .from('fund_members')
    .select('id, role, status, suggested_contribution, contribution_goal, funds!inner(id, owner_id, title, fund_code, fund_type, currency_code, goal_amount, status, contribution_deadline, auto_close_date, closed_at, linked_event_id, created_at)')
    .eq('user_id', userId)
    .is('funds.deleted_at', null)
    .order('created_at', { ascending: false })

  const memberships = ((membershipsResult.data ?? []) as unknown as MemberFundMembershipRow[]).map(({ suggested_contribution, contribution_goal, funds, ...membership }) => ({
    ...membership,
    suggested_contribution: optionalMoneyAmount(suggested_contribution),
    contribution_goal: optionalMoneyAmount(contribution_goal),
    fund: toMemberFund(relatedRecord(funds)),
  }))
  const fundIds = memberships.map((membership) => membership.fund?.id).filter((id): id is string => Boolean(id))
  const [contributionsResult, membersResult] = fundIds.length
    ? await Promise.all([
        client
          .from('contributions')
          .select('fund_id, amount, status, is_refunded')
          .in('fund_id', fundIds),
        client
          .from('fund_members')
          .select('fund_id')
          .in('fund_id', fundIds)
          .eq('status', 'joined'),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]

  const statsByFund = Object.fromEntries(
    fundIds.map((id) => [id, { raised: 0, contributionCount: 0, memberCount: 0 } satisfies MemberFundStats]),
  ) as Record<string, MemberFundStats>

  for (const contribution of (contributionsResult.data ?? []) as MemberFundContributionRow[]) {
    const stats = statsByFund[contribution.fund_id]
    if (!stats) continue
    stats.contributionCount += 1
    if (contribution.status === 'confirmed' && !contribution.is_refunded) stats.raised += Number(contribution.amount || 0)
  }

  for (const member of (membersResult.data ?? []) as MemberFundRow[]) {
    const stats = statsByFund[member.fund_id]
    if (stats) stats.memberCount += 1
  }

  const activeMemberships = memberships.filter((membership) => (
    membership.fund
    && membership.fund.status !== 'closed'
    && ['joined', 'pending'].includes(membership.status)
  ))

  return {
    organisedFunds: activeMemberships.filter((membership) => ['owner', 'admin'].includes(membership.role)),
    joinedFunds: activeMemberships.filter((membership) => !['owner', 'admin'].includes(membership.role)),
    closedFunds: memberships.filter((membership) => membership.fund?.status === 'closed'),
    statsByFund,
    hasError: Boolean(membershipsResult.error || contributionsResult.error || membersResult.error),
  }
}
