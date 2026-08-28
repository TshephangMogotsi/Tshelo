'use client'

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CircleCheck, RefreshCw } from 'lucide-react'
import type { HomeSummaryItem } from '@shared/contracts'
import { apiErrorMessage } from '@/lib/api-ui'
import { formatDate, formatMoney, titleCase } from '@/lib/format'
import { invalidateHomeSummary, loadHomeSummary } from '@/lib/home-summary-cache'
import { JoinEventDialog } from './join-event-dialog'

type EventTabId = 'organised' | 'eventFund' | 'attending' | 'past'

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

export function EventList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [events, setEvents] = useState<HomeSummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const retry = useCallback(() => { setLoading(true); setError(''); setVersion(value => value + 1) }, [])

  useEffect(() => {
    let active = true
    if (version > 0) invalidateHomeSummary()
    loadHomeSummary()
      .then(summary => { if (active) setEvents(summary.items.filter(item => Boolean(item.event_id))) })
      .catch(cause => { const message = apiErrorMessage(cause); if (active && message) setError(message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [version])

  const active = events.filter(item => item.status === 'active')
  const eventFunds = active.filter(item => item.kind === 'eventFund')
  const eventOnly = active.filter(item => item.kind !== 'eventFund')
  const organised = eventOnly.filter(item => item.role === 'organiser' || item.role === 'owner')
  const attending = eventOnly.filter(item => item.role !== 'organiser' && item.role !== 'owner')
  const past = events.filter(item => item.status !== 'active')
  const requestedTab = searchParams.get('tab')
  const initialJoinCode = searchParams.get('joinCode')?.trim() ?? ''
  const showJoinDialog = joinDialogOpen || Boolean(initialJoinCode)
  const activeTab: EventTabId = requestedTab === 'eventFund' || requestedTab === 'attending' || requestedTab === 'past' ? requestedTab : 'organised'
  const tabs: Array<{ id: EventTabId; label: string; items: HomeSummaryItem[]; empty: string }> = [
    { id: 'organised', label: 'Events I organise', items: organised, empty: 'You are not organising an active event yet.' },
    { id: 'eventFund', label: 'Event + Funds', items: eventFunds, empty: 'Create an Event + Fund when you need contributions and a shared budget.' },
    { id: 'attending', label: 'Events I am attending', items: attending, empty: 'Join an event with its invite code and it will appear here.' },
    { id: 'past', label: 'Past events', items: past, empty: 'Completed and cancelled events will appear here.' },
  ]
  const selectedTab = tabs.find(tab => tab.id === activeTab)!

  function selectTab(tab: EventTabId) {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'organised') params.delete('tab')
    else params.set('tab', tab)
    const query = params.toString()
    router.replace(query ? `/account/events?${query}` : '/account/events', { scroll: false })
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return

    event.preventDefault()
    selectTab(tabs[nextIndex].id)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
  }

  function closeJoinDialog() {
    setJoinDialogOpen(false)
    if (!initialJoinCode) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('joinCode')
    const query = params.toString()
    router.replace(query ? `/account/events?${query}` : '/account/events', { scroll: false })
  }

  return <div className="tshelo-dashboard">
    <section className="member-pagehead"><div><h1>My <em>events</em></h1></div><div className="member-page-actions"><button type="button" onClick={() => setJoinDialogOpen(true)}>Join with a code</button><Link className="primary" href={'/account/events/new' as Route}>Create an event</Link></div></section>
    {searchParams.get('joined') === '1' && <p className="member-success-note"><CircleCheck size={16} /> You joined the event successfully.</p>}
    {loading && <section className="card"><div className="member-empty">Loading your events…</div></section>}
    {error && <section className="card"><div className="member-api-state error"><p>{error}</p><button type="button" onClick={retry}><RefreshCw size={14} /> Try again</button></div></section>}
    {!loading && !error && <div className="fund-tabs-view">
      <div className="fund-tabbar">
        <div className="fund-tabs" role="tablist" aria-label="Event groups">
          {tabs.map((tab, index) => <button key={tab.id} id={`event-tab-${tab.id}`} className={`fund-tab ${tab.id === activeTab ? 'active' : ''}`} type="button" role="tab" aria-selected={tab.id === activeTab} aria-controls="event-panel" tabIndex={tab.id === activeTab ? 0 : -1} onClick={() => selectTab(tab.id)} onKeyDown={event => handleTabKeyDown(event, index)}><span>{tab.label}</span><b>{tab.items.length}</b></button>)}
        </div>
      </div>
      <section id="event-panel" className="card fund-tab-panel" role="tabpanel" aria-labelledby={`event-tab-${selectedTab.id}`} tabIndex={0}>
        <header className="fund-panel-heading"><h2>{selectedTab.label}</h2><span>{selectedTab.items.length} {selectedTab.items.length === 1 ? 'event' : 'events'}</span></header>
        <div className="body member-events-list">{selectedTab.items.map(item => <EventCard key={item.id} item={item} />)}{!selectedTab.items.length && <div className="member-empty">{selectedTab.empty}</div>}</div>
      </section>
    </div>}
    {showJoinDialog && <JoinEventDialog initialCode={initialJoinCode} onClose={closeJoinDialog} />}
  </div>
}
