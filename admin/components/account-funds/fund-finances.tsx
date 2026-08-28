'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Camera, FileImage, HandCoins, Pencil, Plus, ReceiptText, RotateCcw, Trash2, WalletCards } from 'lucide-react'
import type {
  ContributorPledgeBalance,
  FundContributor,
  FundWorkspace,
  FundWorkspaceContribution,
  FundWorkspaceExpense,
  ParsedReceiptItem,
  PaymentMethod,
  User,
} from '@shared/contracts'
import { StatusPill } from '@/components/status-pill'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { formatDate, formatMoney, titleCase } from '@/lib/format'

type WorkspaceData = { workspace: FundWorkspace; user: User }
type ContributionStatus = 'confirmed' | 'pending' | 'pledged'
type ReceiptRow = ParsedReceiptItem & { included: boolean }

const PAYMENT_METHODS: Array<[PaymentMethod, string]> = [
  ['orange_money', 'Orange Money'], ['myzaka', 'MyZaka'], ['smega', 'Smega'],
  ['mpesa', 'M-Pesa'], ['mtn_momo', 'MTN MoMo'], ['airtel_money', 'Airtel Money'],
  ['ecocash', 'EcoCash'], ['bank_transfer', 'Bank transfer'], ['cash', 'Cash'], ['other', 'Other'],
]

const EXPENSE_CATEGORIES = ['food', 'venue', 'transport', 'decor', 'clothing', 'gifts', 'services', 'other']

function can(data: WorkspaceData, permission: FundWorkspace['permissions'][number]) {
  return data.workspace.fund.owner_id === data.user.id || data.workspace.permissions.includes(permission)
}

function positiveMoney(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

async function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The receipt image could not be prepared.')), 'image/jpeg', quality)
  })
}

async function prepareReceiptImage(file: File) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Choose a JPEG or PNG receipt image.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1800 / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The receipt image could not be prepared.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  let blob = await canvasBlob(canvas, 0.84)
  if (blob.size > 5 * 1024 * 1024) blob = await canvasBlob(canvas, 0.64)
  if (blob.size > 5 * 1024 * 1024) throw new Error('The receipt is still larger than 5 MB after compression. Choose a smaller image.')
  return blob
}

