import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Coins, HandCoins, ListChecks } from 'lucide-react'
import { CopyLinkButton } from '@/components/copy-link-button'
import { StatusPill } from '@/components/status-pill'
import { getAppUserContext } from '@/lib/app-user'
import { getAccountOverviewData } from '@/lib/data/account'
import { formatDate, formatMoney, titleCase } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Overview',
  description: 'Your funds, events, activity, and account summary in one place.',
}

export default async function OverviewPage() {
  const { supabase, userId, userPromise } = await getAppUserContext()
  const {
    user,
    ownedFundCount,
    joinedFundCount,
    memberships,
    contributions,
    eventCount,
    events,
  } = await getAccountOverviewData(supabase, userId, userPromise)
  const recentContributions = contributions.slice(0, 5)
  const bwpContributed = contributions
    .filter(contribution => contribution.status === 'confirmed' && contribution.currency_code === 'BWP')
    .reduce((total, contribution) => total + Number(contribution.amount || 0), 0)
  const contributedFundCount = new Set(contributions.map(contribution => contribution.fund?.id).filter(Boolean)).size
  const firstName = user.name.split(' ')[0]
  const eventOnly = events.filter(event => !event.linked_fund_id)
  const eventFunds = events.filter(event => Boolean(event.linked_fund_id))
  const stats = [
    { label: 'Token balance', value: user.tokenBalance.toLocaleString('en-BW'), hint: 'Available to use', accent: true },
    { label: 'BWP contributed', value: formatMoney(bwpContributed, 'BWP'), hint: `Across ${contributedFundCount} fund${contributedFundCount === 1 ? '' : 's'}` },
    { label: 'Funds organised', value: ownedFundCount.toLocaleString('en-BW'), hint: 'Created by you' },
    { label: 'Funds joined', value: joinedFundCount.toLocaleString('en-BW'), hint: 'Current memberships' },
    { label: 'Events organised', value: eventCount.toLocaleString('en-BW'), hint: 'Created by you' },
  ]

  return (
    <>
      <section className="member-pagehead">
        <div>
          <h1>Dumela, <em>{firstName}</em></h1>
        </div>
        <Link className="member-profile-state" href={'/account' as Route}>Profile {user.profileCompleted ? 'complete' : 'incomplete'}</Link>
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
          <Link className="primary" href={'/account/funds/new' as Route}>Create a fund</Link>
          <Link className="primary" href={'/account/events/new' as Route}>Create an event</Link>
          <Link href={'/account/funds' as Route}>Manage funds</Link>
          <Link href={'/account/events?tab=eventFund' as Route}>Manage Event + Funds</Link>
          <Link href={'/account/events' as Route}>Manage events</Link>
          <Link href={'/account/reports' as Route}>Reports &amp; documents</Link>
        </div>
      </section>

      <section className="member-card">
        <header>
          <div className="member-section-title"><span><Coins size={18} /></span><h2>Recent activity</h2></div>
          <Link href={'/account/reports' as Route}>Open reports <ArrowRight size={14} /></Link>
        </header>
        <div className="member-card-body">
          <ul className="member-feed">
            {recentContributions.map(contribution => (
              <li key={contribution.id}>
                <span className="member-feed-icon"><Coins size={17} /></span>
                <div><strong>You contributed {formatMoney(contribution.amount, contribution.currency_code)}</strong><p>{contribution.fund?.title ?? 'Tshelo fund'} · {titleCase(contribution.status)}</p></div>
                <time>{formatDate(contribution.created_at)}</time>
              </li>
            ))}
          </ul>
          {!recentContributions.length && <div className="member-empty">Your recent recorded activity will appear here.</div>}
        </div>
      </section>

      <section className="member-card">
        <header><div className="member-section-title"><span><HandCoins size={18} /></span><h2>My funds</h2></div><Link href={'/account/funds' as Route}>View all <ArrowRight size={14} /></Link></header>
        <div className="member-card-body member-fund-grid">
          {memberships.map(membership => {
            const fund = membership.fund
            if (!fund) return null
            const inviteHref = `/account/funds?joinCode=${encodeURIComponent(fund.fund_code)}`
            return (
              <article className="member-fund" key={membership.id}>
                <Link className="member-fund-content" href={`/account/funds/${fund.id}` as Route}>
                <div className="member-fund-head">
                  <div><h3>{fund.title}</h3><p>{fund.fund_code} · {formatDate(fund.created_at)}</p></div>
                  <span>{titleCase(membership.role)}</span>
                </div>
                <div className="member-fund-goal"><p>Fund goal</p><strong>{formatMoney(fund.goal_amount, fund.currency_code)}</strong></div>
                </Link>
                <div className="member-fund-foot"><StatusPill value={fund.status} /><div className="member-fund-foot-actions"><span>{titleCase(membership.status)}</span><CopyLinkButton href={inviteHref} label={`Copy invitation link for ${fund.title}`} /></div></div>
              </article>
            )
          })}
          {!memberships.length && <div className="member-empty">No funds are linked to this account yet.</div>}
        </div>
      </section>

      <section className="member-card">
        <header><div className="member-section-title"><span><CalendarDays size={18} /></span><h2>My events</h2></div><Link href={'/account/events' as Route}>View events <ArrowRight size={14} /></Link></header>
        <div className="member-card-body member-event-summary">
          <strong>{eventCount}</strong>
          <div><h3>Events organised</h3><p>Create events, manage Event + Funds, review guests, and post announcements from the website.</p></div>
        </div>
        <div className="member-card-body member-fund-grid member-overview-resource-grid">
          {eventOnly.map(event => {
            const inviteHref = `/account/events?joinCode=${encodeURIComponent(event.share_code || event.event_code)}`
            return <article className="member-fund" key={event.id}>
              <Link className="member-fund-content" href={`/account/events/${event.id}` as Route}>
                <div className="member-fund-head"><div><h3>{event.name}</h3><p>{event.event_code} · {formatDate(event.created_at)}</p></div><span>{titleCase(event.event_type)}</span></div>
                <div className="member-fund-goal"><p>Event</p><strong>{titleCase(event.status)}</strong></div>
              </Link>
              <div className="member-fund-foot"><span>Invitation link</span><CopyLinkButton href={inviteHref} label={`Copy invitation link for ${event.name}`} /></div>
            </article>
          })}
          {!eventOnly.length && <div className="member-empty">No standalone events are linked to this account yet.</div>}
        </div>
      </section>

      <section className="member-card">
        <header><div className="member-section-title"><span><CalendarDays size={18} /></span><h2>Event + Funds</h2></div><Link href={'/account/events?tab=eventFund' as Route}>View Event + Funds <ArrowRight size={14} /></Link></header>
        <div className="member-card-body member-fund-grid">
          {eventFunds.map(event => {
            const inviteHref = `/account/events?joinCode=${encodeURIComponent(event.share_code || event.event_code)}`
            return <article className="member-fund" key={event.id}>
              <Link className="member-fund-content" href={`/account/events/${event.id}` as Route}>
                <div className="member-fund-head"><div><h3>{event.name}</h3><p>{event.event_code} · {formatDate(event.created_at)}</p></div><span>Event + Fund</span></div>
                <div className="member-fund-goal"><p>Event status</p><strong>{titleCase(event.status)}</strong></div>
              </Link>
              <div className="member-fund-foot"><span>Invitation link</span><CopyLinkButton href={inviteHref} label={`Copy invitation link for ${event.name}`} /></div>
            </article>
          })}
          {!eventFunds.length && <div className="member-empty">No Event + Funds are linked to this account yet.</div>}
        </div>
      </section>
    </>
  )
}
