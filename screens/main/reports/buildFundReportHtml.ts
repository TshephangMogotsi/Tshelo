import { fundMemberCount } from '../../../lib/fundMembers'

export type FundReportData = {
  fund: {
    title: string
    description: string | null
    fund_type: string
    fund_code: string
    currency_code: string
    goal_amount: number | string | null
    status: string
    created_at: string
    contribution_deadline: string | null
    is_private: boolean
  }
  contributions: Array<{
    id: string
    contributor_id: string | null
    contributor_name: string
    amount: number | string
    pledged_amount: number | string | null
    payment_method: string | null
    reference_number: string | null
    status: string
    is_refunded: boolean
    confirmed_at: string | null
    created_at: string
    notes: string | null
  }>
  expenses: Array<{
    id: string
    description: string
    item_name: string | null
    category: string | null
    amount: number | string
    vendor_name: string | null
    receipt_url: string | null
    is_sponsored: boolean
    sponsored_by_user_id: string | null
    sponsored_by_name: string | null
    has_open_query: boolean
    created_at: string
    updated_at: string
    deleted_at: string | null
  }>
  members: Array<{
    id: string
    user_id: string | null
    invited_name: string | null
    invited_phone: string | null
    role: string
    status: string
    invited_at: string | null
    joined_at: string | null
    created_at: string
  }>
  contributors: Array<{
    id: string
    user_id: string | null
    display_name: string
    phone: string | null
    contributor_type: string
  }>
  pledgeBalances: Array<{
    pledge_id: string
    contributor_id: string | null
    pledged_amount: number | string
    allocated_amount: number | string
    outstanding_amount: number | string
    pledge_state: string
  }>
  linkedEvent: {
    name: string
    event_date: string | null
    venue_name: string | null
  } | null
  sponsorshipItems: Array<{
    id: string
    title: string
    target_amount: number | string
    allocated_amount: number | string
    outstanding_amount: number | string
    status: string
    claimed_by_user_id: string | null
    funded_at: string | null
    fulfilled_at: string | null
    created_at: string
  }>
  richAuntieAwards: Array<{
    id: string
    recipient_user_id: string
    sponsorship_item_id: string | null
    reason_label: string
    created_at: string
  }>
  memberProfiles: Array<{
    user_id: string
    name: string
  }>
  auditHistory: Array<{
    id: string
    user_id: string | null
    action: string
    entity_type: string
    entity_id: string
    old_values: Record<string, unknown> | null
    new_values: Record<string, unknown> | null
    created_at: string
  }>
  contributionEdits: Array<{
    id: string
    contribution_id: string
    edited_by: string
    field_changed: string
    old_value: string | null
    new_value: string | null
    reason: string | null
    created_at: string
  }>
  expenseEdits: Array<{
    id: string
    expense_id: string
    edited_by: string
    field_changed: string
    old_value: string | null
    new_value: string | null
    reason: string | null
    created_at: string
  }>
  exportHistory: Array<{
    id: string
    exported_by: string
    export_type: string
    was_free: boolean
    tokens_spent: number
    created_at: string
  }>
  logoDataUri?: string
  generatedAt?: string
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character] ?? character))
}