function FinanceEntryDialog({
  id,
  title,
  icon,
  onClose,
  children,
}: {
  id: string
  title: string
  icon: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  return (
    <div className="tshelo-dashboard modal-root">
      <div className="overlay on" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
        <section className="modal member-finance-dialog" role="dialog" aria-modal="true" aria-labelledby={id}>
          <header>
            <span className="itile sm">{icon}</span>
            <h3 id={id}>{title}</h3>
            <button ref={closeButton} className="x" type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()} dialog`}>&times;</button>
          </header>
          {children}
        </section>
      </div>
    </div>
  )
}

function ContributionEdit({ item, currencyCode, canRefund, onDone }: {
  item: FundWorkspaceContribution
  currencyCode: string
  canRefund: boolean
  onDone: () => void
}) {
  const [amount, setAmount] = useState(item.amount)
  const [status, setStatus] = useState(item.is_refunded ? 'refunded' : item.status)
  const [paymentMethod, setPaymentMethod] = useState(item.payment_method ?? '')
  const [reference, setReference] = useState(item.reference_number ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = positiveMoney(amount)
    if (!parsed) return setError('Enter a valid amount greater than zero.')
    setBusy(true); setError('')
    try {
      if (status === 'refunded' && !item.is_refunded) {
        await createApiClient().contributions.refund(item.id, { reason: notes.trim() || undefined })
      } else {
        await createApiClient().contributions.update(item.id, {
          amount: String(parsed),
          pledged_amount: status === 'pledged' ? String(parsed) : null,
          payment_method: status === 'pledged' ? null : (paymentMethod || null) as PaymentMethod | null,
          reference_number: reference.trim() || null,
          status: status as 'pledged' | 'pending' | 'confirmed' | 'disputed',
          notes: notes.trim() || null,
        })
      }
      onDone()
    } catch (cause) { setError(apiErrorMessage(cause)); setBusy(false) }
  }

  return (
    <form className="member-inline-editor" onSubmit={save}>
      <label><span>Contributor (identity locked)</span><input value={item.contributor_name} readOnly /></label>
      <label><span>Amount ({currencyCode})</span><input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></label>
      <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)} disabled={item.is_refunded}>
        <option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="pledged">Pledged</option><option value="disputed">Disputed</option>
        {canRefund && <option value="refunded">Refunded</option>}
      </select></label>
      {status !== 'pledged' && <label><span>Payment method</span><select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option value="">Not specified</option>{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      <label><span>Reference</span><input value={reference} onChange={event => setReference(event.target.value)} maxLength={100} /></label>
      <label className="wide"><span>Notes / refund reason</span><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={2} maxLength={2000} /></label>
      {error && <p className="member-form-error wide" role="alert">{error}</p>}
      <div className="member-form-actions wide"><button type="button" onClick={onDone}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : status === 'refunded' && !item.is_refunded ? 'Confirm refund' : 'Save correction'}</button></div>
    </form>
  )
}

function ContributionManager({ data, reload }: { data: WorkspaceData; reload: () => void }) {
  const { workspace } = data
  const isActive = workspace.fund.status === 'active'
  const canRecord = can(data, 'record_contributions')
  const canEdit = isActive && can(data, 'edit_contributions')
  const isOwner = workspace.fund.owner_id === data.user.id
  const [contributors, setContributors] = useState<FundContributor[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState(canRecord ? '' : data.user.name)
  const [phone, setPhone] = useState(canRecord ? '' : data.user.phone)
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<ContributionStatus>(canRecord ? 'confirmed' : 'pledged')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [pledges, setPledges] = useState<ContributorPledgeBalance[]>([])
  const [pledgeId, setPledgeId] = useState('')
  const [sponsorshipId, setSponsorshipId] = useState('')
  const [editing, setEditing] = useState('')
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    runApiRead(call => createApiClient().contributions.listContributors(workspace.fund.id, call), controller.signal)
      .then(rows => {
        const visible = canRecord ? rows : rows.filter(item => item.user_id === data.user.id)
        setContributors(visible)
        if (!canRecord && visible[0]) { setSelectedId(visible[0].id); setName(visible[0].display_name); setPhone(visible[0].phone) }
      }).catch(() => setContributors([]))
    return () => controller.abort()
  }, [canRecord, data.user.id, workspace.fund.id, workspace.contributions.length, workspace.members.length])

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    runApiRead(call => createApiClient().contributions.listPledgeBalances(workspace.fund.id, selectedId, call), controller.signal)
      .then(rows => {
        const open = rows.filter(row => Number(row.outstanding_amount) > 0)
        setPledges(open)
        setPledgeId(open.length === 1 ? open[0].pledge_id : '')
      }).catch(() => setPledges([]))
    return () => controller.abort()
  }, [contributors, selectedId, workspace.fund.id])

  const canAllocateSponsorships = can(data, 'manage_sponsorships')
  const allocatableSponsorships = useMemo(() => canAllocateSponsorships ? workspace.sponsorship_items.filter(item =>
    ['claimed', 'funded'].includes(item.status) && Number(item.outstanding_amount) > 0,
  ) : [], [canAllocateSponsorships, workspace.sponsorship_items])

  function reset() {
    setSelectedId(''); setName(canRecord ? '' : data.user.name); setPhone(canRecord ? '' : data.user.phone); setAmount(''); setStatus(canRecord ? 'confirmed' : 'pledged')
    setPaymentMethod('cash'); setReference(''); setNotes(''); setPledgeId(''); setSponsorshipId('')
  }

  function chooseContributor(value: string) {
    setSelectedId(value); setPledges([]); setPledgeId('')
    const selected = contributors.find(item => item.id === value)
    if (selected) { setName(selected.display_name); setPhone(selected.phone) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = positiveMoney(amount)
    if (!parsed) return setError('Enter a valid amount greater than zero.')
    if (!canRecord && status !== 'pledged') return setError('You can make a pledge, but you do not have permission to record received money.')
    const selected = contributors.find(item => item.id === selectedId)
    setBusy(true); setError('')
    let contributionCreated = false
    try {
      const saved = await createApiClient().contributions.create({
        fund_id: workspace.fund.id,
        contributor_id: selected?.id ?? null,
        contributor_user_id: selected?.user_id ?? (canRecord ? null : data.user.id),
        contributor_name: name.trim(), contributor_phone: phone.trim(), amount: String(parsed),
        pledged_amount: status === 'pledged' ? String(parsed) : null,
        currency_code: workspace.fund.currency_code,
        payment_method: status === 'pledged' ? null : paymentMethod,
        reference_number: reference.trim() || null, status,
        notes: notes.trim() || null, detected_via: 'manual',
      })
      contributionCreated = true
      const pledge = pledges.find(item => item.pledge_id === pledgeId)
      if (status === 'confirmed' && pledge) {
        await createApiClient().contributions.createPledgeAllocation({
          fund_id: workspace.fund.id, contributor_id: saved.contributor_id,
          pledge_contribution_id: pledge.pledge_id, payment_contribution_id: saved.id,
          amount: String(Math.min(parsed, Number(pledge.outstanding_amount))),
        })
      }
      const sponsorship = allocatableSponsorships.find(item => item.id === sponsorshipId)
      if (status === 'confirmed' && sponsorship) {
        await createApiClient().contributions.createSponsorshipAllocation({
          fund_id: workspace.fund.id, sponsorship_item_id: sponsorship.id,
          contribution_id: saved.id, amount: String(Math.min(parsed, Number(sponsorship.outstanding_amount))),
        })
      }
      reset(); setRecording(false); setBusy(false); reload()
    } catch (cause) {
      if (contributionCreated) { reset(); reload(); setError(`Contribution saved, but its allocation failed: ${apiErrorMessage(cause)}`) }
      else setError(apiErrorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <section className="member-card" id="contributions">
      <header>
        <div className="member-section-title"><span><HandCoins size={18} /></span><h2>Contributions & pledges</h2></div>
        <div className="member-card-header-actions">
          <small>{workspace.contributions.length} records</small>
          {isActive && <button type="button" className="member-header-action" onClick={() => { setError(''); setRecording(true) }}><Plus size={14} /> {canRecord ? 'Record contribution' : 'Make a pledge'}</button>}
        </div>
      </header>
      <div className="member-card-body">
        <div className="member-ledger-heading"><div><h3>Recent contributions</h3><p>Payments and pledges recorded for this fund.</p></div></div>
        <div className="member-record-list">
          {workspace.contributions.map(item => <article key={item.id}>
            <div className="member-record-main"><strong>{item.contributor_name}</strong><span>{titleCase(item.payment_method || item.detected_via)} · {formatDate(item.created_at)}</span>{item.reference_number && <small>Ref: {item.reference_number}</small>}</div>
            <div className="member-record-amount"><b>{formatMoney(item.status === 'pledged' ? item.pledged_amount ?? item.amount : item.amount, workspace.fund.currency_code)}</b>{item.outstanding_amount !== null && <small>{formatMoney(item.outstanding_amount, workspace.fund.currency_code)} outstanding</small>}</div>
            <StatusPill value={item.is_refunded ? 'refunded' : item.pledge_state ?? item.status} />
            {canEdit && <button type="button" className="member-icon-button" onClick={() => setEditing(editing === item.id ? '' : item.id)} aria-label={`Edit ${item.contributor_name}'s contribution`}><Pencil size={14} /></button>}
            {editing === item.id && <ContributionEdit item={item} currencyCode={workspace.fund.currency_code} canRefund={isOwner} onDone={() => { setEditing(''); reload() }} />}
          </article>)}
          {!workspace.contributions.length && <div className="member-empty">No contributions or pledges have been recorded.</div>}
        </div>
      </div>
      {recording && <FinanceEntryDialog id="record-contribution-title" title={canRecord ? 'Record contribution' : 'Make a pledge'} icon={<HandCoins size={18} />} onClose={() => setRecording(false)}>
        <form className="member-form member-finance-dialog-form" onSubmit={submit}>
          <div className="mbody">
            <div className="member-form-grid">
              {canRecord && <label><span>Saved contributor</span><select value={selectedId} onChange={event => chooseContributor(event.target.value)}><option value="">New / guest contributor</option>{contributors.map(item => <option value={item.id} key={item.id}>{item.display_name} · {item.phone}</option>)}</select></label>}
              <label><span>Record type</span><select value={status} onChange={event => setStatus(event.target.value as ContributionStatus)}>{canRecord && <option value="confirmed">Payment received</option>}<option value="pledged">Pledge</option>{canRecord && <option value="pending">Pending payment</option>}</select></label>
              <label><span>Contributor name</span><input value={name} readOnly={!canRecord} onChange={event => { setName(event.target.value); setSelectedId(''); setPledges([]); setPledgeId('') }} required minLength={2} maxLength={100} /></label>
              <label><span>Phone</span><input value={phone} readOnly={!canRecord} onChange={event => setPhone(event.target.value)} required inputMode="tel" placeholder="+267…" /></label>
              <label><span>{status === 'pledged' ? 'Pledged amount' : 'Amount'} ({workspace.fund.currency_code})</span><input value={amount} onChange={event => setAmount(event.target.value)} type="number" min="0.01" step="0.01" required /></label>
              {status !== 'pledged' && <label><span>Payment method</span><select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as PaymentMethod)}>{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
              {status === 'confirmed' && pledges.length > 0 && <label><span>Apply to pledge</span><select value={pledgeId} onChange={event => setPledgeId(event.target.value)}><option value="">Do not allocate</option>{pledges.map(item => <option key={item.pledge_id} value={item.pledge_id}>{item.contributor_name} · {formatMoney(item.outstanding_amount, workspace.fund.currency_code)} outstanding</option>)}</select></label>}
              {status === 'confirmed' && allocatableSponsorships.length > 0 && <label><span>Apply to sponsorship</span><select value={sponsorshipId} onChange={event => setSponsorshipId(event.target.value)}><option value="">Do not allocate</option>{allocatableSponsorships.map(item => <option key={item.id} value={item.id}>{item.title} · {formatMoney(item.outstanding_amount, workspace.fund.currency_code)}</option>)}</select></label>}
              <label><span>Reference</span><input value={reference} onChange={event => setReference(event.target.value)} maxLength={100} /></label>
              <label className="wide"><span>Notes</span><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={2} maxLength={2000} /></label>
            </div>
            {error && <p className="member-form-error" role="alert">{error}</p>}
          </div>
          <footer><button type="button" className="btn ghost" onClick={() => setRecording(false)}>Cancel</button><button type="submit" className="btn purple" disabled={busy}>{busy ? 'Recording…' : status === 'pledged' ? 'Save pledge' : 'Record contribution'}</button></footer>
        </form>
      </FinanceEntryDialog>}
    </section>
  )
}

