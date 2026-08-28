'use client'

import { useCallback, useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Award, CircleCheck, DollarSign, Download, Eye, History, LayoutGrid, List, RefreshCw, UserPlus, Users } from 'lucide-react'
import type { HomeSummaryItem } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { formatDate, formatMoney, titleCase } from '@/lib/format'
import { invalidateHomeSummary, loadHomeSummary } from '@/lib/home-summary-cache'
import { InviteMembersDialog } from './invite-members-dialog'
import { JoinFundDialog } from './join-fund-dialog'

type FundTabId = 'organised' | 'member' | 'closed'

function FundCard({ item, inviting, onInvite }: { item: HomeSummaryItem; inviting: boolean; onInvite: (item: HomeSummaryItem) => void }) {
  const router = useRouter()
  const isClosed = item.status === 'closed' || item.status === 'completed' || item.status === 'cancelled'
  const progress = Number(item.goal_amount) > 0
    ? Math.min(100, Math.round((Number(item.total_contributions) / Number(item.goal_amount)) * 100))
    : 0
  const role = item.role === 'owner' ? 'Organiser' : titleCase(item.role)

  const detail = isClosed
    ? `${formatMoney(item.total_contributions, item.currency_code)} raised`
    : item.kind === 'eventFund'
      ? 'Linked to an event'
      : item.contribution_deadline
        ? `Closes ${formatDate(item.contribution_deadline)}`
        : `Created ${formatDate(item.created_at)}`

  function openFund() {
    if (item.fund_id) router.push(`/account/funds/${item.fund_id}`)
  }

  function handleCardClick(event: MouseEvent<HTMLElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('a,button')) return
    openFund()
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('a,button')) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openFund()
  }

  return (
    <article className="fund" role="link" tabIndex={0} aria-label={`Open ${item.title}`} onClick={handleCardClick} onKeyDown={handleCardKeyDown}>
      <div className="fh">
        <div>
          <div className="nm">{item.title}</div>
          <div className="meta">{item.member_count} member{item.member_count === 1 ? '' : 's'} · {item.contribution_count} contribution{item.contribution_count === 1 ? '' : 's'}</div>
          <div className="tagrow"><span className={`tagpill ${isClosed ? 'green' : ''}`}>{detail}</span></div>
        </div>
        <span className={`tag ${isClosed ? 'closed' : item.role === 'owner' ? 'org' : 'mem'}`}>{isClosed ? 'Closed' : role}</span>
      </div>
      {!isClosed && <div className="prog">
        <div className="nums"><span><b>{formatMoney(item.total_contributions, item.currency_code)}</b> raised</span><span>of {formatMoney(item.goal_amount, item.currency_code)}</span></div>
        <div className="track" aria-label={`${progress}% of fund goal`}><i style={{ width: `${progress}%` }} /></div>
      </div>}
      <div className="actions">
        {item.role === 'owner' && !isClosed ? (
          <>
            <Link className="btn sm" href={`/account/funds/${item.fund_id}#contributions` as Route}>Record a contribution</Link>
            <button className="btn ghost sm" type="button" disabled={inviting} onClick={() => onInvite(item)}>{inviting ? 'Opening…' : 'Invite members'}</button>
            <Link className="btn ghost sm" href={`/account/funds/${item.fund_id}#recognition` as Route}>Add Rich Auntie</Link>
            <Link className="btn ghost sm" href={`/account/funds/${item.fund_id}#members` as Route}>View members</Link>
          </>
        ) : (
          <>
            <Link className="btn ghost sm" href={`/account/funds/${item.fund_id}` as Route}>{isClosed ? 'View audit trail' : 'View fund'}</Link>
            <Link className="btn ghost sm" href={isClosed ? `/account/funds/${item.fund_id}#history` as Route : `/account/funds/${item.fund_id}?tab=contributions` as Route}>{isClosed ? 'Download final audit report' : 'See all contributions'}</Link>
          </>
        )}
      </div>
    </article>
  )
}

