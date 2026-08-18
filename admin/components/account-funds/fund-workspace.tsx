'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Activity, BadgeDollarSign, CircleCheck, Clipboard, RefreshCw, Settings, UsersRound } from 'lucide-react'
import type { FundMemberStatus, FundWorkspace, UpdateFundRequest, User } from '@shared/contracts'
import { StatusPill } from '@/components/status-pill'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { formatDate, formatMoney, titleCase } from '@/lib/format'

type WorkspaceData = { workspace: FundWorkspace; user: User }

function Summary({ data }: { data: WorkspaceData }) {
  const { fund } = data.workspace
  const progress = Number(fund.goal_amount) > 0 ? Math.min(100, Math.round((Number(fund.totals.raised) / Number(fund.goal_amount)) * 100)) : 0
  return (
    <section className="member-card">
      <div className="member-workspace-summary">
        <div className="member-workspace-emoji" aria-hidden="true">{fund.fund_emoji ?? '💜'}</div>
        <div className="member-workspace-copy"><span>{titleCase(fund.fund_type)} · {fund.fund_code}</span><h2>{fund.title}</h2><p>{fund.description || 'No description has been added yet.'}</p></div>
        <StatusPill value={fund.status} />
      </div>
      <div className="member-workspace-stats">
        <div><span>Raised</span><strong>{formatMoney(fund.totals.raised, fund.currency_code)}</strong></div>
        <div><span>Spent</span><strong>{formatMoney(fund.totals.spent, fund.currency_code)}</strong></div>
        <div><span>Balance</span><strong>{formatMoney(fund.totals.balance, fund.currency_code)}</strong></div>
        <div><span>Members</span><strong>{fund.totals.member_count}</strong></div>
      </div>
      <div className="member-workspace-progress"><div><span>{progress}% funded</span><span>{formatMoney(fund.goal_amount, fund.currency_code)} goal</span></div><div><i style={{ width: `${progress}%` }} /></div></div>
    </section>
  )
}

function MemberDirectory({ data, reload }: { data: WorkspaceData; reload: () => void }) {
  const { workspace } = data
  const isOwner = workspace.fund.owner_id === data.user.id
  const canManage = workspace.fund.status === 'active' && (isOwner || workspace.permissions.includes('manage_members'))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function changeMember(memberId: string, status: Extract<FundMemberStatus, 'joined' | 'declined' | 'removed'>) {
    setBusy(`${memberId}:${status}`)
    setError('')
    try {
      await createApiClient().funds.updateMember(workspace.fund.id, memberId, { status })
      setBusy('')
      reload()
    } catch (cause) {
      setError(apiErrorMessage(cause))
      setBusy('')
    }
  }

  return (
    <section className="member-card" id="members">
      <header><div className="member-section-title"><span><UsersRound size={18} /></span><h2>Members</h2></div><small>{workspace.members.length} total</small></header>
      <div className="member-card-body">
        <div className="member-directory">
          {workspace.members.map(member => (
            <article key={member.id}>
              <div className="member-directory-avatar">{member.display_name.slice(0, 2).toUpperCase()}</div>
              <div><strong>{member.display_name}</strong><p>{member.phone || 'Phone unavailable'} · {titleCase(member.role)}</p></div>
              <StatusPill value={member.status} />
              {canManage && member.user_id !== data.user.id && (
                <div className="member-inline-actions">
                  {member.status === 'pending' && <><button type="button" disabled={Boolean(busy)} onClick={() => changeMember(member.id, 'joined')}>{busy === `${member.id}:joined` ? 'Approving…' : 'Approve'}</button><button type="button" className="danger" disabled={Boolean(busy)} onClick={() => changeMember(member.id, 'declined')}>Decline</button></>}
                  {member.status === 'joined' && member.role !== 'owner' && <button type="button" className="danger" disabled={Boolean(busy)} onClick={() => changeMember(member.id, 'removed')}>{busy === `${member.id}:removed` ? 'Removing…' : 'Remove'}</button>}
                </div>
              )}
            </article>
          ))}
          {!workspace.members.length && <div className="member-empty">No members are listed yet.</div>}
        </div>
        {error && <p className="member-form-error" role="alert">{error}</p>}
      </div>
    </section>
  )
}