function ExpenseEdit({ item, currencyCode, onDone }: { item: FundWorkspaceExpense; currencyCode: string; onDone: () => void }) {
  const [description, setDescription] = useState(item.description)
  const [vendor, setVendor] = useState(item.vendor_name ?? '')
  const [category, setCategory] = useState(item.category ?? '')
  const [amount, setAmount] = useState(item.amount)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = positiveMoney(amount)
    if (!parsed) return setError('Enter a valid amount greater than zero.')
    setBusy(true); setError('')
    try {
      await createApiClient().expenses.update(item.id, { description: description.trim(), item_name: description.trim(), vendor_name: vendor.trim() || null, category: category || null, amount: String(parsed) })
      onDone()
    } catch (cause) { setError(apiErrorMessage(cause)); setBusy(false) }
  }
  return <form className="member-inline-editor" onSubmit={save}>
    <label className="wide"><span>Description</span><input value={description} onChange={event => setDescription(event.target.value)} required maxLength={500} /></label>
    <label><span>Vendor</span><input value={vendor} onChange={event => setVendor(event.target.value)} maxLength={200} /></label>
    <label><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Uncategorised</option>{EXPENSE_CATEGORIES.map(value => <option value={value} key={value}>{titleCase(value)}</option>)}</select></label>
    <label><span>Amount ({currencyCode})</span><input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></label>
    {error && <p className="member-form-error wide" role="alert">{error}</p>}
    <div className="member-form-actions wide"><button type="button" onClick={onDone}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save correction'}</button></div>
  </form>
}

