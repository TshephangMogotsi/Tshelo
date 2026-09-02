'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Activity, Award, BadgeDollarSign, Download, FileText, ShieldCheck, Share2 } from 'lucide-react'
import type {
  FundActivityEntry,
  FundAdminPermissionRow,
  FundPermission,
  FundReportBundle,
  FundWorkspace,
  RichAuntieAward,
  RichAuntieEligibility,
  RichAuntieReasonCode,
  User,
} from '@shared/contracts'
import { FUND_PERMISSION_KEYS } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { DocumentPreviewDialog } from '@/components/documents/document-preview-dialog'
import { buildFundReportDocumentHtml } from '@/lib/fund-report-document'
import { formatDate, formatMoney, titleCase } from '@/lib/format'

type WorkspaceData = { workspace: FundWorkspace; user: User }

const PERMISSION_LABELS: Record<FundPermission, string> = {
  record_contributions: 'Record contributions', edit_contributions: 'Correct contributions',
  record_expenses: 'Record expenses', edit_expenses: 'Correct expenses', manage_members: 'Manage members',
  manage_sponsorships: 'Manage sponsorships', award_recognition: 'Award recognition', export_reports: 'Export reports',
  manage_event_guests: 'Manage linked-event guests', post_event_announcements: 'Post event announcements',
  manage_event_budget: 'Manage event budget',
}

const REASONS: Array<[RichAuntieReasonCode, string]> = [
  ['major_contribution', 'Major contribution'], ['bought_outfit', 'Bought an outfit'],
  ['paid_catering', 'Paid for catering'], ['covered_tent', 'Covered the tent'],
  ['bought_cake', 'Bought the cake'], ['transport_costs', 'Covered transport'], ['custom', 'Custom reason'],
]

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function reportCsv(report: FundReportBundle) {
  const rows: string[][] = [
    ['Tshelo fund report'], ['Fund', report.fund.title], ['Generated snapshot', report.history_snapshot_at], [],
    ['CONTRIBUTIONS'], ['Contributor', 'Amount', 'Status', 'Payment method', 'Reference', 'Created'],
    ...report.contributions.map(item => [item.contributor_name, item.amount, item.is_refunded ? 'refunded' : item.status, item.payment_method ?? '', item.reference_number ?? '', item.created_at]),
    [], ['EXPENSES'], ['Description', 'Vendor', 'Category', 'Amount', 'Sponsored by', 'Created'],
    ...report.expenses.filter(item => !item.deleted_at).map(item => [item.description, item.vendor_name ?? '', item.category ?? '', item.amount, item.sponsored_by_name ?? '', item.created_at]),
    [], ['MEMBERS'], ['Name', 'Phone', 'Role', 'Status', 'Joined'],
    ...report.members.map(item => {
      const profile = report.member_profiles.find(profileItem => profileItem.user_id === item.user_id)
      return [profile?.name ?? item.invited_name ?? 'Unknown', item.invited_phone ?? '', item.role, item.status, item.joined_at ?? '']
    }),
  ]
  return rows.map(row => row.map(csvCell).join(',')).join('\n')
}

