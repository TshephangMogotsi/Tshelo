'use client'

import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { DocumentPreviewDialog } from '@/components/documents/document-preview-dialog'
import type { ContributionHistoryItem } from '@/lib/data/account'
import { formatDate, formatMoney, titleCase } from '@/lib/format'

type Props = {
  userName: string
  from: string
  to: string
  contributions: ContributionHistoryItem[]
  previousYear: number
  previousYearContributions: ContributionHistoryItem[]
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] ?? character))
}

function totalsByCurrency(contributions: ContributionHistoryItem[]) {
  return contributions
    .filter(item => item.status === 'confirmed')
    .reduce<Record<string, number>>((totals, item) => {
      totals[item.currency_code] = (totals[item.currency_code] ?? 0) + Number(item.amount)
      return totals
    }, {})
}

function documentHtml({
  title,
  subtitle,
  userName,
  contributions,
}: {
  title: string
  subtitle: string
  userName: string
  contributions: ContributionHistoryItem[]
}) {
  const totals = totalsByCurrency(contributions)
  const totalMarkup = Object.entries(totals).map(([currency, total]) => `<div><span>CONFIRMED TOTAL</span><strong>${escapeHtml(formatMoney(String(total), currency))}</strong><small>${escapeHtml(currency)}</small></div>`).join('') || '<div><span>CONFIRMED TOTAL</span><strong>—</strong><small>No confirmed contributions</small></div>'
  const rows = contributions.map(item => `<tr><td>${escapeHtml(formatDate(item.created_at))}</td><td><strong>${escapeHtml(item.fund?.title ?? 'Tshelo fund')}</strong></td><td>${escapeHtml(item.payment_method ? titleCase(item.payment_method) : 'Not recorded')}</td><td><span class="status ${escapeHtml(item.status)}">${escapeHtml(titleCase(item.status))}</span></td><td class="amount">${escapeHtml(formatMoney(item.amount, item.currency_code))}</td></tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4;margin:16mm 15mm 18mm}*{box-sizing:border-box}body{margin:0;color:#182138;font-family:Arial,'Helvetica Neue',sans-serif;font-size:10px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}h1,h2{font-family:Georgia,'Times New Roman',serif;color:#151d33}h1{margin:6px 0;font-size:28px;line-height:1.1}h2{margin:26px 0 9px;font-size:17px}.brand{display:flex;justify-content:space-between;gap:20px;padding-bottom:12px;border-bottom:3px solid #6840f2}.brand-identity{display:flex;align-items:center;gap:10px}.brand img{width:30px;height:30px;border-radius:7px}.eyebrow,th,.summary span{font-size:7.5px;font-weight:800;letter-spacing:1.45px;color:#6840f2;text-transform:uppercase}.meta{color:#637087}.summary{display:grid;grid-template-columns:repeat(3,1fr);margin-top:16px;border:1px solid #d9d5cc}.summary>div{min-height:72px;padding:12px;border-right:1px solid #d9d5cc}.summary>div:last-child{border:0}.summary span,.summary strong,.summary small{display:block}.summary strong{margin:9px 0 4px;font:700 16px Georgia,'Times New Roman',serif}.summary small{color:#8994a8;font-size:8px}table{width:100%;border-collapse:collapse}thead{display:table-header-group}tr{page-break-inside:avoid}th,td{padding:8px 6px;border-bottom:1px solid #ddd9d0;text-align:left;vertical-align:top}th{background:#f6f4ef;border-bottom-color:#182138}td{font-size:9px}.amount{text-align:right;white-space:nowrap}.status{display:inline-block;padding:2px 7px;border-radius:999px;background:#efede8;color:#5f697b;font-size:7px;font-weight:800;letter-spacing:.55px;text-transform:uppercase}.status.confirmed{background:#e8f3ed;color:#2d6d59}.status.refunded{background:#fff0df;color:#9f5e0b}.note{margin-top:16px;padding:11px 13px;border:1px solid #ddd9d0;border-left:4px solid #6840f2;background:#f7f5f0}.footer{position:fixed;left:0;right:0;bottom:-12mm;padding-top:5px;border-top:1px solid #d9d5cc;display:flex;justify-content:space-between;color:#606a79;font-size:7px}
  </style></head><body><div class="footer"><span>Tshelo personal contribution statement</span><span>Issued ${escapeHtml(formatDate(new Date().toISOString()))}</span></div><main><div class="brand"><div><div class="brand-identity"><img src="${escapeHtml(`${window.location.origin}/tshelo-icon.png`)}" alt=""><span class="eyebrow">Tshelo contribution statement</span></div><h1>${escapeHtml(title)}</h1><p class="meta">${escapeHtml(subtitle)}</p></div><div class="meta">Prepared for<br><strong>${escapeHtml(userName)}</strong></div></div><div class="summary"><div><span>Contribution records</span><strong>${contributions.length}</strong><small>All statuses included</small></div>${totalMarkup}</div><h2>Contribution record</h2><table><thead><tr><th>Date</th><th>Fund</th><th>Method</th><th>Status</th><th class="amount">Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No contributions are recorded for this period.</td></tr>'}</tbody></table><div class="note"><strong>About this document.</strong> It records contributions linked to this Tshelo account at the time it was issued. Only confirmed contributions are included in the totals; pending and refunded records remain visible for completeness.</div></main></body></html>`
}

export function ContributionDocuments({ userName, from, to, contributions, previousYear, previousYearContributions }: Props) {
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  function showPreview(next: { title: string; html: string }) {
    setPreview(null)
    setIsGenerating(true)
    window.requestAnimationFrame(() => {
      setPreview(next)
      setIsGenerating(false)
    })
  }

  function exportSelected() {
    const title = 'My contribution statement'
    showPreview({
      title,
      html: documentHtml({
        title,
        subtitle: `Contribution records from ${formatDate(`${from}T00:00:00.000Z`)} to ${formatDate(`${to}T00:00:00.000Z`)}`,
        userName,
        contributions,
      }),
    })
  }

  function exportYearEnd() {
    const title = `${previousYear} year-end contribution summary`
    showPreview({
      title,
      html: documentHtml({
        title,
        subtitle: `All contribution records from 1 January to 31 December ${previousYear}`,
        userName,
        contributions: previousYearContributions,
      }),
    })
  }

  return <>
    <div className="member-page-actions" aria-label="Contribution document actions">
      <button type="button" className="primary" onClick={exportSelected}><FileText size={14} /> Generate PDF</button>
      <button type="button" onClick={exportYearEnd}><Download size={14} /> {previousYear} year-end summary</button>
    </div>
    <DocumentPreviewDialog title={preview?.title ?? 'Contribution statement'} html={preview?.html ?? null} isGenerating={isGenerating} onClose={() => setPreview(null)} />
  </>
}