function FundListRow({ item, inviting, onInvite }: { item: HomeSummaryItem; inviting: boolean; onInvite: (item: HomeSummaryItem) => void }) {
  const router = useRouter()
  const isClosed = item.status === 'closed' || item.status === 'completed' || item.status === 'cancelled'
  const role = item.role === 'owner' ? 'Organiser' : titleCase(item.role)
  const status = isClosed ? 'Closed' : role
  const statusClass = isClosed ? 'closed' : item.role === 'owner' ? 'org' : 'mem'
  const fundHref = `/account/funds/${item.fund_id}` as Route

  function openFund() {
    if (item.fund_id) router.push(`/account/funds/${item.fund_id}`)
  }

  function handleRowClick(event: MouseEvent<HTMLElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('a,button')) return
    openFund()
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('a,button')) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openFund()
  }

  return (
    <article className="fund-list-row" role="link" tabIndex={0} aria-label={`Open ${item.title}`} onClick={handleRowClick} onKeyDown={handleRowKeyDown}>
      <div className="fund-list-status"><span className={`tag ${statusClass}`}><i />{status}</span></div>
      <Link className="fund-list-identity" href={fundHref}>
        <span className="fund-list-icon" aria-hidden="true">{item.emoji}</span>
        <span>
          <strong>{item.title}</strong>
          <small>{item.contribution_count} contribution{item.contribution_count === 1 ? '' : 's'} · {item.category}</small>
        </span>
      </Link>
      <div className="fund-list-stat"><strong>{item.member_count}</strong></div>
      <div className="fund-list-stat"><strong>{formatMoney(item.total_contributions, item.currency_code)}</strong></div>
      <div className="fund-list-actions">
        {item.role === 'owner' && !isClosed ? (
          <>
            <Link href={`${fundHref}#contributions` as Route} aria-label={`Record a contribution for ${item.title}`} data-tooltip="Record a contribution"><DollarSign aria-hidden="true" /></Link>
            <button type="button" disabled={inviting} onClick={() => onInvite(item)} aria-label={`Invite members to ${item.title}`} data-tooltip="Invite members"><UserPlus aria-hidden="true" /></button>
            <Link href={`${fundHref}#recognition` as Route} aria-label={`Add Rich Auntie recognition for ${item.title}`} data-tooltip="Add Rich Auntie"><Award aria-hidden="true" /></Link>
            <Link href={`${fundHref}#members` as Route} aria-label={`View members of ${item.title}`} data-tooltip="View members"><Users aria-hidden="true" /></Link>
          </>
        ) : (
          <>
            <Link href={fundHref} aria-label={`View ${item.title}`} data-tooltip="View fund"><Eye aria-hidden="true" /></Link>
            <Link href={`${fundHref}${isClosed ? '#history' : '#contributions'}` as Route} aria-label={`${isClosed ? 'Download the final audit report for' : 'View contributions to'} ${item.title}`} data-tooltip={isClosed ? 'Final audit report' : 'View contributions'}>{isClosed ? <Download aria-hidden="true" /> : <History aria-hidden="true" />}</Link>
          </>
        )}
      </div>
    </article>
  )
}