function AdminPermissions({ data }: { data: WorkspaceData }) {
  const { workspace } = data
  const isOwner = workspace.fund.owner_id === data.user.id
  const [rows, setRows] = useState<FundAdminPermissionRow[]>([])
  const [selections, setSelections] = useState<Record<string, FundPermission[]>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    if (!isOwner) return
    runApiRead(call => createApiClient().funds.listAdminPermissions(workspace.fund.id, call))
      .then(dataRows => {
        setRows(dataRows)
        const next: Record<string, FundPermission[]> = {}
        dataRows.forEach(row => { (next[row.member_id] ??= []).push(row.permission_key) })
        setSelections(next)
      }).catch(cause => setError(apiErrorMessage(cause)))
  }, [isOwner, workspace.fund.id])

  useEffect(load, [load])

  if (!isOwner) return null
  const members = workspace.members.filter(member => member.status === 'joined' && member.user_id !== data.user.id && member.role !== 'owner')
  function toggle(memberId: string, permission: FundPermission) {
    setSelections(current => {
      const selected = new Set(current[memberId] ?? [])
      if (selected.has(permission)) selected.delete(permission); else selected.add(permission)
      return { ...current, [memberId]: [...selected] }
    })
  }
  async function save(memberId: string) {
    if (!(selections[memberId]?.length)) { setError('Select at least one permission, or use Remove admin for an existing administrator.'); return }
    setBusy(memberId); setError('')
    try { await createApiClient().funds.configureAdmin(workspace.fund.id, memberId, { permissions: selections[memberId] ?? [] }); setBusy(''); load() }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }
  async function remove(memberId: string) {
    if (!window.confirm('Remove all delegated admin access from this member?')) return
    setBusy(memberId); setError('')
    try { await createApiClient().funds.removeAdmin(workspace.fund.id, memberId); setBusy(''); load() }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }
  const existing = new Set(rows.map(row => row.member_id))
  return <section className="member-card" id="permissions">
    <header><div className="member-section-title"><span><ShieldCheck size={18} /></span><h2>Admin permissions</h2></div><small>Owner only</small></header>
    <div className="member-card-body"><p className="member-form-note">Delegate only the work each organiser needs. Closing, deleting, refunds, settings, and admin delegation remain owner-only.</p>
      <div className="member-permission-members">{members.map(member => <details key={member.id}>
        <summary><span><strong>{member.display_name}</strong><small>{existing.has(member.id) ? `${selections[member.id]?.length ?? 0} permissions` : 'Ordinary member'}</small></span><span>{existing.has(member.id) ? 'Edit access' : 'Make admin'}</span></summary>
        <div className="member-permission-grid">{FUND_PERMISSION_KEYS.map(permission => <label key={permission}><input type="checkbox" checked={(selections[member.id] ?? []).includes(permission)} onChange={() => toggle(member.id, permission)} /><span>{PERMISSION_LABELS[permission]}</span></label>)}</div>
        <div className="member-form-actions">{existing.has(member.id) && <button type="button" className="danger" disabled={busy === member.id} onClick={() => remove(member.id)}>Remove admin</button>}<button type="button" className="primary" disabled={busy === member.id} onClick={() => save(member.id)}>{busy === member.id ? 'Saving…' : 'Save permissions'}</button></div>
      </details>)}{!members.length && <div className="member-empty">Add joined members before delegating administration.</div>}</div>
      {error && <p className="member-form-error" role="alert">{error}</p>}
    </div>
  </section>
}

