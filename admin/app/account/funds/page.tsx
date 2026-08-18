import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleCheckBig, HandCoins, UsersRound } from 'lucide-react'
import { getAppUserContext } from '@/lib/app-user'
import { getMemberFunds, type MemberFundMembership, type MemberFundStats } from '@/lib/data/account'
import { formatDate, formatMoney, titleCase } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My funds',
  description: 'Funds you organise, belong to, and have closed.',
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
  membership: MemberFundMembership
  stats: MemberFundStats
  kind: 'organiser' | 'member' | 'closed'
}) {
  const fund = membership.fund
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
  const { supabase, userId, userPromise } = await getAppUserContext()
  const [{ organisedFunds, joinedFunds, closedFunds, statsByFund, hasError }] = await Promise.all([
    getMemberFunds(supabase, userId),
    userPromise,
  ])

  return (
    <>
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
            const fund = membership.fund
            return fund ? <FundCard key={membership.id} membership={membership} stats={statsByFund[fund.id] ?? { raised: 0, contributionCount: 0, memberCount: 0 }} kind="organiser" /> : null
          })}
          {!organisedFunds.length && <div className="member-empty">You are not organising any active funds yet.</div>}
        </div>
      </section>

      <section className="member-card">
        <header><div className="member-section-title"><span><UsersRound size={18} /></span><h2>Funds I belong to</h2></div></header>
        <div className="member-card-body member-funds-grid">
          {joinedFunds.map((membership) => {
            const fund = membership.fund
            return fund ? <FundCard key={membership.id} membership={membership} stats={statsByFund[fund.id] ?? { raised: 0, contributionCount: 0, memberCount: 0 }} kind="member" /> : null
          })}
          {!joinedFunds.length && <div className="member-empty">You have not joined any other active funds.</div>}
        </div>
      </section>

      <section className="member-card">
        <header><div className="member-section-title"><span><CircleCheckBig size={18} /></span><h2>Closed funds</h2></div></header>
        <div className="member-card-body member-funds-grid">
          {closedFunds.map((membership) => {
            const fund = membership.fund
            return fund ? <FundCard key={membership.id} membership={membership} stats={statsByFund[fund.id] ?? { raised: 0, contributionCount: 0, memberCount: 0 }} kind="closed" /> : null
          })}
          {!closedFunds.length && <div className="member-empty">Closed funds will appear here.</div>}
        </div>
      </section>

      {hasError && <p className="member-contribution-error">Some fund details could not be loaded. Please refresh the page.</p>}
    </>
  )
}
