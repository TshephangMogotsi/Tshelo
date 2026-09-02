'use client'

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, RefreshCw, UsersRound, X } from 'lucide-react'
import type { HomeSummaryItem } from '@shared/contracts'
import { apiErrorMessage } from '@/lib/api-ui'
import { titleCase } from '@/lib/format'
import { invalidateHomeSummary, loadHomeSummary } from '@/lib/home-summary-cache'
import { JoinEventDialog } from './join-event-dialog'

type EventTabId = 'organised' | 'attending' | 'past'
type EventFundView = 'organised' | 'member' | 'past'

const calendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function localDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function defaultCalendarMonth(items: HomeSummaryItem[]) {
  const nextDatedEvent = items.find(item => item.event_date)?.event_date
  return nextDatedEvent ? startOfMonth(localDate(nextDatedEvent)) : startOfMonth(new Date())
}

function EventCalendar({ items, month, selectedDate, onMonthChange, onSelectDate }: { items: HomeSummaryItem[]; month: Date; selectedDate: string | null; onMonthChange: (month: Date) => void; onSelectDate: (date: string) => void }) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - firstDay.getDay())
  const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index))
  const today = dateKey(new Date())
  const eventCounts = new Map<string, number>()

  for (const item of items) {
    if (!item.event_date) continue
    eventCounts.set(item.event_date, (eventCounts.get(item.event_date) ?? 0) + 1)
  }

  const monthLabel = new Intl.DateTimeFormat('en-BW', { month: 'long', year: 'numeric' }).format(month)

  return (
    <aside className="member-event-calendar" aria-label="Event calendar">
      <header>
        <div><span>Schedule</span><h3>{monthLabel}</h3></div>
        <div className="member-event-calendar-nav">
          <button type="button" aria-label="Previous month" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft aria-hidden="true" /></button>
          <button type="button" aria-label="Next month" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight aria-hidden="true" /></button>
        </div>
      </header>
      <div className="member-event-calendar-weekdays" aria-hidden="true">{calendarWeekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className="member-event-calendar-grid" aria-label={`Events in ${monthLabel}`}>
        {days.map(day => {
          const key = dateKey(day)
          const eventCount = eventCounts.get(key) ?? 0
          const outsideMonth = day.getMonth() !== month.getMonth()
          const label = `${day.toLocaleDateString('en-BW', { weekday: 'long', day: 'numeric', month: 'long' })}${eventCount ? `, ${eventCount} event${eventCount === 1 ? '' : 's'}` : ''}`
          return <button key={key} type="button" className={`member-event-calendar-day${outsideMonth ? ' outside' : ''}${key === today ? ' today' : ''}${eventCount ? ' has-event' : ''}${key === selectedDate ? ' selected' : ''}`} aria-label={label} aria-pressed={key === selectedDate} onClick={() => onSelectDate(key)}><time dateTime={key}>{day.getDate()}</time>{eventCount > 0 && <i aria-hidden="true">{eventCount}</i>}</button>
        })}
      </div>
      <p><i aria-hidden="true" /> Event days are marked in purple.</p>
    </aside>
  )
}

function EventRow({ item }: { item: HomeSummaryItem }) {
  const eventId = item.event_id ?? item.id
  const isActive = item.status === 'active'
  const schedule = item.event_date
    ? new Intl.DateTimeFormat('en-BW', { day: 'numeric', month: 'short', year: 'numeric' }).format(localDate(item.event_date))
    : 'Date to be confirmed'
  const guestLabel = `${item.guest_count} guest${item.guest_count === 1 ? '' : 's'}`
  const detail = `${item.category} · ${item.venue_name || 'Venue to be confirmed'}`

  return (
    <Link className="member-event-row" href={`/account/events/${eventId}` as Route} aria-label={`Open details for ${item.title}`}>
      <span className={`member-event-row-marker${isActive ? ' active' : ''}`} aria-hidden="true" />
      <div className="member-event-row-copy">
        <h3>{item.title}</h3>
        <p>{detail}</p>
      </div>
      <div className="member-event-row-schedule"><CalendarDays aria-hidden="true" /><span>{schedule}</span></div>
      <div className="member-event-row-guests"><UsersRound aria-hidden="true" /><span>{guestLabel}</span></div>
      <span className={`member-event-row-status${isActive ? ' active' : ''}`}>{isActive ? 'Upcoming' : titleCase(item.status)}</span>
    </Link>
  )
}