function Recognition({ data, reload }: { data: WorkspaceData; reload: () => void }) {
  const { workspace } = data
  const allowed = workspace.fund.status === 'active' && (workspace.fund.owner_id === data.user.id || workspace.permissions.includes('award_recognition'))
  const [awards, setAwards] = useState<RichAuntieAward[]>([])
  const [memberId, setMemberId] = useState('')
  const [reasonCode, setReasonCode] = useState<RichAuntieReasonCode>('major_contribution')
  const [reasonLabel, setReasonLabel] = useState('')
  const [sponsorshipId, setSponsorshipId] = useState('')
  const [eligibility, setEligibility] = useState<RichAuntieEligibility | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const closeButton = useRef<HTMLButtonElement>(null)
  const awardTrigger = useRef<HTMLButtonElement | null>(null)
  const busyRef = useRef(false)

  const boardMembers = useMemo(() => workspace.members
    .map(member => {
      const linkedExpenseIds = new Set<string>()
      const sponsoredItems = workspace.sponsorship_items
        .filter(item => item.claimed_by_user_id === member.user_id && ['funded', 'fulfilled'].includes(item.status))
        .map(item => {
          if (item.linked_expense_id) linkedExpenseIds.add(item.linked_expense_id)
          return item.title
        })
      workspace.expenses
        .filter(expense => expense.is_sponsored && expense.sponsored_by_user_id === member.user_id && !linkedExpenseIds.has(expense.id))
        .forEach(expense => sponsoredItems.push(expense.description))
      const contributionTotal = workspace.contributions
        .filter(contribution => contribution.user_id === member.user_id && contribution.status === 'confirmed' && !contribution.is_refunded)
        .reduce((total, contribution) => total + Number(contribution.amount), 0)
      return {
        member,
        contributionTotal,
        sponsoredItems,
        awardCount: member.user_id ? awards.filter(award => award.recipient_user_id === member.user_id).length : 0,
      }
    })
    .sort((left, right) => (
      Number(right.sponsoredItems.length > 0) - Number(left.sponsoredItems.length > 0)
      || right.contributionTotal - left.contributionTotal
      || Number(right.member.status === 'joined') - Number(left.member.status === 'joined')
      || left.member.display_name.localeCompare(right.member.display_name)
    )), [awards, workspace.contributions, workspace.expenses, workspace.members, workspace.sponsorship_items])
  const selectedMember = boardMembers.find(item => item.member.id === memberId)?.member

  const loadAwards = useCallback(() => runApiRead(call => createApiClient().richAuntie.listAwards({ fund_id: workspace.fund.id, limit: 100 }, call)).then(page => setAwards(page.items)).catch(() => setAwards([])), [workspace.fund.id])
  useEffect(() => { void loadAwards() }, [loadAwards])
  useEffect(() => { busyRef.current = busy }, [busy])
  useEffect(() => {
    if (!selectedMember?.user_id) return
    const controller = new AbortController()
    runApiRead(call => createApiClient().richAuntie.eligibility(workspace.fund.id, selectedMember.user_id!, call), controller.signal)
      .then(result => {
        setEligibility(result)
        const firstEligibleItem = result.sponsorship_progress.find(item => item.eligible)
        if (firstEligibleItem) setSponsorshipId(firstEligibleItem.id)
      })
      .catch(() => { if (!controller.signal.aborted) setEligibility(null) })
    return () => controller.abort()
  }, [selectedMember, workspace.fund.id])

  useEffect(() => {
    if (!memberId) return
    const previousOverflow = document.body.style.overflow
    const trigger = awardTrigger.current
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) setMemberId('')
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
      trigger?.focus()
    }
  }, [memberId])

  function openAward(value: string, sponsoredItem: string | undefined, trigger: HTMLButtonElement) {
    awardTrigger.current = trigger
    setEligibility(null)
    setMemberId(value)
    setSponsorshipId('')
    setReasonCode(sponsoredItem ? 'custom' : 'major_contribution')
    setReasonLabel(sponsoredItem ? `Thank you for sponsoring ${sponsoredItem}.` : '')
    setError('')
  }

  function closeAward() {
    setMemberId('')
    setEligibility(null)
    setSponsorshipId('')
    setReasonLabel('')
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedMember?.user_id) return setError('Choose a joined member.')
    setBusy(true); setError('')
    try {
      await createApiClient().richAuntie.createAward({ fund_id: workspace.fund.id, recipient_user_id: selectedMember.user_id, sponsorship_item_id: sponsorshipId || null, reason_code: reasonCode, reason_label: reasonLabel.trim(), notify_member: true })
      setBusy(false)
      closeAward()
      await loadAwards()
      reload()
    } catch (cause) { setError(apiErrorMessage(cause)); setBusy(false) }
  }

  return <section className="member-card" id="recognition">
    <header><div className="member-section-title"><span><Award size={18} /></span><h2>Rich Auntie recognition</h2></div><small>{boardMembers.length} members · {awards.length} awards</small></header>
    <div className="member-card-body">
      <div className="member-rich-auntie-heading"><div><h3>Member recognition board</h3><p>Members who paid for sponsored items appear first, followed by confirmed contribution total.</p></div></div>
      <div className="member-rich-auntie-board">
        {boardMembers.map((item, index) => {
          const canAwardMember = allowed && item.member.status === 'joined' && Boolean(item.member.user_id) && item.member.user_id !== data.user.id
          return <article className={item.sponsoredItems.length ? 'priority' : ''} key={item.member.id}>
            <span className="member-rich-auntie-rank" aria-label={`Rank ${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
            <div className="member-directory-avatar">{item.member.display_name.slice(0, 2).toUpperCase()}</div>
            <div className="member-rich-auntie-person"><strong>{item.member.display_name}{item.member.user_id === data.user.id ? ' · You' : ''}</strong><p>{titleCase(item.member.role)}{item.member.status !== 'joined' ? ` · ${titleCase(item.member.status)}` : ''}{item.awardCount ? ` · ${item.awardCount} award${item.awardCount === 1 ? '' : 's'}` : ''}</p></div>
            <div className="member-rich-auntie-evidence">
              {item.sponsoredItems.length > 0 && <span title={item.sponsoredItems.join(', ')}><BadgeDollarSign size={13} /> Paid for {item.sponsoredItems.length} sponsored item{item.sponsoredItems.length === 1 ? '' : 's'}</span>}
              <strong>{formatMoney(String(item.contributionTotal), workspace.fund.currency_code)} <small>contributed</small></strong>
            </div>
            <div className="member-rich-auntie-actions">
              {canAwardMember && <button type="button" onClick={event => openAward(item.member.id, item.sponsoredItems[0], event.currentTarget)}><Award size={14} /> Award Rich Auntie</button>}
              {item.member.status !== 'joined' && <small>Invite pending</small>}
              {item.member.status === 'joined' && !item.member.user_id && <small>Account not claimed</small>}
            </div>
          </article>
        })}
        {!boardMembers.length && <div className="member-empty">No members are available for recognition yet.</div>}
      </div>
      <div className="member-award-history"><div className="member-ledger-heading"><div><h3>Recent awards</h3><p>Recognition already given from this fund.</p></div></div><div className="member-award-list">{awards.map(award => <article key={award.id}><Award size={16} /><div><strong>{award.recipient_name}</strong><p>{award.reason_label} · {formatDate(award.created_at)}</p></div></article>)}{!awards.length && <div className="member-empty">No recognition awards have been issued for this fund.</div>}</div></div>
    </div>
    {selectedMember && <div className="tshelo-dashboard modal-root"><div className="overlay on" role="presentation" onMouseDown={event => { if (!busy && event.target === event.currentTarget) closeAward() }}><section className="modal member-rich-auntie-dialog" role="dialog" aria-modal="true" aria-labelledby="rich-auntie-award-title"><header><span className="itile sm"><Award /></span><h3 id="rich-auntie-award-title">Award Rich Auntie</h3><button ref={closeButton} className="x" type="button" disabled={busy} onClick={closeAward} aria-label="Close Rich Auntie award dialog">&times;</button></header><form className="member-form member-finance-dialog-form" onSubmit={submit}><div className="mbody"><div className="member-rich-auntie-recipient"><div className="member-directory-avatar">{selectedMember.display_name.slice(0, 2).toUpperCase()}</div><div><span>Recognising</span><strong>{selectedMember.display_name}</strong></div></div><div className="member-form-grid">
      <label><span>Reason</span><select value={reasonCode} onChange={event => setReasonCode(event.target.value as RichAuntieReasonCode)}>{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {eligibility?.sponsorship_progress.length ? <label><span>Sponsorship item</span><select value={sponsorshipId} onChange={event => setSponsorshipId(event.target.value)}><option value="">General recognition</option>{eligibility.sponsorship_progress.map(item => <option key={item.id} value={item.id} disabled={!item.eligible}>{item.title}{item.already_awarded ? ' · already awarded' : ''}</option>)}</select></label> : <label><span>Sponsorship record</span><input value={eligibility ? 'No sponsored items' : 'Checking eligibility…'} readOnly /></label>}
      <label className="wide"><span>Recognition message</span><input value={reasonLabel} onChange={event => setReasonLabel(event.target.value)} required minLength={2} maxLength={200} placeholder="Describe what this member made possible" /></label>
      </div>{eligibility && !eligibility.can_award && <p className="member-form-error">You do not have permission to give this award.</p>}{error && <p className="member-form-error" role="alert">{error}</p>}</div><footer><button className="btn ghost" type="button" disabled={busy} onClick={closeAward}>Cancel</button><button className="btn primary" disabled={busy || !eligibility || !eligibility.can_award}>{busy ? 'Awarding…' : 'Award recognition'}</button></footer></form></section></div></div>}
  </section>
}

function ActivityAndReports({ data }: { data: WorkspaceData }) {
  const { workspace } = data
  const canExport = workspace.fund.owner_id === data.user.id || workspace.permissions.includes('export_reports')
  const [activity, setActivity] = useState<FundActivityEntry[]>([])
  const [filter, setFilter] = useState('')
  const [report, setReport] = useState<FundReportBundle | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [pdfPreview, setPdfPreview] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    runApiRead(call => createApiClient().funds.activity(workspace.fund.id, { limit: 100, entity_type: filter || undefined }, call), controller.signal).then(page => setActivity(page.items)).catch(cause => setError(apiErrorMessage(cause)))
    return () => controller.abort()
  }, [filter, workspace.fund.id, workspace.contributions.length, workspace.expenses.length, workspace.members.length])

  const summary = useMemo(() => report ? {
    confirmed: report.contributions.filter(item => item.status === 'confirmed' && !item.is_refunded).reduce((sum, item) => sum + Number(item.amount), 0),
    spent: report.expenses.filter(item => !item.deleted_at && !item.is_sponsored).reduce((sum, item) => sum + Number(item.amount), 0),
  } : null, [report])

  async function getReport() {
    if (report) return report
    const loaded = await runApiRead(call => createApiClient().funds.report(workspace.fund.id, call))
    setReport(loaded); return loaded
  }
  async function exportCsv() {
    setBusy('csv'); setError('')
    try { const loaded = await getReport(); await createApiClient().funds.createExport(workspace.fund.id, { export_type: 'csv' }); download(`${workspace.fund.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report.csv`, reportCsv(loaded), 'text/csv;charset=utf-8'); setBusy('') }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }
  async function printReport() {
    setBusy('pdf'); setError('')
    try {
      const loaded = await getReport()
      const html = buildFundReportDocumentHtml(loaded)
      await createApiClient().funds.createExport(workspace.fund.id, { export_type: 'pdf' })
      setPdfPreview(html)
      setBusy('')
    } catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }
  async function share() {
    setBusy('share'); setError('')
    try {
      const text = `${workspace.fund.title} · Invite code ${workspace.fund.fund_code}`
      if (navigator.share) await navigator.share({ title: workspace.fund.title, text, url: window.location.href })
      else { await navigator.clipboard.writeText(`${text}\n${window.location.href}`); window.alert('Fund link copied.') }
      await createApiClient().funds.createExport(workspace.fund.id, { export_type: 'share' })
      setBusy('')
    } catch (cause) { if ((cause as DOMException)?.name !== 'AbortError') setError(apiErrorMessage(cause)); setBusy('') }
  }

  return <>
    <section className="member-card" id="history">
      <header><div className="member-section-title"><span><Activity size={18} /></span><h2>History & reports</h2></div>{canExport && <div className="member-inline-actions"><button type="button" disabled={Boolean(busy)} onClick={exportCsv}><Download size={13} /> {busy === 'csv' ? 'Preparing…' : 'CSV'}</button><button type="button" disabled={Boolean(busy)} onClick={printReport}><FileText size={13} /> {busy === 'pdf' ? 'Generating…' : 'Generate PDF'}</button><button type="button" disabled={Boolean(busy)} onClick={share}><Share2 size={13} /> Share</button></div>}</header>
      <div className="member-card-body">
        {summary && <div className="member-report-summary"><div><span>Confirmed</span><strong>{formatMoney(String(summary.confirmed), workspace.fund.currency_code)}</strong></div><div><span>Spent</span><strong>{formatMoney(String(summary.spent), workspace.fund.currency_code)}</strong></div><div><span>Snapshot</span><strong>{formatDate(report?.history_snapshot_at ?? '')}</strong></div></div>}
        <div className="member-history-filter"><label><span>Activity type</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="">Everything</option><option value="contribution">Contributions</option><option value="expense">Expenses</option><option value="member">Members</option><option value="fund">Fund changes</option></select></label></div>
        <div className="member-history-list">{activity.map(entry => {
          const changes = entry.action === 'updated' ? Object.keys(entry.new_values ?? {}) : []
          return <article key={entry.id}><div><strong>{titleCase(entry.action)} {titleCase(entry.entity_type)}</strong><span>{formatDate(entry.created_at)}</span></div>{changes.length > 0 && <p>{changes.map(titleCase).join(', ')}</p>}</article>
        })}{!activity.length && <div className="member-empty">No activity matches this filter.</div>}</div>
        {error && <p className="member-form-error" role="alert">{error}</p>}
      </div>
    </section>
    <DocumentPreviewDialog title={`${workspace.fund.title} fund statement`} html={pdfPreview} isGenerating={busy === 'pdf'} onClose={() => setPdfPreview(null)} />
  </>
}

export function FundOperations({ data }: { data: WorkspaceData }) {
  return <><AdminPermissions data={data} /><ActivityAndReports data={data} /></>
}

export function FundRichAuntie({ data, reload }: { data: WorkspaceData; reload: () => void }) {
  return <Recognition data={data} reload={reload} />
}