function ExpenseManager({ data, reload }: { data: WorkspaceData; reload: () => void }) {
  const { workspace } = data
  const allowed = workspace.fund.status === 'active' && can(data, 'record_expenses')
  const canEdit = can(data, 'edit_expenses')
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const [vendor, setVendor] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [payerId, setPayerId] = useState('')
  const [sponsorshipId, setSponsorshipId] = useState('')
  const [receiptPath, setReceiptPath] = useState('')
  const [receiptRows, setReceiptRows] = useState<ReceiptRow[]>([])
  const [receiptStatus, setReceiptStatus] = useState('')
  const [editing, setEditing] = useState('')
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sponsorships = can(data, 'manage_sponsorships') ? workspace.sponsorship_items.filter(item => ['claimed', 'funded'].includes(item.status)) : []
  const payers = workspace.members.filter(member => member.user_id && member.status === 'joined')

  async function selectReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setReceiptStatus('Preparing receipt image…'); setError(''); setReceiptRows([]); setReceiptPath('')
    try {
      const image = await prepareReceiptImage(file)
      setReceiptStatus('Uploading receipt…')
      const session = await createApiClient().receipts.createUploadSession({ fund_id: workspace.fund.id, content_type: 'image/jpeg', size_bytes: image.size })
      const upload = await fetch(session.upload_url, { method: 'PUT', headers: { 'cache-control': 'max-age=3600', 'content-type': session.content_type, 'x-upsert': 'false' }, body: image })
      if (!upload.ok) throw new Error('The receipt image could not be uploaded.')
      setReceiptPath(session.object_path); setReceiptStatus('Reading receipt…')
      try {
        const parsed = await createApiClient().receipts.parse({ fund_id: workspace.fund.id, object_path: session.object_path })
        if (!parsed.is_receipt) { setReceiptStatus('Image attached. It was not recognised as a receipt; enter the details manually.'); return }
        if (parsed.vendor) setVendor(parsed.vendor)
        if (parsed.total) setAmount(parsed.total)
        if (!description && parsed.vendor) setDescription(`Purchase from ${parsed.vendor}`)
        setReceiptRows(parsed.items.map(item => ({ ...item, included: true })))
        setReceiptStatus(parsed.items.length ? 'Receipt read. Review the items before saving.' : 'Receipt attached. Review the amount before saving.')
      } catch { setReceiptStatus('Receipt attached. Automatic reading was unavailable; enter the details manually.') }
    } catch (cause) { setError(apiErrorMessage(cause)); setReceiptStatus('') }
  }

  function updateReceiptRow(index: number, changes: Partial<ReceiptRow>) {
    setReceiptRows(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row))
  }

  function reset() {
    setVendor(''); setDescription(''); setCategory(''); setAmount(''); setPayerId(''); setSponsorshipId('')
    setReceiptPath(''); setReceiptRows([]); setReceiptStatus('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const included = receiptRows.filter(row => row.included && positiveMoney(row.amount))
    const manualAmount = positiveMoney(amount)
    if (!included.length && !manualAmount) return setError('Enter a valid amount or include at least one receipt item.')
    const payer = payers.find(member => member.user_id === payerId)
    const rows = included.length ? included.map(row => ({
      description: row.name.trim(), item_name: row.name.trim(), category: row.category,
      amount: String(positiveMoney(row.amount)), currency_code: workspace.fund.currency_code,
      vendor_name: vendor.trim() || null, receipt_path: receiptPath || null,
      ...(payer ? { sponsored_by_user_id: payer.user_id, sponsored_by_name: payer.display_name } : {}),
    })) : [{
      description: description.trim(), item_name: description.trim(), category: category || null,
      amount: String(manualAmount), currency_code: workspace.fund.currency_code,
      vendor_name: vendor.trim() || null, receipt_path: receiptPath || null,
      ...(payer ? { sponsored_by_user_id: payer.user_id, sponsored_by_name: payer.display_name } : {}),
    }]
    setBusy(true); setError('')
    try {
      const result = await createApiClient().expenses.create({ fund_id: workspace.fund.id, items: rows, fulfill_sponsorship_item_id: sponsorshipId || null })
      reset(); setBusy(false); reload()
      if (!result.sponsorship_fulfilled) setError('Expenses were saved, but the sponsorship item could not be marked fulfilled.')
      else setRecording(false)
    } catch (cause) { setError(apiErrorMessage(cause)); setBusy(false) }
  }

  async function removeExpense(item: FundWorkspaceExpense) {
    if (!window.confirm(`Remove "${item.description}" from the active expense list? The audit history will be retained.`)) return
    setBusy(true); setError('')
    try { await createApiClient().expenses.remove(item.id); setEditing(''); setBusy(false); reload() }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy(false) }
  }

  return (
    <section className="member-card" id="expenses">
      <header>
        <div className="member-section-title"><span><WalletCards size={18} /></span><h2>Expenses & receipts</h2></div>
        <div className="member-card-header-actions">
          <small>{workspace.expenses.length} records</small>
          {allowed && <button type="button" className="member-header-action" onClick={() => { setError(''); setRecording(true) }}><Plus size={14} /> Record expense</button>}
        </div>
      </header>
      <div className="member-card-body">
        {!allowed && workspace.fund.status === 'active' && <p className="member-form-note">You can view expenses, but you do not have permission to record them.</p>}
        <div className="member-ledger-heading"><div><h3>Expense ledger</h3><p>All expenses and receipt-backed purchases recorded for this fund.</p></div></div>
        <div className="member-record-list">
          {workspace.expenses.map(item => <article key={item.id}>
            <div className="member-record-main"><strong>{item.description}</strong><span>{item.vendor_name || titleCase(item.category || 'expense')} · {formatDate(item.created_at)}</span>{item.sponsored_by_name && <small>Sponsored by {item.sponsored_by_name}</small>}</div>
            <div className="member-record-amount"><b>{formatMoney(item.amount, workspace.fund.currency_code)}</b>{item.has_open_query && <small>Open query</small>}</div>
            <StatusPill value={item.is_sponsored ? 'sponsored' : 'recorded'} />
            {canEdit && <div className="member-record-buttons"><button type="button" className="member-icon-button" onClick={() => setEditing(editing === item.id ? '' : item.id)} aria-label={`Edit ${item.description}`}><Pencil size={14} /></button><button type="button" className="member-icon-button danger" onClick={() => removeExpense(item)} aria-label={`Remove ${item.description}`}><Trash2 size={14} /></button></div>}
            {editing === item.id && <ExpenseEdit item={item} currencyCode={workspace.fund.currency_code} onDone={() => { setEditing(''); reload() }} />}
          </article>)}
          {!workspace.expenses.length && <div className="member-empty">No expenses have been recorded.</div>}
        </div>
      </div>
      {recording && <FinanceEntryDialog id="record-expense-title" title="Record expense" icon={<WalletCards size={18} />} onClose={() => setRecording(false)}>
        <form className="member-form member-finance-dialog-form" onSubmit={submit}>
          <div className="mbody">
            <div className="member-receipt-actions">
              <input ref={cameraInput} className="member-visually-hidden" type="file" accept="image/jpeg,image/png" capture="environment" onChange={selectReceipt} />
              <input ref={libraryInput} className="member-visually-hidden" type="file" accept="image/jpeg,image/png" onChange={selectReceipt} />
              <button type="button" onClick={() => cameraInput.current?.click()}><Camera size={15} /> Take receipt photo</button>
              <button type="button" onClick={() => libraryInput.current?.click()}><FileImage size={15} /> Choose receipt image</button>
              <small>On desktop, both options open the image picker. On supported phones, “Take photo” opens the rear camera.</small>
            </div>
            {receiptStatus && <p className="member-upload-status"><ReceiptText size={14} /> {receiptStatus}</p>}
            {receiptRows.length > 0 && <div className="member-receipt-review"><strong>Receipt items</strong>{receiptRows.map((row, index) => <div key={`${index}:${row.name}`}>
              <input aria-label={`Include ${row.name}`} type="checkbox" checked={row.included} onChange={event => updateReceiptRow(index, { included: event.target.checked })} />
              <input aria-label={`Item ${index + 1} name`} value={row.name} onChange={event => updateReceiptRow(index, { name: event.target.value })} />
              <input aria-label={`Item ${index + 1} category`} value={row.category ?? ''} onChange={event => updateReceiptRow(index, { category: event.target.value || null })} placeholder="Category" />
              <input aria-label={`Item ${index + 1} amount`} type="number" min="0.01" step="0.01" value={row.amount} onChange={event => updateReceiptRow(index, { amount: event.target.value })} />
            </div>)}</div>}
            <div className="member-form-grid">
              <label><span>Vendor</span><input value={vendor} onChange={event => setVendor(event.target.value)} required minLength={2} maxLength={200} /></label>
              {receiptRows.length === 0 && <label><span>Amount ({workspace.fund.currency_code})</span><input value={amount} onChange={event => setAmount(event.target.value)} type="number" min="0.01" step="0.01" required /></label>}
              {receiptRows.length === 0 && <label className="wide"><span>Description</span><input value={description} onChange={event => setDescription(event.target.value)} required maxLength={500} /></label>}
              {receiptRows.length === 0 && <label><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Uncategorised</option>{EXPENSE_CATEGORIES.map(value => <option value={value} key={value}>{titleCase(value)}</option>)}</select></label>}
              <label><span>Paid / sponsored by</span><select value={payerId} onChange={event => setPayerId(event.target.value)}><option value="">Fund / current organiser</option>{payers.map(member => <option key={member.id} value={member.user_id ?? ''}>{member.display_name}</option>)}</select></label>
              {sponsorships.length > 0 && <label><span>Fulfil sponsorship item</span><select value={sponsorshipId} onChange={event => setSponsorshipId(event.target.value)}><option value="">No sponsorship item</option>{sponsorships.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
            </div>
            {error && <p className="member-form-error" role="alert">{error}</p>}
          </div>
          <footer><button type="button" className="btn ghost" onClick={reset}><RotateCcw size={14} /> Clear</button><button type="submit" className="btn purple" disabled={busy}>{busy ? 'Saving…' : receiptRows.length > 1 ? `Save ${receiptRows.filter(row => row.included).length} expenses` : 'Record expense'}</button></footer>
        </form>
      </FinanceEntryDialog>}
    </section>
  )
}

export function FundContributions({ data, reload }: { data: WorkspaceData; reload: () => void }) {
  return <ContributionManager data={data} reload={reload} />
}

export function FundExpenses({ data, reload }: { data: WorkspaceData; reload: () => void }) {
  return <ExpenseManager data={data} reload={reload} />
}