function EventListWorkspace({ items, empty }: { items: HomeSummaryItem[]; empty: string }) {
  const [calendarMonth, setCalendarMonth] = useState(() => defaultCalendarMonth(items))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const filteredItems = selectedDate ? items.filter(item => item.event_date === selectedDate) : items
  const selectedDateLabel = selectedDate
    ? new Intl.DateTimeFormat('en-BW', { day: 'numeric', month: 'long', year: 'numeric' }).format(localDate(selectedDate))
    : null

  function selectDate(date: string) {
    setSelectedDate(current => current === date ? null : date)
  }

  return (
    <div className="member-events-workspace">
      <div className="member-events-list" role="list">
        {selectedDateLabel && <div className="member-events-filter"><span>{selectedDateLabel}</span><button type="button" aria-label="Clear calendar filter" onClick={() => setSelectedDate(null)}><X aria-hidden="true" /></button></div>}
        {filteredItems.map(item => <EventRow key={item.id} item={item} />)}
        {!filteredItems.length && <div className="member-empty member-events-empty">{selectedDateLabel ? `No events are scheduled for ${selectedDateLabel}.` : empty}</div>}
      </div>
      <EventCalendar items={items} month={calendarMonth} selectedDate={selectedDate} onMonthChange={setCalendarMonth} onSelectDate={selectDate} />
    </div>
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
  const [eventFundView, setEventFundView] = useState<EventFundView>('organised')
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
  const eventFunds = events.filter(item => item.kind === 'eventFund')
  const activeEventFunds = eventFunds.filter(item => item.status === 'active')
  const eventOnly = active.filter(item => item.kind !== 'eventFund')
  const organised = eventOnly.filter(item => item.role === 'organiser' || item.role === 'owner')
  const attending = eventOnly.filter(item => item.role !== 'organiser' && item.role !== 'owner')
  const past = events.filter(item => item.kind !== 'eventFund' && item.status !== 'active')
  const eventFundTabs: Array<{ id: EventFundView; label: string; items: HomeSummaryItem[]; empty: string }> = [
    { id: 'organised', label: 'Event + Funds I organise', items: activeEventFunds.filter(item => item.role === 'organiser' || item.role === 'owner'), empty: 'Create an Event + Fund to manage its shared contributions and budget.' },
    { id: 'member', label: 'Event + Funds I’m part of', items: activeEventFunds.filter(item => item.role !== 'organiser' && item.role !== 'owner'), empty: 'Event + Funds you join will appear here.' },
    { id: 'past', label: 'Past Event + Funds', items: eventFunds.filter(item => item.status !== 'active'), empty: 'Completed and closed Event + Funds will appear here.' },
  ]
  const requestedTab = searchParams.get('tab')
  const initialJoinCode = searchParams.get('joinCode')?.trim() ?? ''
  const showJoinDialog = joinDialogOpen || Boolean(initialJoinCode)
  const showEventFundDashboard = requestedTab === 'eventFund'
  const activeTab: EventTabId = requestedTab === 'attending' || requestedTab === 'past' ? requestedTab : 'organised'
  const tabs: Array<{ id: EventTabId; label: string; items: HomeSummaryItem[]; empty: string }> = [
    { id: 'organised', label: 'Events I organise', items: organised, empty: 'You are not organising an active event yet.' },
    { id: 'attending', label: 'Events I am attending', items: attending, empty: 'Join an event with its invite code and it will appear here.' },
    { id: 'past', label: 'Past events', items: past, empty: 'Completed and cancelled events will appear here.' },
  ]
  const selectedTab = tabs.find(tab => tab.id === activeTab)!
  const selectedEventFundTab = eventFundTabs.find(tab => tab.id === eventFundView)!

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
    <section className="member-pagehead"><div><h1>{showEventFundDashboard ? <>Event + <em>Funds</em></> : <>My <em>events</em></>}</h1></div><div className="member-page-actions"><button type="button" onClick={() => setJoinDialogOpen(true)}>Join with a code</button><Link className="primary" href={(showEventFundDashboard ? '/account/events/new?mode=eventFund' : '/account/events/new') as Route}>{showEventFundDashboard ? 'Create Event + Fund' : 'Create an event'}</Link></div></section>
    {searchParams.get('joined') === '1' && <p className="member-success-note"><CircleCheck size={16} /> You joined the event successfully.</p>}
    {loading && <section className="card"><div className="member-empty">Loading your events…</div></section>}
    {error && <section className="card"><div className="member-api-state error"><p>{error}</p><button type="button" onClick={retry}><RefreshCw size={14} /> Try again</button></div></section>}
    {!loading && !error && showEventFundDashboard && <div className="fund-tabs-view">
      <div className="fund-tabbar">
        <div className="fund-tabs" role="tablist" aria-label="Event + Fund groups">
          {eventFundTabs.map(tab => <button key={tab.id} className={`fund-tab ${tab.id === eventFundView ? 'active' : ''}`} type="button" role="tab" aria-selected={tab.id === eventFundView} onClick={() => setEventFundView(tab.id)}><span>{tab.label}</span><b>{tab.items.length}</b></button>)}
        </div>
      </div>
      <section className="card fund-tab-panel" role="tabpanel">
        <header className="fund-panel-heading"><h2>{selectedEventFundTab.label}</h2><span>{selectedEventFundTab.items.length} {selectedEventFundTab.items.length === 1 ? 'event + fund' : 'event + funds'}</span></header>
        <div className="body"><EventListWorkspace key={`event-fund-${eventFundView}`} items={selectedEventFundTab.items} empty={selectedEventFundTab.empty} /></div>
      </section>
    </div>}
    {!loading && !error && !showEventFundDashboard && <div className="fund-tabs-view">
      <div className="fund-tabbar">
        <div className="fund-tabs" role="tablist" aria-label="Event groups">
          {tabs.map((tab, index) => <button key={tab.id} id={`event-tab-${tab.id}`} className={`fund-tab ${tab.id === activeTab ? 'active' : ''}`} type="button" role="tab" aria-selected={tab.id === activeTab} aria-controls="event-panel" tabIndex={tab.id === activeTab ? 0 : -1} onClick={() => selectTab(tab.id)} onKeyDown={event => handleTabKeyDown(event, index)}><span>{tab.label}</span><b>{tab.items.length}</b></button>)}
        </div>
      </div>
      <section id="event-panel" className="card fund-tab-panel" role="tabpanel" aria-labelledby={`event-tab-${selectedTab.id}`} tabIndex={0}>
        <header className="fund-panel-heading"><h2>{selectedTab.label}</h2><span>{selectedTab.items.length} {selectedTab.items.length === 1 ? 'event' : 'events'}</span></header>
        <div className="body"><EventListWorkspace key={`event-${activeTab}`} items={selectedTab.items} empty={selectedTab.empty} /></div>
      </section>
    </div>}
    {showJoinDialog && <JoinEventDialog initialCode={initialJoinCode} onClose={closeJoinDialog} />}
  </div>
}
