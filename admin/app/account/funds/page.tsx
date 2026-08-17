import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleCheckBig, HandCoins, UsersRound } from 'lucide-react'
import { AccountShell } from '@/components/account-shell'
import { requireAppUser } from '@/lib/app-user'
import { formatDate, formatMoney, titleCase } from '@/lib/format'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My funds',
  description: 'Funds you organise, belong to, and have closed.',
}

type FundSummary = {
  id: string
  owner_id: string
  title: string
  fund_code: string
  fund_type: string
  currency_code: string
  goal_amount: number | string | null
  status: string
  contribution_deadline: string | null
  auto_close_date: string | null
  closed_at: string | null
  linked_event_id: string | null
  created_at: string
}

type MembershipRow = {
  id: string
  role: string
  status: string
  suggested_contribution: number | string | null
  contribution_goal: number | string | null
  funds: FundSummary | FundSummary[] | null
}

type ContributionRow = {
  fund_id: string
  amount: number | string
  status: string
  is_refunded: boolean
}

type FundMemberRow = {
  fund_id: string
}

type FundStats = {
  raised: number
  contributionCount: number
  memberCount: number
}

function membershipFund(row: MembershipRow) {
  return Array.isArray(row.funds) ? row.funds[0] : row.funds
}

function progressPercent(raised: number, goal: number | string | null) {
  const total = Number(goal ?? 0)
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((raised / total) * 100)))
}

function FundCard({
  membership,
  stats,
  kind,
}: {
  membership: MembershipRow
  stats: FundStats
  kind: 'organiser' | 'member' | 'closed'
}) {
  const fund = membershipFund(membership)
  if (!fund) return null

  const progress = progressPercent(stats.raised, fund.goal_amount)
  const closeDate = fund.contribution_deadline ?? fund.auto_close_date
  const contributionHref = {
    pathname: '/account/contributions' as const,
    query: { fund: fund.id },
  }

  if (kind === 'closed') {
    return (
      <article className="member-funds-card">
        <div className="member-funds-card-head">
          <div>
            <h3>{fund.title}</h3>
            <p>Closed {formatDate(fund.closed_at)} · {stats.memberCount || 1} member{stats.memberCount === 1 ? '' : 's'}</p>
            <span className="member-funds-detail positive">{formatMoney(stats.raised, fund.currency_code)} raised</span>
          </div>
          <span className="member-funds-role closed">Closed</span>
        </div>
        <div className="member-fund-actions">
          <button type="button" disabled title="Available in the Tshelo mobile app">Download final audit report</button>
          <Link href={contributionHref}>See contributions</Link>
        </div>
      </article>
    )
  }

  const meta = kind === 'organiser'
    ? `${stats.memberCount || 1} member${stats.memberCount === 1 ? '' : 's'} · ${stats.contributionCount} contribution${stats.contributionCount === 1 ? '' : 's'}`
    : `${titleCase(fund.fund_type)} · ${fund.fund_code}`
  const detail = fund.linked_event_id
    ? 'Linked to an event'
    : closeDate
      ? `Closes ${formatDate(closeDate)}`
      : membership.suggested_contribution
        ? `${formatMoney(membership.suggested_contribution, fund.currency_code)} suggested`
        : titleCase(membership.status)

  return (
    <article className="member-funds-card">
      <div className="member-funds-card-head">
        <div>
          <h3>{fund.title}</h3>
          <p>{meta}</p>
          <span className="member-funds-detail">{detail}</span>
        </div>
        <span className={`member-funds-role ${kind}`}>{kind === 'organiser' ? 'Organiser' : 'Member'}</span>
      </div>
      <div className="member-fund-progress">
        <div><span><strong>{formatMoney(stats.raised, fund.currency_code)}</strong> raised</span><span>of {formatMoney(fund.goal_amount, fund.currency_code)}</span></div>
        <div className="member-fund-track" aria-label={`${progress}% of fund goal`}><i style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="member-fund-actions">
        {kind === 'organiser' && <button type="button" disabled title="Available in the Tshelo mobile app">Record a contribution</button>}
        <Link href={contributionHref}>{kind === 'organiser' ? 'See contributions' : 'See all contributions'}</Link>
        <button type="button" disabled title="Available in the Tshelo mobile app">{kind === 'organiser' ? 'Invite members' : 'View fund'}</button>
      </div>
    </article>
  )
}

