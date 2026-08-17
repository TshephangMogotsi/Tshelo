import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Coins, HandCoins, ListChecks, UserRound } from 'lucide-react'
import { StatusPill } from '@/components/status-pill'
import { getAppUserContext } from '@/lib/app-user'
import { formatDate, formatMoney, titleCase } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Tshelo',
  description: 'Your secure Tshelo account overview.',
}

type FundSummary = {
  id: string
  title: string
  fund_code: string
  status: string
  goal_amount: number | string | null
  currency_code: string
  created_at: string
}

type MembershipRow = {
  id: string
  role: string
  status: string
  funds: FundSummary | FundSummary[] | null
}

type ContributionRow = {
  id: string
  amount: number | string
  currency_code: string
  status: string
  created_at: string
  funds: { title: string } | { title: string }[] | null
}

function membershipFund(row: MembershipRow) {
  return Array.isArray(row.funds) ? row.funds[0] : row.funds
}

function contributionFund(row: ContributionRow) {
  return Array.isArray(row.funds) ? row.funds[0] : row.funds
}

export default async function AccountPage() {
  const { supabase, userId, userPromise } = await getAppUserContext()

  const [user, ownedFundsResult, membershipCountResult, membershipsResult, contributionsResult, eventsResult] = await Promise.all([
    userPromise,
    supabase
      .from('funds')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .is('deleted_at', null),
    supabase
      .from('fund_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'joined'),
    supabase
      .from('fund_members')
      .select('id, role, status, funds(id, title, fund_code, status, goal_amount, currency_code, created_at)')
      .eq('user_id', userId)
      .in('status', ['joined', 'pending'])
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('contributions')
      .select('id, amount, currency_code, status, created_at, funds(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', userId)
      .is('deleted_at', null),
  ])

  const memberships = (membershipsResult.data ?? []) as MembershipRow[]
  const contributions = (contributionsResult.data ?? []) as ContributionRow[]
  const recentContributions = contributions.slice(0, 5)
  const lifetimeContributed = contributions
    .filter((contribution) => contribution.status === 'confirmed' && contribution.currency_code === 'BWP')
    .reduce((total, contribution) => total + Number(contribution.amount || 0), 0)
  const contributedFundCount = new Set(contributions.map((contribution) => contributionFund(contribution)?.title).filter(Boolean)).size
  const firstName = user.name.split(' ')[0]
  const stats = [
    { label: 'Token balance', value: user.tokenBalance.toLocaleString('en-BW'), hint: 'Never expires', accent: true },
    { label: 'Lifetime contributed', value: formatMoney(lifetimeContributed, 'BWP'), hint: `Across ${contributedFundCount} fund${contributedFundCount === 1 ? '' : 's'}` },
    { label: 'Funds organised', value: (ownedFundsResult.count ?? 0).toLocaleString('en-BW'), hint: 'Created by you' },
    { label: 'Funds joined', value: (membershipCountResult.count ?? 0).toLocaleString('en-BW'), hint: 'Current memberships' },
    { label: 'Events organised', value: (eventsResult.count ?? 0).toLocaleString('en-BW'), hint: 'Created by you' },
  ]

  return (
    <>
      <section className="member-pagehead" id="home">
        <div>
          <h1>Dumela, <em>{firstName}</em></h1>
          <p>Everything you are organising and contributing to, in one place. The app stays the place you record contributions day to day.</p>
        </div>
        <span className="member-profile-state">Profile {user.profileCompleted ? 'complete' : 'incomplete'}</span>
      </section>

      <section className="member-card member-stats" aria-label="Account summary">
        {stats.map(({ label, value, hint, accent }) => (
          <article key={label}>
            <p>{label}</p><strong className={accent ? 'accent' : ''}>{value}</strong><span>{hint}</span>
          </article>
        ))}
      </section>

      <section className="member-card">
        <header><div className="member-section-title"><span><ListChecks size={18} /></span><h2>Quick actions</h2></div></header>
        <div className="member-card-body member-actions">
          <Link className="primary" href="/account/funds">View my funds</Link>
          <Link href="/account/contributions">My contributions</Link>
          <a href="#events">My events</a>
          <a href="#profile">Account details</a>
        </div>
      </section>

      <section className="member-card" id="activity">
        <header>
          <div className="member-section-title"><span><Coins size={18} /></span><h2>Recent activity</h2></div>
          <Link href="/account/funds">View all funds <ArrowRight size={14} /></Link>
        </header>
        <div className="member-card-body">
          <ul className="member-feed">
            {recentContributions.map((contribution) => (
              <li key={contribution.id}>
                <span className="member-feed-icon"><Coins size={17} /></span>
                <div><strong>You contributed {formatMoney(contribution.amount, contribution.currency_code)}</strong><p>{contributionFund(contribution)?.title ?? 'Tshelo fund'} · {titleCase(contribution.status)}</p></div>
                <time>{formatDate(contribution.created_at)}</time>
              </li>
            ))}
          </ul>
          {!recentContributions.length && <div className="member-empty">Your recent contributions will appear here.</div>}
        </div>
      </section>

      <section className="member-card" id="funds">
        <header><div className="member-section-title"><span><HandCoins size={18} /></span><h2>My funds</h2></div></header>
        <div className="member-card-body member-fund-grid">
          {memberships.map((membership) => {
            const fund = membershipFund(membership)
            if (!fund) return null
            return (
              <article className="member-fund" key={membership.id}>
                <div className="member-fund-head">
                  <div><h3>{fund.title}</h3><p>{fund.fund_code} · {formatDate(fund.created_at)}</p></div>
                  <span>{titleCase(membership.role)}</span>
                </div>
                <div className="member-fund-goal"><p>Fund goal</p><strong>{formatMoney(fund.goal_amount, fund.currency_code)}</strong></div>
                <div className="member-fund-foot"><StatusPill value={fund.status} /><span>{titleCase(membership.status)}</span></div>
              </article>
            )
          })}
          {!memberships.length && <div className="member-empty">No funds are linked to this account yet.</div>}
        </div>
      </section>

      <section className="member-card" id="events">
        <header><div className="member-section-title"><span><CalendarDays size={18} /></span><h2>My events</h2></div></header>
        <div className="member-card-body member-event-summary">
          <strong>{eventsResult.count ?? 0}</strong>
          <div><h3>Events organised</h3><p>Event details and guest management remain available in the Tshelo mobile app.</p></div>
        </div>
      </section>

      <section className="member-card" id="profile">
        <header><div className="member-section-title"><span><UserRound size={18} /></span><h2>Account details</h2></div></header>
        <div className="member-card-body member-profile-grid">
          <div><span>Name</span><strong>{user.name}</strong></div>
          <div><span>Phone</span><strong className="mono">{user.phone}</strong></div>
          <div><span>Trust level</span><strong>{titleCase(user.trustLevel)}</strong></div>
          <div><span>Trust points</span><strong>{user.trustScore.toLocaleString('en-BW')}</strong></div>
          <div><span>Member since</span><strong>{formatDate(user.createdAt)}</strong></div>
          <div><span>Profile</span><strong>{user.profileCompleted ? 'Complete' : 'Incomplete'}</strong></div>
        </div>
        <div className="member-web-note">This web dashboard is an overview. Use the Tshelo mobile app to create funds, record contributions, manage events and update account details.</div>
      </section>
    </>
  )
}
