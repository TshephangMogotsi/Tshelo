'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Award, BadgeDollarSign, Check, CircleCheck, Copy, RefreshCw, Settings, Share2, UsersRound } from 'lucide-react'
import { isExpenseCategory, type FundMemberStatus, type FundSponsorshipItem, type FundWorkspace, type RichAuntieAward, type UpdateFundRequest, type User } from '@shared/contracts'
import { StatusPill } from '@/components/status-pill'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { formatDate, formatMoney, titleCase } from '@/lib/format'
import { invalidateHomeSummary } from '@/lib/home-summary-cache'
import { ExpenseCategoryPicker, FundContributions, FundExpenses } from './fund-finances'
import { FundOperations, FundRichAuntie } from './fund-operations'
import { InviteMembersDialog } from './invite-members-dialog'

type WorkspaceData = { workspace: FundWorkspace; user: User }
type WorkspaceTab = 'overview' | 'contributions' | 'expenses' | 'sponsorships' | 'rich-auntie' | 'activity' | 'members' | 'settings'

const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'contributions', label: 'Contributions' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'sponsorships', label: 'Sponsorships' },
  { id: 'rich-auntie', label: 'Rich Auntie' },
  { id: 'activity', label: 'Activity & reports' },
  { id: 'members', label: 'Members' },
  { id: 'settings', label: 'Settings' },
]

type OverviewActivity = {
  id: string
  kind: 'contribution' | 'expense' | 'refund'
  title: string
  detail: string
  amount: number | string
  createdAt: string
}

