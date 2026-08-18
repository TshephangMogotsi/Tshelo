'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CalendarCheck, CalendarDays, CircleCheck, RefreshCw, UsersRound } from 'lucide-react'
import type { HomeSummaryItem } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { formatDate, formatMoney, titleCase } from '@/lib/format'

function EventCard({ item }: { item: HomeSummaryItem }) {
  const eventId = item.event_id ?? item.id
  return (
    <article className="member-event-card">
      <div className="member-event-date"><strong>{item.event_date ? new Date(`${item.event_date}T00:00:00`).getDate() : '—'}</strong><span>{item.event_date ? new Date(`${item.event_date}T00:00:00`).toLocaleDateString('en-BW', { month: 'short' }) : 'TBC'}</span></div>
      <div className="member-event-card-copy">
        <div><span aria-hidden="true">{item.emoji}</span><small>{item.category}</small></div>
        <h3>{item.title}</h3>
        <p>{formatDate(item.event_date)} · {item.venue_name || 'Venue to be confirmed'}</p>
        <div className="member-event-meta"><span>{item.guest_count} guest{item.guest_count === 1 ? '' : 's'}</span>{item.kind === 'eventFund' && <span>{formatMoney(item.total_contributions, item.currency_code)} raised</span>}<span>{titleCase(item.role)}</span></div>
      </div>
      <div className="member-event-card-action"><span className={`member-funds-role ${item.status === 'active' ? 'organiser' : 'closed'}`}>{titleCase(item.status)}</span><Link href={`/account/events/${eventId}` as Route}>Open workspace</Link></div>
    </article>
  )
}

function EventSection({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: HomeSummaryItem[]; empty: string }) {
  return <section className="member-card"><header><div className="member-section-title"><span>{icon}</span><h2>{title}</h2></div></header><div className="member-card-body member-events-list">{items.map(item => <EventCard key={item.id} item={item} />)}{!items.length && <div className="member-empty">{empty}</div>}</div></section>
}

export function EventList() {
  const searchParams = useSearchParams()
  const [events, setEvents] = useState<HomeSummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const retry = useCallback(() => { setLoading(true); setError(''); setVersion(value => value + 1) }, [])

  useEffect(() => {
    const controller = new AbortController()
    runApiRead(call => createApiClient().home.summary(call), controller.signal)
      .then(summary => setEvents(summary.items.filter(item => Boolean(item.event_id))))
      .catch(cause => { const message = apiErrorMessage(cause); if (message) setError(message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [version])

  const active = events.filter(item => item.status === 'active')
  const organised = active.filter(item => item.role === 'organiser' || item.role === 'owner')
  const attending = active.filter(item => item.role !== 'organiser' && item.role !== 'owner')
  const past = events.filter(item => item.status !== 'active')

  return <>
    <section className="member-pagehead"><div><h1>My <em>events</em></h1><p>Create an event, invite organisers and guests, post updates, and manage its budget from one workspace.</p></div><div className="member-page-actions"><Link href={'/account/events/join' as Route}>Join with a code</Link><Link className="primary" href={'/account/events/new' as Route}>Create an event</Link></div></section>
    {searchParams.get('joined') === '1' && <p className="member-success-note"><CircleCheck size={16} /> You joined the event successfully.</p>}
    {loading && <section className="member-card"><div className="member-empty">Loading your events…</div></section>}
    {error && <section className="member-card"><div className="member-api-state error"><p>{error}</p><button type="button" onClick={retry}><RefreshCw size={14} /> Try again</button></div></section>}
    {!loading && !error && <><EventSection title="Events I organise" icon={<CalendarDays size={18} />} items={organised} empty="You are not organising an active event yet." /><EventSection title="Events I am attending" icon={<UsersRound size={18} />} items={attending} empty="Join an event with its invite code and it will appear here." /><EventSection title="Past events" icon={<CalendarCheck size={18} />} items={past} empty="Completed and cancelled events will appear here." /></>}
  </>
}
