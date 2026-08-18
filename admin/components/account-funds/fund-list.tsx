'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CircleCheck, CircleCheckBig, HandCoins, RefreshCw, UsersRound } from 'lucide-react'
import type { HomeSummaryItem } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { formatDate, formatMoney, titleCase } from '@/lib/format'

function FundCard({ item }: { item: HomeSummaryItem }) {
  const progress = Number(item.goal_amount) > 0
    ? Math.min(100, Math.round((Number(item.total_contributions) / Number(item.goal_amount)) * 100))
    : 0
  const role = item.role === 'owner' ? 'Organiser' : titleCase(item.role)

  return (
    <article className="member-funds-card">
      <div className="member-funds-card-head">
        <div>
          <h3><span aria-hidden="true">{item.emoji}</span> {item.title}</h3>
          <p>{item.category} · Created {formatDate(item.created_at)}</p>
          <span className="member-funds-detail">{item.member_count} member{item.member_count === 1 ? '' : 's'}</span>
        </div>
        <span className={`member-funds-role ${item.status === 'closed' ? 'closed' : item.role === 'owner' ? 'organiser' : 'member'}`}>{item.status === 'closed' ? 'Closed' : role}</span>
      </div>
      <div className="member-fund-progress">
        <div><span><strong>{formatMoney(item.total_contributions, item.currency_code)}</strong> raised</span><span>of {formatMoney(item.goal_amount, item.currency_code)}</span></div>
        <div className="member-fund-track" aria-label={`${progress}% of fund goal`}><i style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="member-fund-actions">
        <Link className="primary" href={`/account/funds/${item.fund_id}` as Route}>{item.status === 'closed' ? 'View archive' : 'Manage fund'}</Link>
        <Link href={{ pathname: '/account/contributions', query: { fund: item.fund_id } }}>Contributions</Link>
      </div>
    </article>
  )
}

function FundSection({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: HomeSummaryItem[]; empty: string }) {
  return (
    <section className="member-card">
      <header><div className="member-section-title"><span>{icon}</span><h2>{title}</h2></div></header>
      <div className="member-card-body member-funds-grid">
        {items.map(item => <FundCard key={item.id} item={item} />)}
        {!items.length && <div className="member-empty">{empty}</div>}
      </div>
    </section>
  )
}

export function FundList() {
  const searchParams = useSearchParams()
  const [funds, setFunds] = useState<HomeSummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  const retry = useCallback(() => {
    setLoading(true)
    setError('')
    setReload(value => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    runApiRead(call => createApiClient().home.summary(call), controller.signal)
      .then(summary => setFunds(summary.items.filter(item => Boolean(item.fund_id))))
      .catch(cause => {
        const message = apiErrorMessage(cause)
        if (message) setError(message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reload])

  const active = funds.filter(item => item.status !== 'closed' && item.status !== 'completed' && item.status !== 'cancelled')
  const organised = active.filter(item => item.role === 'owner')
  const joined = active.filter(item => item.role !== 'owner')
  const closed = funds.filter(item => !active.includes(item))

  return (
    <>
      <section className="member-pagehead">
        <div>
          <h1>My <em>funds</em></h1>
          <p>Create, join, and manage your funds from the same secure workspace used by the app.</p>
        </div>
        <div className="member-page-actions">
          <Link href={'/account/funds/join' as Route}>Join with a code</Link>
          <Link className="primary" href={'/account/funds/new' as Route}>Create a fund</Link>
        </div>
      </section>

      {searchParams.get('join') === 'pending' && <p className="member-success-note"><CircleCheck size={16} /> Your request was sent to the fund organiser for approval.</p>}

      {loading && <section className="member-card"><div className="member-empty">Loading your funds…</div></section>}
      {error && (
        <section className="member-card"><div className="member-api-state error"><p>{error}</p><button type="button" onClick={retry}><RefreshCw size={14} /> Try again</button></div></section>
      )}
      {!loading && !error && (
        <>
          <FundSection title="Funds I organise" icon={<HandCoins size={18} />} items={organised} empty="You are not organising any active funds yet." />
          <FundSection title="Funds I belong to" icon={<UsersRound size={18} />} items={joined} empty="Join a fund with an invite code and it will appear here." />
          <FundSection title="Closed funds" icon={<CircleCheckBig size={18} />} items={closed} empty="Closed funds will appear here." />
        </>
      )}
    </>
  )
}