function Summary({ data, onViewActivity }: { data: WorkspaceData; onViewActivity: () => void }) {
  const { workspace, user } = data
  const { fund } = workspace
  const canInvite = fund.status === 'active' && (fund.owner_id === user.id || workspace.permissions.includes('manage_members'))
  const relativeInviteUrl = `/account/funds?joinCode=${encodeURIComponent(fund.fund_code)}`
  const [copied, setCopied] = useState<'code' | 'invite' | null>(null)
  const goal = Number(fund.goal_amount ?? 0)
  const raised = Number(fund.totals.raised)
  const progress = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0
  const remaining = Math.max(goal - raised, 0)
  const recentActivity = useMemo<OverviewActivity[]>(() => [
    ...workspace.contributions.map(contribution => ({
      id: `contribution-${contribution.id}`,
      kind: contribution.is_refunded ? 'refund' as const : 'contribution' as const,
      title: contribution.contributor_name || 'Anonymous contribution',
      detail: contribution.is_refunded ? 'Contribution refunded' : contribution.pledge_state === 'pledged' ? 'Pledge recorded' : 'Contribution recorded',
      amount: contribution.amount,
      createdAt: contribution.confirmed_at ?? contribution.created_at,
    })),
    ...workspace.expenses.map(expense => ({
      id: `expense-${expense.id}`,
      kind: 'expense' as const,
      title: expense.vendor_name || expense.description || 'Expense recorded',
      detail: expense.category ? `${expense.custom_category ?? titleCase(expense.category)} expense` : 'Expense recorded',
      amount: expense.amount,
      createdAt: expense.created_at,
    })),
  ].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)).slice(0, 5), [workspace.contributions, workspace.expenses])

  async function copy(value: string, target: 'code' | 'invite') {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(target)
      window.setTimeout(() => setCopied(current => current === target ? null : current), 1800)
    } catch {
      setCopied(null)
    }
  }

  return (
    <section className="member-card member-fund-overview">
      <div className="member-fund-overview-head">
        <div className="member-workspace-emoji" aria-hidden="true">{fund.fund_emoji ?? '💜'}</div>
        <div className="member-workspace-copy">
          <span>{titleCase(fund.fund_type)}</span>
          <h2>{fund.title}</h2>
          <p>{fund.description || 'No description has been added yet.'}</p>
        </div>
        <StatusPill value={fund.status} />
      </div>

      <div className="member-fund-overview-layout">
        <div className="member-fund-overview-metrics">
        <aside className="member-workspace-share-panel" aria-label="Share this fund">
          <div className="member-workspace-share-heading">
            <span aria-hidden="true"><Share2 size={15} /></span>
            <div><strong>Share this fund</strong><small>Send a quick code or a ready-to-use invitation link.</small></div>
          </div>
          <div className="member-workspace-invites">
            <div className="member-workspace-invite-detail">
              <div><span>Fund code</span><code>{fund.fund_code}</code></div>
              <button type="button" onClick={() => copy(fund.fund_code, 'code')} aria-label={copied === 'code' ? 'Fund code copied' : 'Copy fund code'} title={copied === 'code' ? 'Copied' : 'Copy fund code'}>
                {copied === 'code' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              </button>
            </div>
            {canInvite && <div className="member-workspace-invite-detail invite-link">
              <div><span>Invite link</span><code>{relativeInviteUrl}</code></div>
              <button type="button" onClick={() => copy(new URL(relativeInviteUrl, window.location.origin).toString(), 'invite')} aria-label={copied === 'invite' ? 'Invite link copied' : 'Copy invite link'} title={copied === 'invite' ? 'Copied' : 'Copy invite link'}>
                {copied === 'invite' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              </button>
            </div>}
          </div>
        </aside>

          <section className="member-fund-goal-card" aria-label="Fund goal">
            <div className="member-fund-goal-heading">
              <div><span>Fund goal</span><strong>{goal > 0 ? formatMoney(fund.goal_amount, fund.currency_code) : 'No goal set'}</strong></div>
              {goal > 0 && <b>{progress}% funded</b>}
            </div>
            {goal > 0 ? <>
              <div className="member-fund-goal-raised"><span>Raised so far</span><strong>{formatMoney(fund.totals.raised, fund.currency_code)}</strong></div>
              <div className="member-fund-goal-progress" aria-label={`${progress}% of goal funded`}><i style={{ width: `${progress}%` }} /></div>
              <dl className="member-fund-goal-details">
                <div><dt>Still needed</dt><dd>{formatMoney(remaining, fund.currency_code)}</dd></div>
                <div><dt>Deadline</dt><dd>{formatDate(fund.contribution_deadline)}</dd></div>
              </dl>
            </> : <p>Set a target in Settings to keep every contribution focused on what the fund needs.</p>}
          </section>

          <div className="member-fund-metric-grid" aria-label="Fund metrics">
            <article><span>Raised</span><strong>{formatMoney(fund.totals.raised, fund.currency_code)}</strong><small>{fund.totals.contribution_count} {fund.totals.contribution_count === 1 ? 'contribution' : 'contributions'}</small></article>
            <article><span>Spent</span><strong>{formatMoney(fund.totals.spent, fund.currency_code)}</strong><small>Recorded fund expenses</small></article>
            <article><span>Available</span><strong>{formatMoney(fund.totals.balance, fund.currency_code)}</strong><small>Ready to use</small></article>
            <article><span>Members</span><strong>{fund.totals.member_count}</strong><small>People in this fund</small></article>
          </div>
        </div>

        <aside className="member-fund-activity-card" aria-label="Recent activity">
          <div className="member-fund-activity-heading">
            <div><span>Live ledger</span><h3>Recent activity</h3></div>
            <button type="button" onClick={onViewActivity}>View all</button>
          </div>
          {recentActivity.length ? <ol className="member-fund-activity-list">
            {recentActivity.map(activity => <li key={activity.id}>
              <span className={`member-fund-activity-icon ${activity.kind}`} aria-hidden="true"><BadgeDollarSign size={15} /></span>
              <div>
                <strong>{activity.title}</strong>
                <p>{activity.detail}</p>
                <time dateTime={activity.createdAt}>{formatDate(activity.createdAt)}</time>
              </div>
              <b className={activity.kind}>{activity.kind === 'contribution' ? '+' : '−'}{formatMoney(activity.amount, fund.currency_code)}</b>
            </li>)}
          </ol> : <div className="member-fund-activity-empty"><BadgeDollarSign size={20} aria-hidden="true" /><strong>Your fund activity will appear here.</strong><p>Contributions and recorded expenses are shown together in date order.</p></div>}
        </aside>
      </div>
    </section>
  )
}

function MemberDirectory({ data, reload }: { data: WorkspaceData; reload: () => void }) {
  const { workspace } = data
  const isOwner = workspace.fund.owner_id === data.user.id
  const canManage = workspace.fund.status === 'active' && (isOwner || workspace.permissions.includes('manage_members'))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [awards, setAwards] = useState<RichAuntieAward[]>([])
  const awardsByRecipient = useMemo(() => awards.reduce((counts, award) => {
    counts.set(award.recipient_user_id, (counts.get(award.recipient_user_id) ?? 0) + 1)
    return counts
  }, new Map<string, number>()), [awards])

  useEffect(() => {
    const controller = new AbortController()
    runApiRead(call => createApiClient().richAuntie.listAwards({ fund_id: workspace.fund.id, limit: 100 }, call), controller.signal)
      .then(page => setAwards(page.items))
      .catch(() => { if (!controller.signal.aborted) setAwards([]) })
    return () => controller.abort()
  }, [workspace.fund.id])

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
          {workspace.members.map(member => {
            const awardCount = member.user_id ? awardsByRecipient.get(member.user_id) ?? 0 : 0
            return <article key={member.id}>
              <div className="member-directory-avatar">{member.display_name.slice(0, 2).toUpperCase()}</div>
              <div><div className="member-directory-name"><strong>{member.display_name}</strong>{awardCount > 0 && <span className="member-rich-auntie-badge" title={`${awardCount} Rich Auntie award${awardCount === 1 ? '' : 's'}`}><Award size={13} aria-hidden="true" /><span>Rich Auntie</span></span>}</div><p>{member.phone || 'Phone unavailable'} · {titleCase(member.role)}</p></div>
              <StatusPill value={member.status} />
              {canManage && member.user_id !== data.user.id && (
                <div className="member-inline-actions">
                  {member.status === 'pending' && <><button type="button" disabled={Boolean(busy)} onClick={() => changeMember(member.id, 'joined')}>{busy === `${member.id}:joined` ? 'Approving…' : 'Approve'}</button><button type="button" className="danger" disabled={Boolean(busy)} onClick={() => changeMember(member.id, 'declined')}>Decline</button></>}
                  {member.status === 'joined' && member.role !== 'owner' && <button type="button" className="danger" disabled={Boolean(busy)} onClick={() => changeMember(member.id, 'removed')}>{busy === `${member.id}:removed` ? 'Removing…' : 'Remove'}</button>}
                </div>
              )}
            </article>
          })}
          {!workspace.members.length && <div className="member-empty">No members are listed yet.</div>}
        </div>
        {error && <p className="member-form-error" role="alert">{error}</p>}
      </div>
    </section>
  )
}