export function FundList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [funds, setFunds] = useState<HomeSummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [inviting, setInviting] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [invite, setInvite] = useState<{ code: string; fundTitle: string; memberCount: number } | null>(null)
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)

  const retry = useCallback(() => {
    setLoading(true)
    setError('')
    setReload(value => value + 1)
  }, [])

  useEffect(() => {
    let active = true
    if (reload > 0) invalidateHomeSummary()
    loadHomeSummary()
      .then(summary => {
        if (active) setFunds(summary.items.filter(item => Boolean(item.fund_id)))
      })
      .catch(cause => {
        const message = apiErrorMessage(cause)
        if (active && message) setError(message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [reload])

  const active = funds.filter(item => item.status !== 'closed' && item.status !== 'completed' && item.status !== 'cancelled')
  const organised = active.filter(item => item.role === 'owner')
  const joined = active.filter(item => item.role !== 'owner')
  const closed = funds.filter(item => !active.includes(item))
  const requestedTab = searchParams.get('tab')
  const initialJoinCode = searchParams.get('joinCode')?.trim().toUpperCase() ?? ''
  const showJoinDialog = joinDialogOpen || Boolean(initialJoinCode)
  const activeTab: FundTabId = requestedTab === 'member' || requestedTab === 'closed' ? requestedTab : 'organised'
  const viewMode = searchParams.get('view') === 'list' ? 'list' : 'grid'
  const tabs: Array<{ id: FundTabId; label: string; items: HomeSummaryItem[]; empty: string }> = [
    { id: 'organised', label: 'Funds I organise', items: organised, empty: 'You are not organising any active funds yet.' },
    { id: 'member', label: "Funds I'm a part of", items: joined, empty: 'Join a fund with an invite code and it will appear here.' },
    { id: 'closed', label: 'Closed funds', items: closed, empty: 'Closed funds will appear here.' },
  ]
  const selectedTab = tabs.find(tab => tab.id === activeTab)!

  function selectTab(tab: FundTabId) {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'organised') params.delete('tab')
    else params.set('tab', tab)
    const query = params.toString()
    router.replace(query ? `/account/funds?${query}` : '/account/funds', { scroll: false })
  }

  function toggleView() {
    const params = new URLSearchParams(searchParams.toString())
    if (viewMode === 'list') params.delete('view')
    else params.set('view', 'list')
    const query = params.toString()
    router.replace(query ? `/account/funds?${query}` : '/account/funds', { scroll: false })
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

  async function openInvite(item: HomeSummaryItem) {
    if (!item.fund_id) return
    setInviting(item.fund_id)
    setInviteError('')
    try {
      const workspace = await runApiRead(call => createApiClient().funds.workspace(item.fund_id!, call))
      setInvite({
        code: workspace.fund.share_code || workspace.fund.fund_code,
        fundTitle: workspace.fund.title,
        memberCount: workspace.fund.totals.member_count,
      })
    } catch (cause) {
      setInviteError(apiErrorMessage(cause))
    } finally {
      setInviting('')
    }
  }

  function closeJoinDialog() {
    setJoinDialogOpen(false)
    if (!initialJoinCode) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('joinCode')
    const query = params.toString()
    router.replace(query ? `/account/funds?${query}` : '/account/funds', { scroll: false })
  }

  return (
    <div className="tshelo-dashboard">
      <section className="pagehead">
        <div>
          <h1>My <em>funds</em></h1>
        </div>
        <div className="member-page-actions">
          <button type="button" onClick={() => setJoinDialogOpen(true)}>Join with a code</button>
          <Link className="primary" href={'/account/funds/new' as Route}>Create a fund</Link>
        </div>
      </section>

      {searchParams.get('join') === 'pending' && <p className="member-success-note"><CircleCheck size={16} /> Your request was sent to the fund organiser for approval.</p>}
      {inviteError && <p className="member-form-error funds-invite-error" role="alert">{inviteError}</p>}

      {loading && <section className="card"><div className="member-empty">Loading your funds…</div></section>}
      {error && (
        <section className="card"><div className="member-api-state error"><p>{error}</p><button type="button" onClick={retry}><RefreshCw size={14} /> Try again</button></div></section>
      )}
      {!loading && !error && (
        <div className="fund-tabs-view">
          <div className="fund-tabbar">
            <div className="fund-tabs" role="tablist" aria-label="Fund groups">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  id={`fund-tab-${tab.id}`}
                  className={`fund-tab ${tab.id === activeTab ? 'active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={tab.id === activeTab}
                  aria-controls="fund-panel"
                  tabIndex={tab.id === activeTab ? 0 : -1}
                  onClick={() => selectTab(tab.id)}
                  onKeyDown={event => handleTabKeyDown(event, index)}
                >
                  <span>{tab.label}</span>
                  <b>{tab.items.length}</b>
                </button>
              ))}
            </div>
          </div>
          <section
            id="fund-panel"
            className="card fund-tab-panel"
            role="tabpanel"
            aria-labelledby={`fund-tab-${selectedTab.id}`}
            tabIndex={0}
          >
            <header className="fund-panel-heading">
              <h2>{selectedTab.label}</h2>
              <span>{selectedTab.items.length} {selectedTab.items.length === 1 ? 'fund' : 'funds'}</span>
              <button
                className="fund-view-toggle"
                type="button"
                aria-label={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
                aria-pressed={viewMode === 'list'}
                title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
                onClick={toggleView}
              >
                {viewMode === 'grid' ? <List aria-hidden="true" /> : <LayoutGrid aria-hidden="true" />}
              </button>
            </header>
            <div className="body">
              {viewMode === 'list' ? (
                <div className="fund-list" role="list">
                  <div className="fund-list-head" aria-hidden="true"><span>Status</span><span>Fund</span><span>Members</span><span>Raised</span><span>Actions</span></div>
                  {selectedTab.items.map(item => <FundListRow key={item.id} item={item} inviting={inviting === item.fund_id} onInvite={openInvite} />)}
                  {!selectedTab.items.length && <div className="member-empty">{selectedTab.empty}</div>}
                </div>
              ) : (
                <div className="fundgrid">
                  {selectedTab.items.map(item => <FundCard key={item.id} item={item} inviting={inviting === item.fund_id} onInvite={openInvite} />)}
                  {!selectedTab.items.length && <div className="member-empty">{selectedTab.empty}</div>}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {invite && <InviteMembersDialog {...invite} onClose={() => setInvite(null)} />}
      {showJoinDialog && <JoinFundDialog initialCode={initialJoinCode} onClose={closeJoinDialog} />}
    </div>
  )
}