export default async function AccountFundsPage() {
  const supabase = await createClient()
  const user = await requireAppUser(supabase)
  const membershipsResult = await supabase
    .from('fund_members')
    .select('id, role, status, suggested_contribution, contribution_goal, funds!inner(id, owner_id, title, fund_code, fund_type, currency_code, goal_amount, status, contribution_deadline, auto_close_date, closed_at, linked_event_id, created_at)')
    .eq('user_id', user.id)
    .is('funds.deleted_at', null)
    .order('created_at', { ascending: false })

  const memberships = (membershipsResult.data ?? []) as unknown as MembershipRow[]
  const fundIds = memberships.map((membership) => membershipFund(membership)?.id).filter((id): id is string => Boolean(id))
  const [contributionsResult, membersResult] = fundIds.length
    ? await Promise.all([
        supabase
          .from('contributions')
          .select('fund_id, amount, status, is_refunded')
          .in('fund_id', fundIds),
        supabase
          .from('fund_members')
          .select('fund_id')
          .in('fund_id', fundIds)
          .eq('status', 'joined'),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]

  const statsByFund = new Map<string, FundStats>(fundIds.map((id) => [id, { raised: 0, contributionCount: 0, memberCount: 0 }]))

  for (const contribution of (contributionsResult.data ?? []) as ContributionRow[]) {
    const stats = statsByFund.get(contribution.fund_id)
    if (!stats) continue
    stats.contributionCount += 1
    if (contribution.status === 'confirmed' && !contribution.is_refunded) stats.raised += Number(contribution.amount || 0)
  }

  for (const member of (membersResult.data ?? []) as FundMemberRow[]) {
    const stats = statsByFund.get(member.fund_id)
    if (stats) stats.memberCount += 1
  }

  const activeMemberships = memberships.filter((membership) => {
    const fund = membershipFund(membership)
    return fund && fund.status !== 'closed' && ['joined', 'pending'].includes(membership.status)
  })
  const organisedFunds = activeMemberships.filter((membership) => ['owner', 'admin'].includes(membership.role))
  const joinedFunds = activeMemberships.filter((membership) => !['owner', 'admin'].includes(membership.role))
  const closedFunds = memberships.filter((membership) => membershipFund(membership)?.status === 'closed')
  const hasError = membershipsResult.error || contributionsResult.error || membersResult.error

  return (
    <AccountShell user={user} active="funds">
      <section className="member-pagehead">
        <div>
          <h1>My <em>funds</em></h1>
          <p>Funds you run, funds you belong to, and the archive of everything already closed.</p>
        </div>
        <div className="member-page-actions"><button type="button" disabled title="Available in the Tshelo mobile app">Create a fund</button></div>
      </section>

      <section className="member-card">
        <header><div className="member-section-title"><span><HandCoins size={18} /></span><h2>Funds I organise</h2></div></header>
        <div className="member-card-body member-funds-grid">
          {organisedFunds.map((membership) => {
            const fund = membershipFund(membership)
            return fund ? <FundCard key={membership.id} membership={membership} stats={statsByFund.get(fund.id) ?? { raised: 0, contributionCount: 0, memberCount: 0 }} kind="organiser" /> : null
          })}
          {!organisedFunds.length && <div className="member-empty">You are not organising any active funds yet.</div>}
        </div>
      </section>

      <section className="member-card">
        <header><div className="member-section-title"><span><UsersRound size={18} /></span><h2>Funds I belong to</h2></div></header>
        <div className="member-card-body member-funds-grid">
          {joinedFunds.map((membership) => {
            const fund = membershipFund(membership)
            return fund ? <FundCard key={membership.id} membership={membership} stats={statsByFund.get(fund.id) ?? { raised: 0, contributionCount: 0, memberCount: 0 }} kind="member" /> : null
          })}
          {!joinedFunds.length && <div className="member-empty">You have not joined any other active funds.</div>}
        </div>
      </section>

      <section className="member-card">
        <header><div className="member-section-title"><span><CircleCheckBig size={18} /></span><h2>Closed funds</h2></div></header>
        <div className="member-card-body member-funds-grid">
          {closedFunds.map((membership) => {
            const fund = membershipFund(membership)
            return fund ? <FundCard key={membership.id} membership={membership} stats={statsByFund.get(fund.id) ?? { raised: 0, contributionCount: 0, memberCount: 0 }} kind="closed" /> : null
          })}
          {!closedFunds.length && <div className="member-empty">Closed funds will appear here.</div>}
        </div>
      </section>

      {hasError && <p className="member-contribution-error">Some fund details could not be loaded. Please refresh the page.</p>}
    </AccountShell>
  )
}