function sponsorshipCategoryValue(category: string, customCategory: string) {
  return category === 'other' ? customCategory.trim() || null : category || null
}

function SponsorshipItemEditor({
  item,
  customCategories,
  busy,
  onCancel,
  onSave,
}: {
  item: FundSponsorshipItem
  customCategories: string[]
  busy: boolean
  onCancel: () => void
  onSave: (values: { title: string; description: string; category: string | null; targetAmount: string }) => void
}) {
  const existingCategory = item.category ?? ''
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [category, setCategory] = useState(isExpenseCategory(existingCategory) ? existingCategory : existingCategory ? 'other' : '')
  const [customCategory, setCustomCategory] = useState(isExpenseCategory(existingCategory) ? '' : existingCategory)
  const [targetAmount, setTargetAmount] = useState(item.target_amount)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave({ title: title.trim(), description: description.trim(), category: sponsorshipCategoryValue(category, customCategory), targetAmount })
  }

  return <form className="member-inline-editor" onSubmit={submit}>
    <label className="wide"><span>Item</span><input value={title} onChange={event => setTitle(event.target.value)} required minLength={2} maxLength={200} /></label>
    <div className="member-category-field"><span>Category</span><ExpenseCategoryPicker category={category} customCategory={customCategory} savedCustomCategories={customCategories} onCategoryChange={setCategory} onCustomCategoryChange={setCustomCategory} /></div>
    <label><span>Target</span><input value={targetAmount} onChange={event => setTargetAmount(event.target.value)} type="number" min="0.01" step="0.01" required /></label>
    <label className="wide"><span>Description</span><textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} maxLength={1000} /></label>
    <div className="member-form-actions wide"><button type="button" onClick={onCancel}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save item'}</button></div>
  </form>
}