function humanise(value: unknown) {
  const text = String(value ?? '').replace(/_/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '-'
}

function money(amount: number, currency: string) {
  const symbol = currency === 'BWP' ? 'P' : currency
  return `${symbol} ${amount.toLocaleString('en-BW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-BW', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-BW', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-BW', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function displayValue(value: unknown, field: string, currency: string) {
  if (value === null || value === undefined || value === '') return 'Not set'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (['amount', 'goal_amount', 'pledged_amount', 'allocated_amount', 'outstanding_amount', 'unit_price'].includes(field)) {
    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) return money(numericValue, currency)
  }
  if (field.endsWith('_at') || field.endsWith('_date') || field === 'contribution_deadline') {
    return formatDateTime(String(value))
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function emptyRow(columns: number, text: string) {
  return `<tr><td colspan="${columns}" class="empty">${escapeHtml(text)}</td></tr>`
}

function maskPhone(value: string | null) {
  if (!value) return '-'
  const digits = value.replace(/\D/g, '')
  if (digits.length < 4) return '•••'
  const country = digits.startsWith('267') && digits.length > 8 ? '267 ' : ''
  return `${country}••• ••${digits.slice(-3)}`
}

function dateSort(value: string | null | undefined) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function buildFundReportHtml(data: FundReportData) {
  const {
    fund,
    contributions,
    expenses,
    members,
    contributors,
    pledgeBalances,
    linkedEvent,
    sponsorshipItems,
    richAuntieAwards,
    memberProfiles,
    auditHistory,
    contributionEdits,
    expenseEdits,
    exportHistory,
    logoDataUri,
  } = data
  const generatedAt = data.generatedAt ?? new Date().toISOString()
  const currency = fund.currency_code

  const confirmedContributions = contributions
    .filter(item => item.status === 'confirmed' && !item.is_refunded)
    .sort((a, b) => dateSort(a.confirmed_at ?? a.created_at) - dateSort(b.confirmed_at ?? b.created_at))
  const activeExpenses = expenses.filter(item => !item.deleted_at)
  const fundExpenses = activeExpenses.filter(item => !item.is_sponsored)
  const sponsoredPurchases = activeExpenses.filter(item => item.is_sponsored)
  const openPledges = pledgeBalances.filter(item => Number(item.outstanding_amount ?? 0) > 0)
  const settledPledges = pledgeBalances.filter(item => Number(item.pledged_amount ?? 0) > 0 && Number(item.outstanding_amount ?? 0) <= 0)

  const totalIn = confirmedContributions.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const totalOut = fundExpenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const pledged = pledgeBalances.reduce((sum, item) => sum + Number(item.pledged_amount ?? 0), 0)
  const pledgeOutstanding = openPledges.reduce((sum, item) => sum + Number(item.outstanding_amount ?? 0), 0)
  const balance = totalIn - totalOut
  const goal = Math.max(Number(fund.goal_amount ?? 0), 0)
  const targetOutstanding = Math.max(goal - totalIn, 0)
  const progress = goal > 0 ? Math.min(Math.round(totalIn / goal * 100), 999) : 0
  const missingReferenceCount = confirmedContributions.filter(item => !item.reference_number).length
  const joinedMembers = members.filter(member => member.status === 'joined')

  const contributorById = new Map(contributors.map(contributor => [contributor.id, contributor]))
  const nameByUserId = new Map<string, string>()
  contributors.forEach(contributor => {
    if (contributor.user_id) nameByUserId.set(contributor.user_id, contributor.display_name)
  })
  memberProfiles.forEach(profile => nameByUserId.set(profile.user_id, profile.name))
  const sponsorshipById = new Map(sponsorshipItems.map(item => [item.id, item]))
  const pledgeById = new Map(contributions.map(item => [item.id, item]))

  const movementRows = [
    ...confirmedContributions.map(item => ({
      date: item.confirmed_at ?? item.created_at,
      description: `Contribution from ${item.contributor_name}`,
      detail: item.notes ? `Note: ${item.notes}` : 'Confirmed contribution',
      method: humanise(item.payment_method),
      reference: item.reference_number ?? 'Not captured',
      incoming: Number(item.amount ?? 0),
      outgoing: 0,
    })),
    ...fundExpenses.map(item => ({
      date: item.created_at,
      description: item.item_name ?? item.description,
      detail: [item.vendor_name, humanise(item.category)].filter(Boolean).join(' · '),
      method: 'Fund expense',
      reference: item.receipt_url ? 'Receipt recorded' : 'No receipt',
      incoming: 0,
      outgoing: Number(item.amount ?? 0),
    })),
  ].sort((a, b) => dateSort(a.date) - dateSort(b.date))
  let runningBalance = 0
  const statementRows = movementRows.map(item => {
    runningBalance += item.incoming - item.outgoing
    return `<tr>
      <td>${formatShortDate(item.date)}</td>
      <td><strong>${escapeHtml(item.description)}</strong><div class="subtle">${escapeHtml(item.detail)}</div></td>
      <td>${escapeHtml(item.method)}</td>
      <td class="${item.reference === 'Not captured' || item.reference === 'No receipt' ? 'alertText' : ''}">${escapeHtml(item.reference)}</td>
      <td class="number amount">${item.incoming ? money(item.incoming, currency) : '-'}</td>
      <td class="number amount">${item.outgoing ? money(item.outgoing, currency) : '-'}</td>
      <td class="number amount">${money(runningBalance, currency)}</td>
    </tr>`
  }).join('')

  const allContributionRows = contributions.map(item => {
    const recorded = item.confirmed_at ?? item.created_at
    const status = item.is_refunded ? 'Refunded' : humanise(item.status)
    return `<tr>
      <td>${formatDateTime(recorded)}</td>
      <td><strong>${escapeHtml(item.contributor_name)}</strong><div class="subtle id">${escapeHtml(item.id)}</div></td>
      <td><span class="pill ${item.is_refunded ? 'warning' : ''}">${escapeHtml(status)}</span></td>
      <td>${escapeHtml(humanise(item.payment_method))}<div class="subtle">${item.reference_number ? `Ref: ${escapeHtml(item.reference_number)}` : 'No reference'}</div></td>
      <td>${item.notes ? escapeHtml(item.notes) : '<span class="subtle">No note</span>'}</td>
      <td class="number amount">${Number(item.pledged_amount ?? 0) > 0 ? money(Number(item.pledged_amount), currency) : '-'}</td>
      <td class="number amount">${money(Number(item.amount ?? 0), currency)}</td>
    </tr>`
  }).join('')

  const pledgeRows = openPledges.map(item => {
    const contributor = contributorById.get(item.contributor_id ?? '')
    const sourcePledge = pledgeById.get(item.pledge_id)
    return `<tr>
      <td><strong>${escapeHtml(contributor?.display_name ?? sourcePledge?.contributor_name ?? 'Contributor')}</strong></td>
      <td>${sourcePledge?.notes ? escapeHtml(sourcePledge.notes) : '<span class="subtle">No purpose recorded</span>'}</td>
      <td>${formatShortDate(sourcePledge?.created_at)}</td>
      <td class="number amount">${money(Number(item.pledged_amount ?? 0), currency)}</td>
      <td class="number amount">${money(Number(item.allocated_amount ?? 0), currency)}</td>
      <td class="number amount alertText">${money(Number(item.outstanding_amount ?? 0), currency)}</td>
    </tr>`
  }).join('')

  const settledPledgeRows = settledPledges.map(item => {
    const contributor = contributorById.get(item.contributor_id ?? '')
    const sourcePledge = pledgeById.get(item.pledge_id)
    return `<tr>
      <td>${escapeHtml(contributor?.display_name ?? sourcePledge?.contributor_name ?? 'Contributor')}</td>
      <td>${sourcePledge?.notes ? escapeHtml(sourcePledge.notes) : '<span class="subtle">No purpose recorded</span>'}</td>
      <td>${formatShortDate(sourcePledge?.created_at)}</td>
      <td class="number amount">${money(Number(item.pledged_amount ?? 0), currency)}</td>
      <td><span class="pill success">Settled</span></td>
    </tr>`
  }).join('')

  const contributorRows = contributors.map(contributor => {
    const contributorPledges = pledgeBalances.filter(item => item.contributor_id === contributor.id)
    const payments = confirmedContributions.filter(item => item.contributor_id === contributor.id)
    const received = payments.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
    const promised = contributorPledges.reduce((sum, item) => sum + Number(item.pledged_amount ?? 0), 0)
    const due = contributorPledges.reduce((sum, item) => sum + Number(item.outstanding_amount ?? 0), 0)
    const paymentDates = payments.map(item => item.confirmed_at ?? item.created_at).sort()
    const paymentSummary = paymentDates.length
      ? `First payment ${formatShortDate(paymentDates[0])}, last payment ${formatShortDate(paymentDates[paymentDates.length - 1])}`
      : 'No confirmed payments'
    return `<tr>
      <td><strong>${escapeHtml(contributor.display_name)}</strong><div class="subtle">${escapeHtml(paymentSummary)}</div></td>
      <td><span class="pill">${escapeHtml(humanise(contributor.contributor_type))}</span></td>
      <td class="number">${escapeHtml(maskPhone(contributor.phone))}</td>
      <td class="number amount">${payments.length}</td>
      <td class="number amount">${money(promised, currency)}</td>
      <td class="number amount positiveText">${money(received, currency)}</td>
      <td class="number amount ${due > 0 ? 'alertText' : ''}">${money(due, currency)}</td>
    </tr>`
  }).join('')

  const expenseRows = fundExpenses.map(item => `<tr>
    <td>${formatShortDate(item.created_at)}</td>
    <td><strong>${escapeHtml(item.item_name ?? item.description)}</strong><div class="subtle">${escapeHtml(humanise(item.category))}</div></td>
    <td>${escapeHtml(item.vendor_name ?? '-')}</td>
    <td>${item.receipt_url ? '<span class="pill success">Receipt recorded</span>' : '<span class="pill warning">No receipt</span>'}${item.has_open_query ? ' <span class="pill warning">Query open</span>' : ''}</td>
    <td class="number amount">${money(Number(item.amount ?? 0), currency)}</td>
  </tr>`).join('')

  const allExpenseRows = expenses.map(item => {
    const status = item.deleted_at ? 'Deleted' : item.is_sponsored ? 'Sponsored' : 'Recorded'
    return `<tr>
      <td>${formatDateTime(item.created_at)}</td>
      <td><strong>${escapeHtml(item.item_name ?? item.description)}</strong><div class="subtle id">${escapeHtml(item.id)}</div></td>
      <td>${escapeHtml(item.vendor_name ?? '-')}<div class="subtle">${escapeHtml(humanise(item.category))}</div></td>
      <td><span class="pill ${item.deleted_at ? 'warning' : item.is_sponsored ? 'gold' : 'success'}">${status}</span></td>
      <td>${item.receipt_url ? `<strong class="positiveText">Receipt recorded</strong><div class="subtle breakText">${escapeHtml(item.receipt_url)}</div>` : '<span class="subtle">No receipt</span>'}</td>
      <td class="number amount">${money(Number(item.amount ?? 0), currency)}</td>
    </tr>`
  }).join('')

  const sponsorshipRows = sponsorshipItems.map(item => {
    const sponsor = item.claimed_by_user_id ? nameByUserId.get(item.claimed_by_user_id) : null
    return `<tr>
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td>${escapeHtml(sponsor ?? 'Not claimed')}</td>
      <td><span class="pill success">${escapeHtml(humanise(item.status))}</span></td>
      <td class="number amount">${money(Number(item.target_amount ?? 0), currency)}</td>
      <td class="number amount positiveText">${money(Number(item.allocated_amount ?? 0), currency)}</td>
      <td class="number amount">${money(Number(item.outstanding_amount ?? 0), currency)}</td>
    </tr>`
  }).join('')

  const sponsoredPurchaseRows = sponsoredPurchases.map(item => `<tr>
    <td>${formatShortDate(item.created_at)}</td>
    <td><strong>${escapeHtml(item.item_name ?? item.description)}</strong></td>
    <td>${escapeHtml(item.sponsored_by_name ?? (item.sponsored_by_user_id ? nameByUserId.get(item.sponsored_by_user_id) : null) ?? 'Sponsor')}</td>
    <td>${escapeHtml(item.vendor_name ?? '-')}</td>
    <td class="number amount">${money(Number(item.amount ?? 0), currency)}</td>
  </tr>`).join('')

  const awardRows = richAuntieAwards.map(award => {
    const item = award.sponsorship_item_id ? sponsorshipById.get(award.sponsorship_item_id) : null
    return `<tr>
      <td><strong>${escapeHtml(nameByUserId.get(award.recipient_user_id) ?? 'Fund member')}</strong></td>
      <td>${escapeHtml(award.reason_label)}</td>
      <td>${escapeHtml(item?.title ?? 'General recognition')}</td>
      <td>${formatDate(award.created_at)}</td>
    </tr>`
  }).join('')

  const memberRows = members.map(member => {
    const name = member.user_id ? nameByUserId.get(member.user_id) : null
    return `<tr>
      <td><strong>${escapeHtml(name ?? member.invited_name ?? 'Unnamed member')}</strong><div class="subtle id">${escapeHtml(member.id)}</div></td>
      <td><span class="pill ${member.role === 'owner' ? 'owner' : ''}">${escapeHtml(humanise(member.role))}</span></td>
      <td>${escapeHtml(humanise(member.status))}</td>
      <td class="number">${escapeHtml(maskPhone(member.invited_phone))}</td>
      <td>${formatDateTime(member.invited_at ?? member.created_at)}</td>
      <td>${formatDateTime(member.joined_at)}</td>
    </tr>`
  }).join('')

  const auditRows = auditHistory.map(entry => {
    const oldValues = entry.old_values ?? {}
    const newValues = entry.new_values ?? {}
    const fields = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)])).sort()
    const changeRows = fields.map(field => `<tr>
      <td>${escapeHtml(humanise(field))}</td>
      <td class="breakText">${escapeHtml(displayValue(oldValues[field], field, currency))}</td>
      <td class="breakText">${escapeHtml(displayValue(newValues[field], field, currency))}</td>
    </tr>`).join('')
    const actor = entry.user_id ? nameByUserId.get(entry.user_id) ?? `User ${entry.user_id.slice(0, 8)}` : 'Tshelo system'
    return `<article class="timelineEntry">
      <div class="timelineHeader">
        <div><h3>${escapeHtml(humanise(entry.action))} ${escapeHtml(humanise(entry.entity_type))}</h3><p>by ${escapeHtml(actor)}</p></div>
        <time class="number">${formatDateTime(entry.created_at)}</time>
      </div>
      <div class="recordMeta number">Record ${escapeHtml(entry.entity_id)} · Audit ${escapeHtml(entry.id)}</div>
      <table class="changeTable"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${changeRows || emptyRow(3, 'No field-level values were stored for this action.')}</tbody></table>
    </article>`
  }).join('')

  const legacyEdits = [
    ...contributionEdits.map(edit => ({ ...edit, entityType: 'Contribution', entityId: edit.contribution_id })),
    ...expenseEdits.map(edit => ({ ...edit, entityType: 'Expense', entityId: edit.expense_id })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const legacyEditRows = legacyEdits.map(edit => `<tr>
    <td>${formatDateTime(edit.created_at)}</td>
    <td>${escapeHtml(edit.entityType)}<div class="subtle id">${escapeHtml(edit.entityId)}</div></td>
    <td>${escapeHtml(nameByUserId.get(edit.edited_by) ?? `User ${edit.edited_by.slice(0, 8)}`)}</td>
    <td>${escapeHtml(humanise(edit.field_changed))}</td>
    <td class="breakText">${escapeHtml(edit.old_value ?? 'Not set')}</td>
    <td class="breakText">${escapeHtml(edit.new_value ?? 'Not set')}</td>
    <td>${edit.reason ? escapeHtml(edit.reason) : '<span class="subtle">No reason recorded</span>'}</td>
  </tr>`).join('')

  const recordReferenceRows = [
    ...contributions.map(item => ({
      type: `Contribution, ${money(Number(item.amount ?? 0), currency)}`,
      date: item.created_at,
      recordId: item.id,
      auditId: auditHistory.find(entry => entry.entity_id === item.id)?.id ?? '-',
    })),
    ...expenses.map(item => ({
      type: `Expense, ${money(Number(item.amount ?? 0), currency)}`,
      date: item.created_at,
      recordId: item.id,
      auditId: auditHistory.find(entry => entry.entity_id === item.id)?.id ?? '-',
    })),
  ].sort((a, b) => dateSort(a.date) - dateSort(b.date)).map(item => `<tr>
    <td>${escapeHtml(item.type)}</td>
    <td>${formatShortDate(item.date)}</td>
    <td class="number breakText">${escapeHtml(item.recordId)}</td>
    <td class="number breakText">${escapeHtml(item.auditId)}</td>
  </tr>`).join('')

  const exportRows = exportHistory.map(record => `<tr>
    <td class="number">${formatDateTime(record.created_at)}</td>
    <td>${escapeHtml(humanise(record.export_type))}</td>
    <td>${escapeHtml(nameByUserId.get(record.exported_by) ?? `User ${record.exported_by.slice(0, 8)}`)}</td>
    <td>${record.was_free ? 'Included' : `${record.tokens_spent} token${record.tokens_spent === 1 ? '' : 's'}`}</td>
    <td class="number breakText">${escapeHtml(record.id)}</td>
  </tr>`).join('')

  const eventFact = linkedEvent ? `<div class="eventFact"><span>LINKED EVENT</span><strong>${escapeHtml(linkedEvent.name)}</strong><small>${formatDate(linkedEvent.event_date)}${linkedEvent.venue_name ? ` · ${escapeHtml(linkedEvent.venue_name)}` : ''}</small></div>` : ''
  const logoMarkup = logoDataUri ? `<img class="brandMark" src="${escapeHtml(logoDataUri)}" alt="">` : ''
  const referenceWarning = missingReferenceCount
    ? `<div class="callout warning"><strong>${missingReferenceCount} of ${confirmedContributions.length} receipt${confirmedContributions.length === 1 ? '' : 's'} ${missingReferenceCount === 1 ? 'has' : 'have'} no payment reference.</strong> A mobile-money reference makes a recorded receipt traceable to the provider transaction. Entries without one remain part of the audit record, but Tshelo cannot independently trace the transfer.</div>`
    : `<div class="callout success"><strong>Every confirmed receipt includes a payment reference.</strong> Keep the matching mobile-money statements with this report when it is used for formal review.</div>`

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:14mm 13mm 18mm}
    *{box-sizing:border-box}
    html{background:#fff}
    body{margin:0;color:#182138;font-family:Arial,'Helvetica Neue',sans-serif;font-size:10px;line-height:1.42;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    h1,h2,h3,.serif{font-family:Georgia,'Times New Roman',serif;color:#151d33}
    h1{font-size:28px;line-height:1.08;margin:8px 0 4px}
    h2{font-size:18px;line-height:1.15;margin:0}
    h3{font-size:12px;line-height:1.25;margin:0}
    p{margin:0}
    table{width:100%;border-collapse:collapse;page-break-inside:auto}
    thead{display:table-header-group}
    tr{page-break-inside:avoid}
    th,td{text-align:left;vertical-align:top;padding:7px 6px;border-bottom:1px solid #ddd9d0}
    th{font-size:7.5px;color:#8994a8;text-transform:uppercase;letter-spacing:1.15px;background:#f6f4ef;border-bottom:1px solid #182138}
    td{font-size:8.8px}
    .number{font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace}
    .amount{text-align:right;white-space:nowrap}
    .subtle{color:#8a97ae;font-size:7.7px;margin-top:2px}
    .id{overflow-wrap:anywhere;word-break:break-word}
    .breakText{overflow-wrap:anywhere;word-break:break-word}
    .positiveText{color:#2d6d59}
    .alertText{color:#ab342a}
    .page{page-break-before:always;break-before:page;padding-top:1px}
    .cover{page-break-before:auto;break-before:auto}
    .brandLine{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:11px;border-bottom:3px solid #6840f2}
    .brandIdentity{display:flex;align-items:center;gap:10px}
    .brandMark{width:30px;height:30px;object-fit:contain;border-radius:7px}
    .eyebrow,.label{font-size:7.5px;font-weight:800;letter-spacing:1.6px;color:#6840f2;text-transform:uppercase}
    .coverMeta{color:#5c6980;font-size:10px}
    .fundCode{text-align:right;max-width:170px}
    .fundCode span{display:block;font-size:7.5px;font-weight:800;letter-spacing:1.5px;color:#8c96a8}
    .fundCode strong{display:block;font-size:11px;margin-top:4px;overflow-wrap:anywhere}
    .balanceGrid{display:grid;grid-template-columns:repeat(4,1fr);margin-top:14px;border:1px solid #d9d5cc}
    .balanceGrid>div{min-height:80px;padding:12px;border-right:1px solid #d9d5cc}
    .balanceGrid>div:last-child{border-right:0}
    .balanceGrid span,.facts span,.integrityGrid span{display:block;font-size:7px;color:#8994a8;font-weight:800;letter-spacing:1.15px;text-transform:uppercase}
    .balanceGrid strong{display:block;font-size:15px;margin:11px 0 5px;white-space:nowrap}
    .balanceGrid small,.facts small,.integrityGrid small{display:block;color:#8a97ae;font-size:8px}
    .facts{display:grid;grid-template-columns:repeat(4,1fr);margin-top:14px;background:#f7f5f0;border:1px solid #ddd9d0}
    .facts>div{min-height:72px;padding:12px;border-right:1px solid #ddd9d0;border-bottom:1px solid #ddd9d0}
    .facts>div:nth-child(4n){border-right:0}
    .facts>.eventFact{grid-column:1/-1;min-height:55px;border-right:0}
    .facts strong{display:block;font-size:11px;margin-top:10px}
    .progress{height:4px;background:#dfdbe5;margin-top:7px;overflow:hidden}
    .progress div{height:100%;background:#6840f2}
    .introGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
    .callout{padding:11px 13px;background:#f7f5f0;border:1px solid #ddd9d0;border-left:4px solid #182138;page-break-inside:avoid;margin-top:14px}
    .callout.warning{background:#fff8e8;border-left-color:#d9a514}
    .callout.success{background:#edf6f1;border-left-color:#2d6d59}
    .callout.purple{background:#f2edff;border-left-color:#6840f2}
    .callout strong{font-weight:800}
    .introGrid .callout{margin-top:0}
    .integrity{margin-top:14px;border:1px solid #182138;padding:14px}
    .integrity h3{font-family:Arial,'Helvetica Neue',sans-serif;color:#6840f2;font-size:8px;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:7px}
    .integrityGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:12px;padding-top:10px;border-top:1px solid #ddd9d0}
    .integrityGrid strong{display:block;font-size:10px;margin-top:4px}
    .contents{margin-top:16px}
    .contents h3{margin-bottom:7px}
    .contentsRow{display:grid;grid-template-columns:28px 175px 1fr;padding:4px 0;border-bottom:1px dotted #c9c4ba}
    .contentsRow b:first-child{color:#6840f2}
    .contentsRow span{color:#8a97ae}
    .chapterHeader{display:flex;align-items:baseline;gap:12px;padding-bottom:9px;border-bottom:1.5px solid #182138;margin-bottom:11px}
    .chapterNo{color:#6840f2;font-size:8px;font-weight:800;letter-spacing:1.5px}
    .chapterCount{margin-left:auto;color:#8c96a8;font-size:8px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase}
    .chapterIntro{font-size:10px;color:#5c6980;margin-bottom:12px}
    .sectionTitle{font-size:13px;margin:15px 0 8px;page-break-after:avoid}
    .reconcile{margin:14px 0}
    .reconcile td{padding:6px}
    .reconcile tr:last-child{background:#f1edff;border-bottom:2px solid #6840f2;font-weight:800}
    .pill{display:inline-block;padding:2px 8px;border-radius:12px;background:#efede8;color:#5f697b;font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;white-space:nowrap}
    .pill.success{background:#e8f3ed;color:#2d6d59}
    .pill.warning{background:#fff0df;color:#9f5e0b}
    .pill.gold{background:#fff1cf;color:#986814}
    .pill.owner{background:#eee8ff;color:#6840f2}
    .empty{text-align:center;color:#8a97ae;padding:18px;border:1px dashed #cbc6bb}
    .timelineEntry{border-left:2px solid #c9c4ba;padding:0 0 10px 12px;margin:0 0 9px;page-break-inside:avoid;break-inside:avoid-page}
    .timelineHeader{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
    .timelineHeader p{color:#66748b;margin-top:2px}
    .timelineHeader time{color:#8a97ae;font-size:8px;white-space:nowrap}
    .recordMeta{margin:6px 0;padding:5px 7px;background:#f7f5f0;color:#79869b;font-size:7px;overflow-wrap:anywhere}
    .changeTable th,.changeTable td{padding:5px 6px}
    .appendixTable td{font-size:7.6px}
    .footer{position:fixed;left:0;right:0;bottom:-12mm;padding-top:5px;border-top:1px solid #d9d5cc;display:flex;justify-content:space-between;color:#505866;font-size:7px}
  </style></head><body>
    <div class="footer"><span>Tshelo Fund Statement · ${escapeHtml(fund.title)} · ${escapeHtml(fund.fund_code)}</span><span>Complete audit report · Issued ${formatShortDate(generatedAt)}</span></div>

    <main class="cover">
      <div class="brandLine">
        <div><div class="brandIdentity">${logoMarkup}<span class="eyebrow">Tshelo Fund Statement</span></div><h1>${escapeHtml(fund.title)}</h1><p class="coverMeta">Statement period ${formatDate(fund.created_at)} to ${formatDate(generatedAt)} · Issued ${formatDate(generatedAt)}</p></div>
        <div class="fundCode"><span>FUND CODE</span><strong class="number">${escapeHtml(fund.fund_code)}</strong></div>
      </div>

      <div class="balanceGrid">
        <div><span>Opening balance</span><strong class="number">${money(0, currency)}</strong><small>${formatDate(fund.created_at)}</small></div>
        <div><span>Total received</span><strong class="number positiveText">${money(totalIn, currency)}</strong><small>${confirmedContributions.length} confirmed receipt${confirmedContributions.length === 1 ? '' : 's'}</small></div>
        <div><span>Total paid out</span><strong class="number">${money(totalOut, currency)}</strong><small>${fundExpenses.length} recorded expense${fundExpenses.length === 1 ? '' : 's'}</small></div>
        <div><span>Closing balance</span><strong class="number" style="color:#6840f2">${money(balance, currency)}</strong><small>${formatDate(generatedAt)}</small></div>
      </div>

      <div class="facts">
        <div><span>Fund opened</span><strong>${formatDate(fund.created_at)}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(humanise(fund.status))}</strong></div>
        <div><span>Contribution deadline</span><strong>${formatDate(fund.contribution_deadline)}</strong></div>
        <div><span>Visibility</span><strong>${fund.is_private ? 'Private' : 'Public'}</strong></div>
        <div><span>Target</span><strong class="number">${money(goal, currency)}</strong></div>
        <div><span>Progress to target</span><strong>${progress} percent</strong><div class="progress"><div style="width:${Math.min(progress, 100)}%"></div></div></div>
        <div><span>MEMBERS</span><strong>${fundMemberCount(joinedMembers.length)}</strong></div>
        <div><span>Contributors</span><strong>${contributors.length}</strong></div>
        ${eventFact}
      </div>

      <div class="introGrid">
        <div class="callout"><strong>What this statement is.</strong> A complete report of the fund records available to Tshelo at issue time, including confirmed contributions, expenses, pledges, membership, audit entries, amendments and prior exports.</div>
        <div class="callout warning"><strong>What it is not.</strong> Tshelo does not hold, move or process this money. The closing balance is the arithmetic of what members recorded, not a bank or mobile-money balance.</div>
      </div>

      <div class="integrity">
        <h3>Audit integrity</h3>
        <p>This report preserves stored record identifiers and the complete audit history returned for this fund. Use payment references and receipts to reconcile recorded entries with the relevant mobile-money provider or supplier.</p>
        <div class="integrityGrid">
          <div><span>Issued at</span><strong class="number">${formatDateTime(generatedAt)}</strong></div>
          <div><span>Audit entries</span><strong>${auditHistory.length}</strong></div>
          <div><span>Report scope</span><strong>Complete history</strong></div>
        </div>
      </div>

      <div class="contents"><h3>Contents</h3>
        <div class="contentsRow"><b>01</b><b>Statement of account</b><span>Every confirmed movement with a running balance</span></div>
        <div class="contentsRow"><b>02</b><b>Contributors</b><span>What each person pledged, paid and still owes</span></div>
        <div class="contentsRow"><b>03</b><b>Expenses and sponsorship</b><span>Fund spending and items paid for directly</span></div>
        <div class="contentsRow"><b>04</b><b>Governance</b><span>Who belongs to the fund and in which role</span></div>
        <div class="contentsRow"><b>05</b><b>Audit trail</b><span>Stored actions and before-and-after values</span></div>
        <div class="contentsRow"><b>06</b><b>Appendix, record references</b><span>Technical identifiers and previous exports</span></div>
      </div>
    </main>

    <section class="page">
      <header class="chapterHeader"><span class="chapterNo">01</span><h2>Statement of account</h2><span class="chapterCount">${movementRows.length} movement${movementRows.length === 1 ? '' : 's'}</span></header>
      <p class="chapterIntro">Every confirmed movement of money in date order. The balance carries forward, so each figure can be checked against the line above it. Pledges do not appear until money is confirmed.</p>
      <table><thead><tr><th>Date</th><th>Description</th><th>Method</th><th>Reference</th><th class="amount">In</th><th class="amount">Out</th><th class="amount">Balance</th></tr></thead><tbody>
        <tr><td colspan="6"><strong>Opening balance, ${formatDate(fund.created_at)}</strong></td><td class="number amount"><strong>${money(0, currency)}</strong></td></tr>
        ${statementRows || emptyRow(7, 'No confirmed money movements have been recorded.')}
        <tr><td colspan="4"><strong>Totals for the period</strong></td><td class="number amount"><strong>${money(totalIn, currency)}</strong></td><td class="number amount"><strong>${money(totalOut, currency)}</strong></td><td></td></tr>
        <tr style="background:#f1edff;border-bottom:2px solid #6840f2"><td colspan="6"><strong>Closing balance, ${formatDate(generatedAt)}</strong></td><td class="number amount"><strong>${money(balance, currency)}</strong></td></tr>
      </tbody></table>
      ${referenceWarning}
      <h3 class="sectionTitle">Reconciliation</h3>
      <table class="reconcile"><tbody>
        <tr><td>Opening balance</td><td class="number amount">${money(0, currency)}</td></tr>
        <tr><td>Add: confirmed receipts</td><td class="number amount">${money(totalIn, currency)}</td></tr>
        <tr><td>Less: expenses paid by the fund</td><td class="number amount">${money(totalOut, currency)}</td></tr>
        <tr><td>Closing balance held by the organiser</td><td class="number amount">${money(balance, currency)}</td></tr>
      </tbody></table>
      <div class="callout"><strong>The closing balance is held by the organiser, not by Tshelo.</strong> It is the total recorded as received less the total recorded as spent. Tshelo has not seen the organiser's account.</div>
      <h3 class="sectionTitle">Complete contribution ledger (${contributions.length})</h3>
      <table><thead><tr><th>Recorded</th><th>Contributor / record</th><th>Status</th><th>Payment</th><th>Note</th><th class="amount">Pledged</th><th class="amount">Amount</th></tr></thead><tbody>${allContributionRows || emptyRow(7, 'No contributions or pledges recorded.')}</tbody></table>
    </section>

    <section class="page">
      <header class="chapterHeader"><span class="chapterNo">02</span><h2>Contributors</h2><span class="chapterCount">${contributors.length} ${contributors.length === 1 ? 'person' : 'people'}</span></header>
      <p class="chapterIntro">What each person promised, what has arrived, and what is still outstanding. Contact numbers are partly masked in this document.</p>
      <table><thead><tr><th>Contributor</th><th>Standing</th><th>Contact</th><th class="amount">Payments</th><th class="amount">Pledged</th><th class="amount">Received</th><th class="amount">Outstanding</th></tr></thead><tbody>${contributorRows || emptyRow(7, 'No contributors recorded.')}</tbody></table>
      <h3 class="sectionTitle">Pledges outstanding</h3>
      <p class="chapterIntro">A pledge is a stated intention to contribute. It is not money and is excluded from every balance in this statement.</p>
      <table><thead><tr><th>Contributor</th><th>Purpose</th><th>Pledged on</th><th class="amount">Pledged</th><th class="amount">Received</th><th class="amount">Outstanding</th></tr></thead><tbody>${pledgeRows || emptyRow(6, 'No pledges are outstanding.')}</tbody></table>
      <h3 class="sectionTitle">Pledges settled in full</h3>
      <table><thead><tr><th>Contributor</th><th>Purpose</th><th>Pledged on</th><th class="amount">Pledged</th><th>Status</th></tr></thead><tbody>${settledPledgeRows || emptyRow(5, 'No settled pledges are stored.')}</tbody></table>
      <div class="callout purple"><strong>Progress against target.</strong> ${money(totalIn, currency)} received against a target of ${money(goal, currency)}, leaving ${money(targetOutstanding, currency)} to raise. ${money(pledgeOutstanding, currency)} is already covered by open pledges.</div>
    </section>

    <section class="page">
      <header class="chapterHeader"><span class="chapterNo">03</span><h2>Expenses and sponsorship</h2><span class="chapterCount">${fundExpenses.length} paid, ${sponsorshipItems.length + sponsoredPurchases.length} sponsored</span></header>
      <p class="chapterIntro">Expenses paid by the fund reduce the balance. Sponsored items are paid for directly by an individual and do not touch the fund balance.</p>
      <h3 class="sectionTitle">Expenses paid by the fund</h3>
      <table><thead><tr><th>Date</th><th>Expense</th><th>Vendor</th><th>Evidence / status</th><th class="amount">Amount</th></tr></thead><tbody>${expenseRows || emptyRow(5, `No expenses have been recorded. The full ${money(totalIn, currency)} received remains unspent.`)}</tbody></table>
      <h3 class="sectionTitle">Items sponsored directly</h3>
      <table><thead><tr><th>Item</th><th>Sponsor</th><th>Status</th><th class="amount">Target cost</th><th class="amount">Covered</th><th class="amount">Outstanding</th></tr></thead><tbody>${sponsorshipRows || emptyRow(6, 'No sponsorship items have been recorded.')}</tbody></table>
      ${sponsoredPurchases.length ? `<h3 class="sectionTitle">Sponsored purchases</h3><table><thead><tr><th>Date</th><th>Item</th><th>Sponsor</th><th>Vendor</th><th class="amount">Value</th></tr></thead><tbody>${sponsoredPurchaseRows}</tbody></table>` : ''}
      <h3 class="sectionTitle">Contributor recognition</h3>
      <table><thead><tr><th>Recipient</th><th>Recognition</th><th>Sponsored item</th><th>Date</th></tr></thead><tbody>${awardRows || emptyRow(4, 'No Rich Auntie recognition has been awarded.')}</tbody></table>
      <div class="callout"><strong>Recognition carries no monetary value.</strong> It is excluded from every financial total and appears here only to explain recorded generosity.</div>
      <h3 class="sectionTitle">Complete expense ledger (${expenses.length})</h3>
      <table><thead><tr><th>Recorded</th><th>Expense / record</th><th>Vendor / category</th><th>Status</th><th>Receipt</th><th class="amount">Amount</th></tr></thead><tbody>${allExpenseRows || emptyRow(6, 'No expense records, including deleted expenses.')}</tbody></table>
    </section>

    <section class="page">
      <header class="chapterHeader"><span class="chapterNo">04</span><h2>Governance</h2><span class="chapterCount">${fundMemberCount(joinedMembers.length)} member${fundMemberCount(joinedMembers.length) === 1 ? '' : 's'}</span></header>
      <p class="chapterIntro">Who belongs to this fund, which role is recorded for each person, and when they joined. Inactive and invited membership rows remain visible for audit completeness.</p>
      <h3 class="sectionTitle">Complete member register (${members.length})</h3>
      <table><thead><tr><th>Member / record</th><th>Role</th><th>Status</th><th>Contact</th><th>Invited</th><th>Joined</th></tr></thead><tbody>${memberRows || emptyRow(6, 'No membership rows were stored; the organiser is still counted in the summary.')}</tbody></table>
      <div class="callout warning"><strong>Read authority alongside the audit trail.</strong> A person's recorded role helps explain why they could create or amend a record. The audit trail below shows the named account and exact time stored for each action.</div>
      ${linkedEvent ? `<h3 class="sectionTitle">Linked event</h3><div class="integrityGrid"><div><span>Event</span><strong>${escapeHtml(linkedEvent.name)}</strong></div><div><span>Date</span><strong>${formatDate(linkedEvent.event_date)}</strong></div><div><span>Venue</span><strong>${escapeHtml(linkedEvent.venue_name ?? 'Not set')}</strong></div></div>` : ''}
      ${fund.description ? `<h3 class="sectionTitle">Fund purpose</h3><div class="callout">${escapeHtml(fund.description)}</div>` : ''}
    </section>

    <section class="page">
      <header class="chapterHeader"><span class="chapterNo">05</span><h2>Audit trail</h2><span class="chapterCount">${auditHistory.length} action${auditHistory.length === 1 ? '' : 's'}</span></header>
      <p class="chapterIntro">Every stored action returned for this fund, oldest first, with the person responsible and exact time. Where before-and-after values are available, both appear below.</p>
      ${auditRows || '<div class="empty">No audit entries are stored for this fund.</div>'}
      <h3 class="sectionTitle">Legacy field edit history (${legacyEdits.length})</h3>
      <table><thead><tr><th>Edited</th><th>Record</th><th>Editor</th><th>Field</th><th>Before</th><th>After</th><th>Reason</th></tr></thead><tbody>${legacyEditRows || emptyRow(7, 'No legacy contribution or expense edits are stored.')}</tbody></table>
      <div class="callout success"><strong>Audit history is intentionally complete.</strong> Entries are not truncated by the PDF generator. Long histories continue onto additional pages with their identifiers and recorded values intact.</div>
    </section>

    <section class="page">
      <header class="chapterHeader"><span class="chapterNo">06</span><h2>Appendix, record references</h2><span class="chapterCount">For technical review</span></header>
      <p class="chapterIntro">System identifiers for financial records in this statement. These are useful when a contribution, expense, dispute or audit entry must be traced inside Tshelo.</p>
      <table class="appendixTable"><thead><tr><th>Record</th><th>Date</th><th>Record identifier</th><th>Audit identifier</th></tr></thead><tbody>${recordReferenceRows || emptyRow(4, 'No financial record identifiers are available.')}</tbody></table>
      <h3 class="sectionTitle">Statements previously issued for this fund</h3>
      <table><thead><tr><th>Issued</th><th>Format</th><th>Issued by</th><th>Charge</th><th>Export reference</th></tr></thead><tbody>${exportRows || emptyRow(5, 'No earlier report exports are stored.')}</tbody></table>
      <h3 class="sectionTitle">How to read this statement</h3>
      <div class="introGrid">
        <div class="callout"><strong>Tshelo can confirm</strong> the records, identifiers, timestamps, before-and-after values and arithmetic presented from its stored data at issue time.</div>
        <div class="callout warning"><strong>Tshelo cannot confirm</strong> that money physically moved, that a closing balance exists in an account, or that a named contributor was the person who paid.</div>
      </div>
      <div class="callout"><strong>Reliance by a third party.</strong> Treat this document as a detailed record of what was entered into Tshelo. Where a decision depends on whether money actually moved, request the matching provider statements and compare their references and dates with the statement of account.</div>
    </section>
  </body></html>`
}