function SponsorshipBoard({ data, reload }: { data: WorkspaceData; reload: () => void }) {
  const { workspace, user } = data
  const isActive = workspace.fund.status === 'active'
  const canManage = isActive && (workspace.fund.owner_id === user.id || workspace.permissions.includes('manage_sponsorships'))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setBusy('create')
    setError('')
    try {
      await createApiClient().funds.createSponsorship(workspace.fund.id, {
        title: String(form.get('title') ?? '').trim(),
        category: String(form.get('category') ?? '').trim() || null,
        target_amount: String(form.get('target_amount') ?? '').trim(),
      })
      formElement.reset()
      setBusy('')
      reload()
    } catch (cause) {
      setError(apiErrorMessage(cause))
      setBusy('')
    }
  }

  async function claim(itemId: string, release = false) {
    setBusy(itemId)
    setError('')
    try {
      if (release) await createApiClient().funds.releaseSponsorship(workspace.fund.id, itemId)
      else await createApiClient().funds.claimSponsorship(workspace.fund.id, itemId)
      setBusy('')
      reload()
    } catch (cause) {
      setError(apiErrorMessage(cause))
      setBusy('')
    }
  }

  return (
    <section className="member-card" id="sponsorships">
      <header><div className="member-section-title"><span><BadgeDollarSign size={18} /></span><h2>Sponsorship board</h2></div></header>
      <div className="member-card-body">
        {canManage && (
          <form className="member-compact-form" onSubmit={createItem}>
            <label><span>Item</span><input name="title" required minLength={2} maxLength={200} placeholder="e.g. Venue deposit" /></label>
            <label><span>Category</span><input name="category" maxLength={100} placeholder="Venue" /></label>
            <label><span>Target amount</span><input name="target_amount" type="number" min="0.01" step="0.01" required /></label>
            <button type="submit" disabled={Boolean(busy)}>{busy === 'create' ? 'Adding…' : 'Add item'}</button>
          </form>
        )}
        <div className="member-sponsorship-grid">
          {workspace.sponsorship_items.map(item => (
            <article key={item.id}>
              <div><span>{item.category || 'Sponsorship'}</span><h3>{item.title}</h3><p>{formatMoney(item.outstanding_amount, workspace.fund.currency_code)} still needed</p></div>
              <div className="member-inline-actions">
                <StatusPill value={item.status} />
                {isActive && item.status === 'open' && <button type="button" disabled={Boolean(busy)} onClick={() => claim(item.id)}>{busy === item.id ? 'Claiming…' : 'Claim'}</button>}
                {isActive && item.status === 'claimed' && item.claimed_by_user_id === user.id && <button type="button" disabled={Boolean(busy)} onClick={() => claim(item.id, true)}>{busy === item.id ? 'Releasing…' : 'Release'}</button>}
              </div>
            </article>
          ))}
          {!workspace.sponsorship_items.length && <div className="member-empty">No sponsorship items have been added.</div>}
        </div>
        {error && <p className="member-form-error" role="alert">{error}</p>}
      </div>
    </section>
  )
}

function RecentMoneyActivity({ workspace }: { workspace: FundWorkspace }) {
  return (
    <section className="member-card" id="activity">
      <header><div className="member-section-title"><span><Activity size={18} /></span><h2>Fund activity</h2></div><Link href={{ pathname: '/account/contributions', query: { fund: workspace.fund.id } }}>All contributions</Link></header>
      <div className="member-card-body member-money-columns">
        <div><h3>Recent contributions</h3>{workspace.contributions.slice(0, 5).map(item => <article key={item.id}><div><strong>{item.contributor_name}</strong><span>{titleCase(item.status)} · {formatDate(item.created_at)}</span></div><b>{formatMoney(item.amount, workspace.fund.currency_code)}</b></article>)}{!workspace.contributions.length && <p>No contributions recorded.</p>}</div>
        <div><h3>Recent expenses</h3>{workspace.expenses.slice(0, 5).map(item => <article key={item.id}><div><strong>{item.description}</strong><span>{item.vendor_name || titleCase(item.category)} · {formatDate(item.created_at)}</span></div><b>{formatMoney(item.amount, workspace.fund.currency_code)}</b></article>)}{!workspace.expenses.length && <p>No expenses recorded.</p>}</div>
      </div>
    </section>
  )
}

