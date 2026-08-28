'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { BarChart3, Download, FileText, RefreshCw, Share2 } from 'lucide-react'
import type { FundExport, FundExportType, FundReportBundle, FundPermission } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { DocumentPreviewDialog } from '@/components/documents/document-preview-dialog'
import { buildFundReportDocumentHtml } from '@/lib/fund-report-document'
import { formatDate } from '@/lib/format'
import { invalidateHomeSummary, loadHomeSummary } from '@/lib/home-summary-cache'

type Period = '1M' | '3M' | '6M' | '1Y'
type EntryType = 'contribution' | 'expense'
type FundOption = { id: string; title: string; currency: string }
type LedgerEntry = { id: string; fundId: string; type: EntryType; amount: number; date: string; description: string }
type PledgeEntry = { id: string; fundId: string; amount: number; received: number; date: string; description: string }
type ChartPoint = { key: string; label: string; contributions: number; expenses: number }
type ReportState = {
  reportsByFund: Record<string, FundReportBundle>
  funds: FundOption[]
  entries: LedgerEntry[]
  pledges: PledgeEntry[]
  exports: FundExport[]
}

const PERIOD_MONTHS: Record<Period, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }

function money(amount: number, currency: string) {
  const symbol = currency === 'BWP' ? 'P' : currency
  return `${symbol} ${amount.toLocaleString('en-BW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
}

function startOfPeriod(period: Period) {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - PERIOD_MONTHS[period] + 1, 1)
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function reportStateFromBundles(bundles: FundReportBundle[]): ReportState {
  const reportsByFund = Object.fromEntries(bundles.map(bundle => [bundle.fund.id, bundle]))
  const funds = bundles.map(bundle => ({ id: bundle.fund.id, title: bundle.fund.title, currency: bundle.fund.currency_code }))
  const contributionEntries = bundles.flatMap(bundle => bundle.contributions
    .filter(row => row.status === 'confirmed' && !row.is_refunded && row.confirmed_at)
    .map(row => ({
      id: row.id,
      fundId: bundle.fund.id,
      type: 'contribution' as const,
      amount: Number(row.amount),
      date: row.confirmed_at!,
      description: row.contributor_name || 'Contribution',
    })))
  const expenseEntries = bundles.flatMap(bundle => bundle.expenses
    .filter(row => !row.deleted_at && !row.is_sponsored)
    .map(row => ({
      id: row.id,
      fundId: bundle.fund.id,
      type: 'expense' as const,
      amount: Number(row.amount),
      date: row.created_at,
      description: row.description || row.vendor_name || 'Expense',
    })))
  const pledges = bundles.flatMap(bundle => bundle.pledge_balances.map(row => ({
    id: row.pledge_id,
    fundId: bundle.fund.id,
    amount: Number(row.pledged_amount),
    received: Number(row.allocated_amount),
    date: row.created_at,
    description: row.contributor_name || 'Pledge',
  })))

  return {
    reportsByFund,
    funds,
    entries: [...contributionEntries, ...expenseEntries].sort((a, b) => b.date.localeCompare(a.date)),
    pledges,
    exports: bundles.flatMap(bundle => bundle.export_history).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  }
}

function MovementChart({ points }: { points: ChartPoint[] }) {
  const maximum = Math.max(1, ...points.flatMap(point => [point.contributions, point.expenses]))

  return <div className="member-report-chart" role="img" aria-label="Monthly contribution and expense movement">
    {points.map(point => {
      const contributionHeight = point.contributions ? Math.max(4, point.contributions / maximum * 132) : 0
      const expenseHeight = point.expenses ? Math.max(4, point.expenses / maximum * 132) : 0
      return <div className="member-report-chart-column" key={point.key}>
        <div className="member-report-chart-bars">
          <i className="in" style={{ height: contributionHeight }} title={`${point.label}: ${point.contributions}`} />
          <i className="out" style={{ height: expenseHeight }} title={`${point.label}: ${point.expenses}`} />
        </div>
        <span>{point.label}</span>
      </div>
    })}
  </div>
}

export function UnifiedReports({ contributionDocuments }: { contributionDocuments: ReactNode }) {
  const [period, setPeriod] = useState<Period>('6M')
  const [fundId, setFundId] = useState('all')
  const [funds, setFunds] = useState<FundOption[]>([])
  const [reportsByFund, setReportsByFund] = useState<Record<string, FundReportBundle>>({})
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [pledges, setPledges] = useState<PledgeEntry[]>([])
  const [exports, setExports] = useState<FundExport[]>([])
  const [permissions, setPermissions] = useState<FundPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [busy, setBusy] = useState<FundExportType | ''>('')
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [pdfPreview, setPdfPreview] = useState<{ title: string; html: string } | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadReports() {
      try {
        if (reloadKey > 0) invalidateHomeSummary()
        const home = await loadHomeSummary()
        const fundIds = [...new Set(home.items.map(item => item.fund_id).filter((id): id is string => Boolean(id)))]
        const bundles = await Promise.all(fundIds.map(id => runApiRead(call => createApiClient().funds.report(id, call), controller.signal)))
        if (controller.signal.aborted) return

        const next = reportStateFromBundles(bundles)
        setReportsByFund(next.reportsByFund)
        setFunds(next.funds)
        setEntries(next.entries)
        setPledges(next.pledges)
        setExports(next.exports)
      } catch (cause) {
        if (!controller.signal.aborted) setError(apiErrorMessage(cause))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadReports()
    return () => controller.abort()
  }, [reloadKey])

  useEffect(() => {
    if (fundId === 'all') return

    const controller = new AbortController()
    runApiRead(call => createApiClient().funds.permissions(fundId, call), controller.signal)
      .then(next => { if (!controller.signal.aborted) setPermissions(next) })
      .catch(() => { if (!controller.signal.aborted) setPermissions([]) })
      .finally(() => { if (!controller.signal.aborted) setPermissionsLoading(false) })
    return () => controller.abort()
  }, [fundId])

  const selectedFund = funds.find(fund => fund.id === fundId)
  const currency = selectedFund?.currency ?? funds[0]?.currency ?? 'BWP'
  const filteredEntries = useMemo(() => {
    const start = startOfPeriod(period).getTime()
    return entries.filter(entry => (fundId === 'all' || entry.fundId === fundId) && new Date(entry.date).getTime() >= start)
  }, [entries, fundId, period])
  const filteredPledges = useMemo(() => {
    const start = startOfPeriod(period).getTime()
    return pledges.filter(entry => (fundId === 'all' || entry.fundId === fundId) && new Date(entry.date).getTime() >= start)
  }, [fundId, period, pledges])
  const chartData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: PERIOD_MONTHS[period] }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - PERIOD_MONTHS[period] + 1 + index, 1)
      const key = monthKey(date)
      const monthEntries = filteredEntries.filter(entry => monthKey(new Date(entry.date)) === key)
      return {
        key,
        label: date.toLocaleDateString('en-BW', { month: 'short' }),
        contributions: monthEntries.filter(entry => entry.type === 'contribution').reduce((sum, entry) => sum + entry.amount, 0),
        expenses: monthEntries.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0),
      }
    })
  }, [filteredEntries, period])

  const totalContributed = filteredEntries.filter(entry => entry.type === 'contribution').reduce((sum, entry) => sum + entry.amount, 0)
  const totalPledged = filteredPledges.reduce((sum, entry) => sum + entry.amount, 0)
  const totalOutstanding = filteredPledges.reduce((sum, entry) => sum + Math.max(entry.amount - entry.received, 0), 0)
  const totalExpenses = filteredEntries.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0)
  const available = totalContributed - totalExpenses
  const activeFunds = fundId === 'all' ? new Set([...filteredEntries.map(entry => entry.fundId), ...filteredPledges.map(entry => entry.fundId)]).size : 1
  const canExport = fundId !== 'all' && !permissionsLoading && permissions.includes('export_reports')
  const visibleExports = exports.filter(record => fundId === 'all' || record.fund_id === fundId).slice(0, 8)

  function selectFund(nextFundId: string) {
    setFundId(nextFundId)
    setPermissions([])
    setPermissionsLoading(nextFundId !== 'all')
    setActionError('')
  }

  function retryLoad() {
    setLoading(true)
    setError('')
    setReloadKey(value => value + 1)
  }

  function requireSelectedReport() {
    if (fundId === 'all') throw new Error('Select one fund before generating a report.')
    const report = reportsByFund[fundId]
    if (!report) throw new Error('The fund report is not available. Refresh and try again.')
    return report
  }

  async function logExport(type: FundExportType) {
    if (fundId === 'all') return
    const record = await createApiClient().funds.createExport(fundId, { export_type: type })
    setExports(current => [record, ...current.filter(item => item.id !== record.id)])
    setReportsByFund(current => {
      const report = current[fundId]
      return report ? { ...current, [fundId]: { ...report, export_history: [...report.export_history, record] } } : current
    })
  }

  function beginAction(type: FundExportType) {
    if (!canExport || busy) return false
    setActionError('')
    setBusy(type)
    return true
  }

  async function exportPdf() {
    if (!beginAction('pdf')) return
    try {
      const html = buildFundReportDocumentHtml(requireSelectedReport())
      await logExport('pdf')
      setPdfPreview({ title: `${selectedFund?.title ?? 'Tshelo'} fund statement`, html })
    } catch (cause) {
      setActionError(apiErrorMessage(cause))
    } finally {
      setBusy('')
    }
  }

  async function exportCsv() {
    if (!beginAction('csv')) return
    try {
      requireSelectedReport()
      const rows = [
        ...filteredEntries,
        ...filteredPledges.map(entry => ({ ...entry, type: 'pledge' as const })),
      ].sort((a, b) => b.date.localeCompare(a.date))
      const csv = [
        'Date,Description,Type,Amount,Currency',
        ...rows.map(entry => [new Date(entry.date).toISOString(), entry.description, entry.type, entry.amount, currency].map(csvCell).join(',')),
      ].join('\n')
      download(`${selectedFund?.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'tshelo'}-${period.toLowerCase()}-report.csv`, csv)
      await logExport('csv')
    } catch (cause) {
      setActionError(apiErrorMessage(cause))
    } finally {
      setBusy('')
    }
  }

  async function shareSummary() {
    if (!beginAction('share')) return
    try {
      requireSelectedReport()
      const message = `Tshelo report - ${selectedFund?.title ?? 'Fund'} (${period})\nTotal in: ${money(totalContributed, currency)}\nTotal out: ${money(totalExpenses, currency)}\nAvailable balance: ${money(available, currency)}\nPledged: ${money(totalPledged, currency)}\nOpen pledges: ${money(totalOutstanding, currency)}`
      if (navigator.share) await navigator.share({ title: `${selectedFund?.title ?? 'Tshelo'} report`, text: message })
      else if (navigator.clipboard) { await navigator.clipboard.writeText(message); window.alert('Report summary copied.') }
      else throw new Error('Sharing is not available in this browser.')
      await logExport('share')
    } catch (cause) {
      if ((cause as DOMException)?.name !== 'AbortError') setActionError(apiErrorMessage(cause))
    } finally {
      setBusy('')
    }
  }

  if (loading && !funds.length) return <section className="member-card"><div className="member-api-state"><p>Loading your reports and documents…</p></div></section>

  if (error && !funds.length) return <section className="member-card"><div className="member-api-state error"><p>Your reports could not be loaded.</p><button type="button" onClick={retryLoad}><RefreshCw size={14} /> Try again</button></div></section>

  return <>
    <section className="member-pagehead">
      <div>
        <h1>Reports &amp; <em>documents</em></h1>
      </div>
    </section>

    {!funds.length ? <section className="member-card"><div className="member-api-state"><p>Join or create a fund before there is a report to review.</p><Link href="/account/funds">View my funds</Link></div></section> : <>
      <section className="member-card member-reports-overview">
        <div className="member-card-body">
          <div className="member-reports-controls">
            <label className="member-reports-selector"><span>Reporting on</span><select value={fundId} onChange={event => selectFund(event.target.value)}><option value="all">All funds</option>{funds.map(fund => <option key={fund.id} value={fund.id}>{fund.title}</option>)}</select></label>
            <div className="member-report-periods" role="group" aria-label="Reporting period">{(Object.keys(PERIOD_MONTHS) as Period[]).map(value => <button key={value} type="button" className={period === value ? 'active' : undefined} onClick={() => setPeriod(value)}>{value}</button>)}</div>
          </div>
          <div className="member-report-chart-card">
            <div className="member-report-chart-header"><div><h2>Money movement</h2><p>Confirmed contributions and fund-paid expenses.</p></div><div className="member-report-legend"><span><i className="in" /> In</span><span><i className="out" /> Out</span></div></div>
            <MovementChart points={chartData} />
          </div>
          <div className="member-report-stats" aria-label="Report totals">
            <article><span>Pledged</span><strong>{money(totalPledged, currency)}</strong></article>
            <article><span>Total in</span><strong className="positive">{money(totalContributed, currency)}</strong></article>
            <article><span>Open pledges</span><strong className={totalOutstanding > 0 ? 'attention' : undefined}>{money(totalOutstanding, currency)}</strong></article>
            <article><span>Total out</span><strong>{money(totalExpenses, currency)}</strong></article>
            <article><span>Available</span><strong className={available < 0 ? 'attention' : 'positive'}>{money(available, currency)}</strong></article>
            <article><span>Active funds</span><strong>{activeFunds}</strong></article>
          </div>
        </div>
      </section>

      <section className="member-card member-report-documents">
        <header><div className="member-section-title"><span><FileText size={18} /></span><h2>Fund statement</h2></div>{selectedFund && <small>{selectedFund.title}</small>}</header>
        <div className="member-card-body">
          <p className="member-report-document-copy">PDF statements include the full accounting ledger, contributor and pledge detail, spending evidence, governance, audit trail, and record references. They use the exact mobile statement layout and a single report snapshot.</p>
          <div className="member-report-export-actions">
            <button type="button" className="primary" disabled={!canExport || Boolean(busy)} onClick={() => void exportPdf()}><FileText size={15} /> {busy === 'pdf' ? 'Generating…' : 'Generate PDF'}</button>
            <button type="button" disabled={!canExport || Boolean(busy)} onClick={() => void exportCsv()}><Download size={15} /> {busy === 'csv' ? 'Preparing…' : 'CSV'}</button>
            <button type="button" disabled={!canExport || Boolean(busy)} onClick={() => void shareSummary()}><Share2 size={15} /> {busy === 'share' ? 'Sharing…' : 'Share'}</button>
          </div>
          {!canExport && <p className="member-report-access-note">{fundId === 'all' ? 'Select a specific fund to generate its documents.' : permissionsLoading ? 'Checking your export permission…' : 'Ask the fund owner for report export permission.'}</p>}
          {actionError && <p className="member-form-error" role="alert">{actionError}</p>}
        </div>
      </section>

      <section className="member-card member-report-history">
        <header><div className="member-section-title"><span><BarChart3 size={18} /></span><h2>Export history</h2></div><small>{visibleExports.length}</small></header>
        <div className="member-card-body"><div className="member-report-history-list">
          {visibleExports.map(record => <article key={record.id}><span><FileText size={16} /></span><div><strong>{record.export_type.toUpperCase()} report</strong><p>{funds.find(fund => fund.id === record.fund_id)?.title ?? 'Fund'} · {formatDate(record.created_at)}</p></div></article>)}
          {!visibleExports.length && <div className="member-empty">Generated reports will appear here.</div>}
        </div></div>
      </section>
    </>}
    <section className="member-card member-report-documents">
      <header><div className="member-section-title"><span><FileText size={18} /></span><h2>Personal contribution documents</h2></div></header>
      <div className="member-card-body">
        <p className="member-report-document-copy">Generate a private statement of contributions linked to your account for the current year, or a complete summary for the previous year.</p>
        {contributionDocuments}
      </div>
    </section>
    <DocumentPreviewDialog title={pdfPreview?.title ?? `${selectedFund?.title ?? 'Fund'} statement`} html={pdfPreview?.html ?? null} isGenerating={busy === 'pdf'} onClose={() => setPdfPreview(null)} />
  </>
}