function SponsorshipBoard({ data, reload }: { data: WorkspaceData; reload: () => void }) {
  const { workspace, user } = data
  const isActive = workspace.fund.status === 'active'
  const canManage = isActive && (workspace.fund.owner_id === user.id || workspace.permissions.includes('manage_sponsorships'))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newCustomCategory, setNewCustomCategory] = useState('')
  const customCategories = useMemo(() => Array.from(new Set([
    ...workspace.expenses.map(item => item.custom_category?.trim() ?? ''),
    ...workspace.sponsorship_items.map(item => item.category?.trim() ?? '').filter(item => item && !isExpenseCategory(item)),
  ].filter(Boolean))).sort((left, right) => left.localeCompare(right)), [workspace.expenses, workspace.sponsorship_items])

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const category = sponsorshipCategoryValue(newCategory, newCustomCategory)
    if (newCategory === 'other' && !category) { setError('Add a custom category or choose a listed category.'); return }
    setBusy('create')
    setError('')
    try {
      await createApiClient().funds.createSponsorship(workspace.fund.id, {
        title: String(form.get('title') ?? '').trim(),
        category,
        target_amount: String(form.get('target_amount') ?? '').trim(),
      })
      formElement.reset()
      setNewCategory('')
      setNewCustomCategory('')
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

  async function updateItem(itemId: string, values: { title: string; description: string; category: string | null; targetAmount: string }) {
    setBusy(itemId); setError('')
    try {
      await createApiClient().funds.updateSponsorship(workspace.fund.id, itemId, {
        title: values.title,
        description: values.description || null,
        category: values.category,
        target_amount: values.targetAmount,
      })
      setEditing(''); setBusy(''); reload()
    } catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }

  async function cancelItem(itemId: string) {
    if (!window.confirm('Cancel this sponsorship item? Existing financial records will remain in the fund history.')) return
    setBusy(itemId); setError('')
    try { await createApiClient().funds.updateSponsorship(workspace.fund.id, itemId, { status: 'cancelled' }); setBusy(''); reload() }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }

  return (
    <section className="member-card" id="sponsorships">
      <header><div className="member-section-title"><span><BadgeDollarSign size={18} /></span><h2>Sponsorship board</h2></div></header>
      <div className="member-card-body">
        {canManage && (
          <form className="member-compact-form" onSubmit={createItem}>
            <label><span>Item</span><input name="title" required minLength={2} maxLength={200} placeholder="e.g. Venue deposit" /></label>
            <div className="member-category-field"><span>Category</span><ExpenseCategoryPicker category={newCategory} customCategory={newCustomCategory} savedCustomCategories={customCategories} onCategoryChange={setNewCategory} onCustomCategoryChange={setNewCustomCategory} /></div>
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
                {canManage && item.status !== 'cancelled' && <button type="button" disabled={Boolean(busy)} onClick={() => setEditing(editing === item.id ? '' : item.id)}>Edit</button>}
                {canManage && !['fulfilled', 'cancelled'].includes(item.status) && <button type="button" className="danger" disabled={Boolean(busy)} onClick={() => cancelItem(item.id)}>Cancel item</button>}
              </div>
              {editing === item.id && <SponsorshipItemEditor item={item} customCategories={customCategories} busy={busy === item.id} onCancel={() => setEditing('')} onSave={values => updateItem(item.id, values)} />}
            </article>
          ))}
          {!workspace.sponsorship_items.length && <div className="member-empty">No sponsorship items have been added.</div>}
        </div>
        {error && <p className="member-form-error" role="alert">{error}</p>}
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
  const [inviteOpen, setInviteOpen] = useState(false)
  const inviteCode = fund.fund_code

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const request: UpdateFundRequest = {
      title: String(form.get('title') ?? '').trim(), description: String(form.get('description') ?? '').trim() || null,
      goal_amount: String(form.get('goal_amount') ?? '').trim() || null, contribution_deadline: String(form.get('contribution_deadline') ?? '') || null,
      is_private: form.get('is_private') === 'on',
    }
    setBusy('save'); setError('')
    try { await createApiClient().funds.update(fund.id, request); invalidateHomeSummary(); setBusy(''); reload() }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }

  async function toggleClosed() {
    const closing = fund.status !== 'closed'
    if (closing && !window.confirm('Close this fund? Members will still be able to view its history.')) return
    setBusy('status'); setError('')
    try { await createApiClient().funds.update(fund.id, { status: closing ? 'closed' : 'active' }); invalidateHomeSummary(); setBusy(''); reload() }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }

  async function leaveFund() {
    if (!window.confirm('Leave this fund? You will need a new invite to rejoin.')) return
    setBusy('leave'); setError('')
    try { await createApiClient().funds.leave(fund.id); invalidateHomeSummary(); router.replace('/account/funds') }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }

  async function deleteFund() {
    const confirmation = window.prompt(`Deleting this fund hides its financial records and cannot be undone. Type "${fund.title}" to continue.`)
    if (confirmation !== fund.title) return
    setBusy('delete'); setError('')
    try { await createApiClient().funds.remove(fund.id); invalidateHomeSummary(); router.replace('/account/funds') }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }

  return (
    <>
    <section className="member-card" id="settings">
      <header><div className="member-section-title"><span><Settings size={18} /></span><h2>{isOwner ? 'Fund settings' : 'Membership'}</h2></div>{canInvite && <button className="member-invite-trigger" type="button" onClick={() => setInviteOpen(true)}><UsersRound size={15} /> Invite members</button>}</header>
      <div className="member-card-body">
        {isOwner ? (
          <form className="member-form member-settings-form" onSubmit={save}>
            <div className="member-form-grid">
              <label className="wide"><span>Fund name</span><input name="title" required minLength={3} maxLength={200} defaultValue={fund.title} /></label>
              <label><span>Goal amount</span><input name="goal_amount" type="number" min="0" step="0.01" defaultValue={fund.goal_amount ?? ''} /></label>
              <label><span>Contribution deadline</span><input name="contribution_deadline" type="date" defaultValue={fund.contribution_deadline ?? ''} /></label>
              <label className="wide"><span>Description</span><textarea name="description" rows={4} maxLength={4000} defaultValue={fund.description ?? ''} /></label>
            </div>
            <label className="member-check"><input type="checkbox" name="is_private" defaultChecked={fund.is_private} /><span><strong>Private fund</strong>Require organiser approval for new join requests.</span></label>
            <div className="member-form-actions"><button type="button" className="danger" onClick={deleteFund} disabled={Boolean(busy)}>{busy === 'delete' ? 'Deleting…' : 'Delete fund'}</button><button type="button" className="danger" onClick={toggleClosed} disabled={Boolean(busy)}>{busy === 'status' ? 'Updating…' : fund.status === 'closed' ? 'Reopen fund' : 'Close fund'}</button><button type="submit" className="primary" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button></div>
          </form>
        ) : <div className="member-form-actions"><button type="button" className="danger" onClick={leaveFund} disabled={Boolean(busy)}>{busy === 'leave' ? 'Leaving…' : 'Leave fund'}</button></div>}
        {error && <p className="member-form-error" role="alert">{error}</p>}
      </div>
    </section>
    {inviteOpen && <InviteMembersDialog code={inviteCode} fundTitle={fund.title} memberCount={fund.totals.member_count} onClose={() => setInviteOpen(false)} />}
    </>
  )
}