function FundSettings({ data, reload }: { data: WorkspaceData; reload: () => void }) {
  const router = useRouter()
  const { workspace, user } = data
  const fund = workspace.fund
  const isOwner = fund.owner_id === user.id
  const canInvite = fund.status === 'active' && (isOwner || workspace.permissions.includes('manage_members'))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const inviteCode = fund.share_code || fund.fund_code

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const request: UpdateFundRequest = {
      title: String(form.get('title') ?? '').trim(), description: String(form.get('description') ?? '').trim() || null,
      goal_amount: String(form.get('goal_amount') ?? '').trim() || null, contribution_deadline: String(form.get('contribution_deadline') ?? '') || null,
      is_private: form.get('is_private') === 'on',
    }
    setBusy('save'); setError('')
    try { await createApiClient().funds.update(fund.id, request); setBusy(''); reload() }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }

  async function toggleClosed() {
    const closing = fund.status !== 'closed'
    if (closing && !window.confirm('Close this fund? Members will still be able to view its history.')) return
    setBusy('status'); setError('')
    try { await createApiClient().funds.update(fund.id, { status: closing ? 'closed' : 'active' }); setBusy(''); reload() }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }

  async function leaveFund() {
    if (!window.confirm('Leave this fund? You will need a new invite to rejoin.')) return
    setBusy('leave'); setError('')
    try { await createApiClient().funds.leave(fund.id); router.replace('/account/funds') }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('The invite code could not be copied. Select and copy it manually.')
    }
  }

  return (
    <section className="member-card" id="settings">
      <header><div className="member-section-title"><span><Settings size={18} /></span><h2>{isOwner ? 'Fund settings' : 'Membership'}</h2></div></header>
      <div className="member-card-body">
        {canInvite && <div className="member-invite-code"><div><span>Invite code</span><strong>{inviteCode}</strong><small>{fund.is_private ? 'New members require approval.' : 'Anyone with this code can join.'}</small></div><button type="button" onClick={copyInvite}><Clipboard size={14} /> {copied ? 'Copied' : 'Copy code'}</button></div>}
        {isOwner ? (
          <form className="member-form member-settings-form" onSubmit={save}>
            <div className="member-form-grid">
              <label className="wide"><span>Fund name</span><input name="title" required minLength={3} maxLength={200} defaultValue={fund.title} /></label>
              <label><span>Goal amount</span><input name="goal_amount" type="number" min="0" step="0.01" defaultValue={fund.goal_amount ?? ''} /></label>
              <label><span>Contribution deadline</span><input name="contribution_deadline" type="date" defaultValue={fund.contribution_deadline ?? ''} /></label>
              <label className="wide"><span>Description</span><textarea name="description" rows={4} maxLength={4000} defaultValue={fund.description ?? ''} /></label>
            </div>
            <label className="member-check"><input type="checkbox" name="is_private" defaultChecked={fund.is_private} /><span><strong>Private fund</strong>Require organiser approval for new join requests.</span></label>
            <div className="member-form-actions"><button type="button" className="danger" onClick={toggleClosed} disabled={Boolean(busy)}>{busy === 'status' ? 'Updating…' : fund.status === 'closed' ? 'Reopen fund' : 'Close fund'}</button><button type="submit" className="primary" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button></div>
          </form>
        ) : <div className="member-form-actions"><button type="button" className="danger" onClick={leaveFund} disabled={Boolean(busy)}>{busy === 'leave' ? 'Leaving…' : 'Leave fund'}</button></div>}
        {error && <p className="member-form-error" role="alert">{error}</p>}
      </div>
    </section>
  )
}

export function FundWorkspaceView({ fundId }: { fundId: string }) {
  const searchParams = useSearchParams()
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => {
    setError('')
    setVersion(value => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      runApiRead(call => createApiClient().funds.workspace(fundId, call), controller.signal),
      runApiRead(call => createApiClient().users.me(call), controller.signal),
    ]).then(([workspace, user]) => setData({ workspace, user }))
      .catch(cause => { const message = apiErrorMessage(cause); if (message) setError(message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [fundId, version])

  const notice = useMemo(() => {
    if (searchParams.get('created') === '1') return 'Fund created. Share the invite code when you are ready.'
    if (searchParams.get('joined') === '1') return 'You joined this fund successfully.'
    return ''
  }, [searchParams])

  if (loading) return <section className="member-card"><div className="member-empty">Loading fund workspace…</div></section>
  if (!data) return <section className="member-card"><div className="member-api-state error"><p>{error || 'This fund could not be loaded.'}</p><div><button type="button" onClick={reload}><RefreshCw size={14} /> Try again</button><Link href="/account/funds">Back to funds</Link></div></div></section>

  return (
    <>
      <section className="member-pagehead">
        <div><Link className="member-back-link" href="/account/funds">← My funds</Link><h1>Fund <em>workspace</em></h1><p>Manage the fund, its members, sponsorship needs, and activity.</p></div>
        <nav className="member-page-actions" aria-label="Fund workspace sections"><a href="#members">Members</a><a href="#sponsorships">Sponsorships</a><a href="#settings">Settings</a></nav>
      </section>
      {notice && <p className="member-success-note"><CircleCheck size={16} /> {notice}</p>}
      {error && <p className="member-form-error" role="alert">{error}</p>}
      <Summary data={data} />
      <RecentMoneyActivity workspace={data.workspace} />
      <MemberDirectory data={data} reload={reload} />
      <SponsorshipBoard data={data} reload={reload} />
      <FundSettings data={data} reload={reload} />
    </>
  )
}
