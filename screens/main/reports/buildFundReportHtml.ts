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
  return value
    ? new Date(value).toLocaleDateString('en-BW', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Not set'
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-BW', {
    day: 'numeric',
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

  const confirmedContributions = contributions.filter(item => item.status === 'confirmed' && !item.is_refunded)
  const activeExpenses = expenses.filter(item => !item.deleted_at)
  const fundExpenses = activeExpenses.filter(item => !item.is_sponsored)
  const sponsoredPurchases = activeExpenses.filter(item => item.is_sponsored)
  const openPledges = pledgeBalances.filter(item => Number(item.outstanding_amount ?? 0) > 0)

  const totalIn = confirmedContributions.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const totalOut = fundExpenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const pledged = pledgeBalances.reduce((sum, item) => sum + Number(item.pledged_amount ?? 0), 0)
  const pledgeOutstanding = openPledges.reduce((sum, item) => sum + Number(item.outstanding_amount ?? 0), 0)
  const balance = totalIn - totalOut
  const goal = Math.max(Number(fund.goal_amount ?? 0), 0)
  const targetOutstanding = Math.max(goal - totalIn, 0)
  const overTarget = Math.max(totalIn - goal, 0)
  const progress = goal > 0 ? Math.min(Math.round(totalIn / goal * 100), 999) : 0

  const contributorById = new Map(contributors.map(contributor => [contributor.id, contributor]))
  const nameByUserId = new Map<string, string>()
  contributors.forEach(contributor => {
    if (contributor.user_id) nameByUserId.set(contributor.user_id, contributor.display_name)
  })
  memberProfiles.forEach(profile => nameByUserId.set(profile.user_id, profile.name))
  const sponsorshipById = new Map(sponsorshipItems.map(item => [item.id, item]))
  const pledgeById = new Map(contributions.map(item => [item.id, item]))

  const allContributionRows = contributions.map(item => {
    const recorded = item.confirmed_at ?? item.created_at
    const status = item.is_refunded ? 'Refunded' : humanise(item.status)
    const amount = Number(item.amount ?? 0)
    const pledgedAmount = Number(item.pledged_amount ?? 0)
    return `<tr>
      <td>${formatDateTime(recorded)}</td>
      <td><strong>${escapeHtml(item.contributor_name)}</strong><div class="subtle">ID: ${escapeHtml(item.id)}</div></td>
      <td>${escapeHtml(status)}${item.is_refunded ? ' <span class="pill warning">Refunded</span>' : ''}</td>
      <td>${escapeHtml(humanise(item.payment_method))}<div class="subtle">${item.reference_number ? `Ref: ${escapeHtml(item.reference_number)}` : 'No reference'}</div></td>
      <td>${item.notes ? escapeHtml(item.notes) : '<span class="subtle">No note</span>'}</td>
      <td class="amount">${pledgedAmount > 0 ? money(pledgedAmount, currency) : '-'}</td>
      <td class="amount ${item.is_refunded ? 'expense' : 'positive'}">${money(amount, currency)}</td>
    </tr>`
  }).join('')

  const contributionRows = confirmedContributions.map(item => {
    const method = humanise(item.payment_method)
    const reference = item.reference_number ? `Ref: ${escapeHtml(item.reference_number)}` : 'No reference'
    return `<tr>
      <td>${formatDate(item.confirmed_at ?? item.created_at)}</td>
      <td><strong>${escapeHtml(item.contributor_name)}</strong></td>
      <td>${escapeHtml(method)}<div class="subtle">${reference}</div></td>
      <td>${item.notes ? escapeHtml(item.notes) : '<span class="subtle">No note</span>'}</td>
      <td class="amount positive">${money(Number(item.amount ?? 0), currency)}</td>
    </tr>`
  }).join('')

  const pledgeRows = openPledges.map(item => {
    const contributor = contributorById.get(item.contributor_id ?? '')
    const sourcePledge = pledgeById.get(item.pledge_id)
    return `<tr>
      <td>${escapeHtml(contributor?.display_name ?? sourcePledge?.contributor_name ?? 'Contributor')}</td>
      <td class="amount">${money(Number(item.pledged_amount ?? 0), currency)}</td>
      <td class="amount positive">${money(Number(item.allocated_amount ?? 0), currency)}</td>
      <td class="amount expense">${money(Number(item.outstanding_amount ?? 0), currency)}</td>
      <td>${sourcePledge?.notes ? escapeHtml(sourcePledge.notes) : '<span class="subtle">No note</span>'}</td>
    </tr>`
  }).join('')

  const expenseRows = fundExpenses.map(item => `<tr>
    <td>${formatDate(item.created_at)}</td>
    <td><strong>${escapeHtml(item.description)}</strong></td>
    <td>${escapeHtml(item.vendor_name ?? '-')}<div class="subtle">${escapeHtml(humanise(item.category))}</div></td>
    <td>${item.has_open_query ? '<span class="pill warning">Query open</span>' : '<span class="pill">Recorded</span>'}</td>
    <td class="amount expense">${money(Number(item.amount ?? 0), currency)}</td>
  </tr>`).join('')

  const allExpenseRows = expenses.map(item => {
    const status = item.deleted_at
      ? '<span class="pill warning">Deleted</span>'
      : item.is_sponsored
        ? '<span class="pill gold">Sponsored</span>'
        : '<span class="pill">Recorded</span>'
    return `<tr>
      <td>${formatDateTime(item.created_at)}</td>
      <td><strong>${escapeHtml(item.item_name ?? item.description)}</strong><div class="subtle">ID: ${escapeHtml(item.id)}</div></td>
      <td>${escapeHtml(item.vendor_name ?? '-')}<div class="subtle">${escapeHtml(humanise(item.category))}</div></td>
      <td>${status}${item.has_open_query ? ' <span class="pill warning">Query open</span>' : ''}</td>
      <td>${item.receipt_url ? `<span class="receipt">Receipt recorded</span><div class="subtle breakText">${escapeHtml(item.receipt_url)}</div>` : '<span class="subtle">No receipt</span>'}</td>
      <td class="amount ${item.deleted_at ? 'muted' : item.is_sponsored ? 'goldText' : 'expense'}">${money(Number(item.amount ?? 0), currency)}</td>
    </tr>`
  }).join('')

  const sponsorshipRows = sponsorshipItems.map(item => {
    const sponsor = item.claimed_by_user_id ? nameByUserId.get(item.claimed_by_user_id) : null
    return `<tr>
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td>${escapeHtml(sponsor ?? 'Not claimed')}</td>
      <td><span class="pill gold">${escapeHtml(humanise(item.status))}</span></td>
      <td class="amount">${money(Number(item.target_amount ?? 0), currency)}</td>
      <td class="amount positive">${money(Number(item.allocated_amount ?? 0), currency)}</td>
      <td class="amount ${Number(item.outstanding_amount ?? 0) > 0 ? 'expense' : ''}">${money(Number(item.outstanding_amount ?? 0), currency)}</td>
    </tr>`
  }).join('')

  const sponsoredPurchaseRows = sponsoredPurchases.map(item => `<tr>
    <td>${formatDate(item.created_at)}</td>
    <td><strong>${escapeHtml(item.description)}</strong></td>
    <td>${escapeHtml(item.sponsored_by_name ?? (item.sponsored_by_user_id ? nameByUserId.get(item.sponsored_by_user_id) : null) ?? 'Sponsor')}</td>
    <td>${escapeHtml(item.vendor_name ?? '-')}</td>
    <td class="amount goldText">${money(Number(item.amount ?? 0), currency)}</td>
  </tr>`).join('')

  const awardRows = richAuntieAwards.map(award => {
    const item = award.sponsorship_item_id ? sponsorshipById.get(award.sponsorship_item_id) : null
    return `<tr>
      <td><span class="crown">&#9819;</span> <strong>${escapeHtml(nameByUserId.get(award.recipient_user_id) ?? 'Fund member')}</strong></td>
      <td>${escapeHtml(award.reason_label)}</td>
      <td>${escapeHtml(item?.title ?? 'General recognition')}</td>
      <td>${formatDate(award.created_at)}</td>
    </tr>`
  }).join('')

  const contributorRows = contributors.map(contributor => {
    const contributorPledges = pledgeBalances.filter(item => item.contributor_id === contributor.id)
    const received = confirmedContributions
      .filter(item => item.contributor_id === contributor.id)
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
    const promised = contributorPledges.reduce((sum, item) => sum + Number(item.pledged_amount ?? 0), 0)
    const due = contributorPledges.reduce((sum, item) => sum + Number(item.outstanding_amount ?? 0), 0)
    return `<tr>
      <td><strong>${escapeHtml(contributor.display_name)}</strong><div class="subtle">${escapeHtml(humanise(contributor.contributor_type))}</div></td>
      <td>${escapeHtml(contributor.phone ?? '-')}</td>
      <td class="amount">${money(promised, currency)}</td>
      <td class="amount positive">${money(received, currency)}</td>
      <td class="amount ${due > 0 ? 'expense' : ''}">${money(due, currency)}</td>
    </tr>`
  }).join('')

  const memberRows = members.map(member => {
    const name = member.user_id ? nameByUserId.get(member.user_id) : null
    return `<tr>
      <td><strong>${escapeHtml(name ?? member.invited_name ?? 'Unnamed member')}</strong><div class="subtle">ID: ${escapeHtml(member.id)}</div></td>
      <td>${escapeHtml(member.invited_phone ?? '-')}</td>
      <td>${escapeHtml(humanise(member.role))}</td>
      <td><span class="pill ${member.status === 'joined' ? '' : 'warning'}">${escapeHtml(humanise(member.status))}</span></td>
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
    return `<div class="historyEntry">
      <div class="historyHeader">
        <div><strong>${escapeHtml(humanise(entry.action))} ${escapeHtml(humanise(entry.entity_type))}</strong><div class="subtle">${formatDateTime(entry.created_at)} by ${escapeHtml(actor)}</div></div>
        <div class="historyId">Record ID: ${escapeHtml(entry.entity_id)}<br>Audit ID: ${escapeHtml(entry.id)}</div>
      </div>
      <table class="changeTable"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${changeRows || emptyRow(3, 'No field-level values were stored for this action.')}</tbody></table>
    </div>`
  }).join('')

  const legacyEdits = [
    ...contributionEdits.map(edit => ({ ...edit, entityType: 'Contribution', entityId: edit.contribution_id })),
    ...expenseEdits.map(edit => ({ ...edit, entityType: 'Expense', entityId: edit.expense_id })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const legacyEditRows = legacyEdits.map(edit => `<tr>
    <td>${formatDateTime(edit.created_at)}</td>
    <td>${escapeHtml(edit.entityType)}<div class="subtle">${escapeHtml(edit.entityId)}</div></td>
    <td>${escapeHtml(nameByUserId.get(edit.edited_by) ?? `User ${edit.edited_by.slice(0, 8)}`)}</td>
    <td>${escapeHtml(humanise(edit.field_changed))}</td>
    <td class="breakText">${escapeHtml(edit.old_value ?? 'Not set')}</td>
    <td class="breakText">${escapeHtml(edit.new_value ?? 'Not set')}</td>
    <td>${edit.reason ? escapeHtml(edit.reason) : '<span class="subtle">No reason recorded</span>'}</td>
  </tr>`).join('')

  const exportRows = exportHistory.map(record => `<tr>
    <td>${formatDateTime(record.created_at)}</td>
    <td>${escapeHtml(humanise(record.export_type))}</td>
    <td>${escapeHtml(nameByUserId.get(record.exported_by) ?? `User ${record.exported_by.slice(0, 8)}`)}</td>
    <td>${record.was_free ? 'Free export' : `${record.tokens_spent} token${record.tokens_spent === 1 ? '' : 's'}`}</td>
    <td class="subtle">${escapeHtml(record.id)}</td>
  </tr>`).join('')

  const logoMarkup = logoDataUri
    ? `<img class="logo" src="${escapeHtml(logoDataUri)}" alt="Tshelo logo">`
    : '<div class="logoFallback">T</div>'
  const targetLabel = overTarget > 0 ? 'ABOVE TARGET' : 'TARGET OUTSTANDING'
  const targetValue = overTarget > 0 ? overTarget : targetOutstanding
  const eventSection = linkedEvent ? `<section>
    <h2>Linked event</h2>
    <div class="details">
      <div><span>EVENT</span><strong>${escapeHtml(linkedEvent.name)}</strong></div>
      <div><span>DATE</span><strong>${formatDate(linkedEvent.event_date)}</strong></div>
      <div><span>VENUE</span><strong>${escapeHtml(linkedEvent.venue_name ?? 'Not set')}</strong></div>
    </div>
  </section>` : ''

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:38px 34px 46px}
    *{box-sizing:border-box}
    html{background:#fff}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#19151f;font-size:10px;line-height:1.38;margin:0}
    h1{font-size:24px;line-height:1.12;margin:3px 0 5px}
    h2{font-size:14px;line-height:1.2;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #ebe4fa;page-break-after:avoid}
    p{margin:0}
    section{margin:20px 0;page-break-inside:auto}
    table{width:100%;border-collapse:collapse;page-break-inside:auto}
    thead{display:table-header-group}
    tr{page-break-inside:avoid}
    th,td{text-align:left;vertical-align:top;padding:7px 6px;border-bottom:1px solid #e8e5eb;font-size:8.6px}
    th{font-size:7.5px;color:#6f6875;text-transform:uppercase;letter-spacing:.4px;background:#f8f6fb}
    .reportHeader{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:15px;border-bottom:3px solid #7b2fff}
    .brandBlock{display:flex;align-items:center;gap:11px}
    .logoWrap{width:48px;height:48px;border-radius:12px;background:#19052f;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .logo{width:42px;height:42px;object-fit:contain}
    .logoFallback{color:#a35cff;font-size:28px;font-weight:900}
    .brand{color:#7b2fff;font-size:9px;font-weight:900;letter-spacing:1.1px}
    .muted,.subtle{color:#7d7682}
    .subtle{font-size:7.5px;margin-top:2px}
    .code{text-align:right;font-size:11px;font-weight:800;background:#f0e8ff;padding:8px 11px;border-radius:8px}
    .code small{display:block;color:#7d7682;font-size:7px;letter-spacing:.5px;margin-bottom:2px}
    .details{display:flex;gap:7px;flex-wrap:wrap}
    .details>div{min-width:120px;flex:1;padding:8px 9px;background:#faf9fb;border:1px solid #e6e1eb;border-radius:7px}
    .details span,.metric span{display:block;font-size:7px;color:#746d79;font-weight:800;letter-spacing:.55px;margin-bottom:3px}
    .details strong{font-size:9px}
    .summary{display:flex;flex-wrap:wrap;gap:7px;margin:16px 0}
    .metric{width:31.8%;padding:10px;background:#f6f2fb;border:1px solid #eee8f5;border-radius:8px}
    .metric strong{font-size:14px;white-space:nowrap}
    .progress{height:6px;background:#e6dff0;border-radius:4px;overflow:hidden;margin-top:7px}
    .progress div{height:100%;background:#7b2fff}
    .amount{text-align:right;font-weight:800;white-space:nowrap}
    .positive{color:#6e2bdb}
    .expense{color:#ba3848}
    .goldText{color:#b06f00}
    .pill{display:inline-block;padding:2px 6px;border-radius:8px;background:#eeeaf2;color:#5d5663;font-size:7px;font-weight:800}
    .pill.warning{background:#fff1db;color:#9b5b00}
    .pill.gold{background:#fff2cc;color:#a96900}
    .crown{color:#d98a00;font-size:12px}
    .receipt{color:#087d59;font-weight:800}
    .breakText{overflow-wrap:anywhere;word-break:break-word}
    .empty{text-align:center;color:#827b88;padding:13px}
    .note{padding:10px 12px;background:#faf9fb;border-left:3px solid #7b2fff}
    .scopeNote{margin:10px 0 16px;padding:9px 11px;background:#f1eaff;border:1px solid #ded0ff;border-radius:7px;color:#4c336d}
    .historyEntry{display:block;border:1px solid #ddd5e7;border-radius:8px;margin:0 0 10px;overflow:hidden;page-break-inside:avoid;break-inside:avoid-page}
    .historyHeader{display:flex;justify-content:space-between;gap:12px;padding:9px 10px;background:#f8f5fb;page-break-after:avoid;break-after:avoid-page}
    .historyId{text-align:right;color:#77707c;font-size:6.8px;overflow-wrap:anywhere;max-width:46%}
    .changeTable th,.changeTable td{padding:5px 7px}
    .footer{margin-top:25px;padding-top:9px;border-top:1px solid #ddd6e3;color:#817a86;font-size:7.5px}
  </style></head><body>
    <div class="reportHeader">
      <div class="brandBlock"><div class="logoWrap">${logoMarkup}</div><div><div class="brand">TSHELO FUND REPORT</div><h1>${escapeHtml(fund.title)}</h1><div class="muted">Generated ${formatDate(generatedAt)}</div></div></div>
      <div class="code"><small>FUND CODE</small>${escapeHtml(fund.fund_code)}</div>
    </div>

    <div class="details">
      <div><span>CREATED</span><strong>${formatDate(fund.created_at)}</strong></div>
      <div><span>STATUS</span><strong>${escapeHtml(humanise(fund.status))}</strong></div>
      <div><span>TYPE</span><strong>${escapeHtml(humanise(fund.fund_type))}</strong></div>
      <div><span>DEADLINE</span><strong>${formatDate(fund.contribution_deadline)}</strong></div>
      <div><span>VISIBILITY</span><strong>${fund.is_private ? 'Private' : 'Public'}</strong></div>
      <div><span>MEMBERS</span><strong>${fundMemberCount(members.filter(member => member.status === 'joined').length)}</strong></div>
    </div>

    <div class="scopeNote"><strong>Complete report:</strong> this document includes current records, deleted or inactive records, every stored audit entry, legacy contribution and expense edits, and prior report exports. History is shown in chronological order without a PDF-side row limit.</div>

    ${fund.description ? `<section><h2>Purpose</h2><div class="note">${escapeHtml(fund.description)}</div></section>` : ''}

    <div class="summary">
      <div class="metric"><span>TOTAL IN</span><strong class="positive">${money(totalIn, currency)}</strong></div>
      <div class="metric"><span>TOTAL OUT</span><strong class="expense">${money(totalOut, currency)}</strong></div>
      <div class="metric"><span>AVAILABLE BALANCE</span><strong>${money(balance, currency)}</strong></div>
      <div class="metric"><span>FUND TARGET</span><strong>${money(goal, currency)}</strong><div class="progress"><div style="width:${Math.min(progress, 100)}%"></div></div><div class="subtle">${progress}% funded</div></div>
      <div class="metric"><span>${targetLabel}</span><strong class="${overTarget > 0 ? 'positive' : ''}">${money(targetValue, currency)}</strong></div>
      <div class="metric"><span>OPEN PLEDGES</span><strong>${money(pledgeOutstanding, currency)}</strong><div class="subtle">${money(pledged, currency)} pledged overall</div></div>
    </div>

    ${eventSection}

    <section><h2>Money received (${confirmedContributions.length})</h2><table><thead><tr><th>Date</th><th>Contributor</th><th>Payment</th><th>Note</th><th class="amount">Amount</th></tr></thead><tbody>${contributionRows || emptyRow(5, 'No money received.')}</tbody></table></section>

    <section><h2>Complete contribution ledger (${contributions.length})</h2><table><thead><tr><th>Recorded</th><th>Contributor<br>/ record</th><th>Status</th><th>Payment</th><th>Note</th><th class="amount">Pledged</th><th class="amount">Amount</th></tr></thead><tbody>${allContributionRows || emptyRow(7, 'No contributions or pledges recorded.')}</tbody></table></section>

    <section><h2>Open pledges (${openPledges.length})</h2><table><thead><tr><th>Contributor</th><th class="amount">Pledged</th><th class="amount">Received</th><th class="amount">Outstanding</th><th>Note</th></tr></thead><tbody>${pledgeRows || emptyRow(5, 'No open pledges.')}</tbody></table></section>

    <section><h2>Expenses paid (${fundExpenses.length})</h2><table><thead><tr><th>Date</th><th>Expense</th><th>Vendor / category</th><th>Status</th><th class="amount">Amount</th></tr></thead><tbody>${expenseRows || emptyRow(5, 'No fund expenses paid.')}</tbody></table></section>

    <section><h2>Complete expense ledger (${expenses.length})</h2><table><thead><tr><th>Recorded</th><th>Expense<br>/ record</th><th>Vendor<br>/ category</th><th>Status</th><th>Receipt</th><th class="amount">Amount</th></tr></thead><tbody>${allExpenseRows || emptyRow(6, 'No expense records, including deleted expenses.')}</tbody></table></section>

    <section><h2>Sponsored items (${sponsorshipItems.length})</h2><table><thead><tr><th>Item</th><th>Sponsor</th><th>Status</th><th class="amount">Target</th><th class="amount">Covered</th><th class="amount">Outstanding</th></tr></thead><tbody>${sponsorshipRows || emptyRow(6, 'No sponsored items.')}</tbody></table>${sponsoredPurchases.length ? `<h2 style="margin-top:15px">Sponsored purchases (${sponsoredPurchases.length})</h2><table><thead><tr><th>Date</th><th>Item</th><th>Sponsor</th><th>Vendor</th><th class="amount">Value</th></tr></thead><tbody>${sponsoredPurchaseRows}</tbody></table>` : ''}</section>

    <section><h2>Rich Auntie recognition (${richAuntieAwards.length})</h2><table><thead><tr><th>Recipient</th><th>Recognition</th><th>Sponsored item</th><th>Awarded</th></tr></thead><tbody>${awardRows || emptyRow(4, 'No Rich Auntie recognition awarded.')}</tbody></table></section>

    <section><h2>Contributor summary (${contributors.length})</h2><table><thead><tr><th>Contributor</th><th>Phone</th><th class="amount">Pledged</th><th class="amount">Received</th><th class="amount">Outstanding</th></tr></thead><tbody>${contributorRows || emptyRow(5, 'No contributors recorded.')}</tbody></table></section>

    <section><h2>Complete member register (${members.length})</h2><table><thead><tr><th>Member / record</th><th>Invited phone</th><th>Role</th><th>Status</th><th>Invited</th><th>Joined</th></tr></thead><tbody>${memberRows || emptyRow(6, 'No membership rows were stored; the organiser is still counted above.')}</tbody></table></section>

    <section><h2>Complete fund history (${auditHistory.length})</h2><div class="note" style="margin-bottom:10px">Every stored audit action is listed from oldest to newest. Each changed field shows its recorded value before and after the action.</div>${auditRows || '<div class="empty">No audit entries are stored for this fund.</div>'}</section>

    <section><h2>Legacy field edit history (${legacyEdits.length})</h2><table><thead><tr><th>Edited</th><th>Record</th><th>Editor</th><th>Field</th><th>Before</th><th>After</th><th>Reason</th></tr></thead><tbody>${legacyEditRows || emptyRow(7, 'No legacy contribution or expense edits are stored.')}</tbody></table></section>

    <section><h2>Report export history (${exportHistory.length})</h2><table><thead><tr><th>Exported</th><th>Format</th><th>Exported by</th><th>Charge</th><th>Export record</th></tr></thead><tbody>${exportRows || emptyRow(5, 'No earlier report exports are stored.')}</tbody></table></section>

    <div class="footer">This full report reflects all fund records available to Tshelo at the time it was generated. Sponsored purchases are reported separately from money paid out by the fund. Deleted and inactive records remain visible in the complete ledgers. Confirm supporting receipts and payment references before relying on this report for formal accounting.</div>
  </body></html>`
}