export function FundWorkspaceView({ fundId }: { fundId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hashHandled = useRef(false)
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => {
    invalidateHomeSummary()
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

  useEffect(() => {
    if (hashHandled.current) return
    hashHandled.current = true
    const hashTab: Record<string, WorkspaceTab> = {
      contributions: 'contributions', expenses: 'expenses', members: 'members', sponsorships: 'sponsorships',
      permissions: 'activity', recognition: 'rich-auntie', 'rich-auntie': 'rich-auntie', history: 'activity', settings: 'settings',
    }
    const tab = hashTab[window.location.hash.slice(1)]
    if (!tab || searchParams.get('tab') === tab) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}` as never, { scroll: false })
    window.scrollTo(0, 0)
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (searchParams.get('tab') !== 'finances') return
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'contributions')
    router.replace(`${pathname}?${params.toString()}` as never, { scroll: false })
  }, [pathname, router, searchParams])

  const notice = useMemo(() => {
    if (searchParams.get('created') === '1') return 'Fund created. Share the invite code when you are ready.'
    if (searchParams.get('joined') === '1') return 'You joined this fund successfully.'
    return ''
  }, [searchParams])

  const requestedTab = searchParams.get('tab') === 'finances' ? 'contributions' : searchParams.get('tab')
  const activeTab: WorkspaceTab = workspaceTabs.some(tab => tab.id === requestedTab) ? requestedTab as WorkspaceTab : 'overview'

  function selectTab(tab: WorkspaceTab) {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'overview') params.delete('tab')
    else params.set('tab', tab)
    const query = params.toString()
    router.replace((query ? `${pathname}?${query}` : pathname) as never, { scroll: false })
  }

  if (loading) return <section className="member-card"><div className="member-empty">Loading fund workspace…</div></section>
  if (!data) return <section className="member-card"><div className="member-api-state error"><p>{error || 'This fund could not be loaded.'}</p><div><button type="button" onClick={reload}><RefreshCw size={14} /> Try again</button><Link href="/account/funds">Back to funds</Link></div></div></section>

  return (
    <>
      <section className="member-pagehead">
        <div>
          <nav className="fund-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/account/funds">My funds</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{data.workspace.fund.title}</span>
          </nav>
          <h1>Fund <em>workspace</em></h1>
        </div>
      </section>
      {notice && <p className="member-success-note"><CircleCheck size={16} /> {notice}</p>}
      {error && <p className="member-form-error" role="alert">{error}</p>}
      <div className="fund-workspace-tab-view">
        <nav className="fund-workspace-tabs" role="tablist" aria-label="Fund workspace sections">
          {workspaceTabs.map(tab => <button key={tab.id} id={`fund-workspace-tab-${tab.id}`} className={tab.id === activeTab ? 'active' : ''} type="button" role="tab" aria-selected={tab.id === activeTab} aria-controls="fund-workspace-panel" onClick={() => selectTab(tab.id)}>{tab.label}</button>)}
        </nav>
        <div id="fund-workspace-panel" role="tabpanel" aria-labelledby={`fund-workspace-tab-${activeTab}`}>
          {activeTab === 'overview' && <Summary data={data} onViewActivity={() => selectTab('activity')} />}
          {activeTab === 'contributions' && <FundContributions data={data} reload={reload} />}
          {activeTab === 'expenses' && <FundExpenses data={data} reload={reload} />}
          {activeTab === 'sponsorships' && <SponsorshipBoard data={data} reload={reload} />}
          {activeTab === 'rich-auntie' && <FundRichAuntie data={data} reload={reload} />}
          {activeTab === 'activity' && <FundOperations data={data} />}
          {activeTab === 'members' && <MemberDirectory data={data} reload={reload} />}
          {activeTab === 'settings' && <FundSettings data={data} reload={reload} />}
        </div>
      </div>
    </>
  )
}
