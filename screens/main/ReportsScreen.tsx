import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'
import { supabase } from '../../lib/supabase'
import LoadingOverlay from '../../components/LoadingOverlay'
import { loadHomeItems } from './home/loadHomeItems'

const CHART_H = 126
const BAR_W = 11

type Period = '1M' | '3M' | '6M' | '1Y'
type EntryType = 'contribution' | 'expense'

type FundOption = { id: string; title: string; currency: string }
type LedgerEntry = {
  id: string
  fundId: string
  type: EntryType
  amount: number
  date: string
  description: string
}
type ChartPoint = { key: string; label: string; contributions: number; expenses: number }
type ExportRecord = { id: string; fund_id: string; export_type: string; created_at: string }

const PERIOD_MONTHS: Record<Period, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }

function monthKey(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
}

function startOfPeriod(period: Period) {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - PERIOD_MONTHS[period] + 1, 1)
}

function money(amount: number, currency: string) {
  const symbol = currency === 'BWP' ? 'P' : currency
  return `${symbol} ${amount.toLocaleString('en-BW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character))
}

function BarChart({ data, colors }: { data: ChartPoint[]; colors: AppColors }) {
  const maxVal = Math.max(1, ...data.flatMap(point => [point.contributions, point.expenses]))
  return (
    <View style={stylesForChart.chart}>
      {data.map(point => {
        const contributedHeight = point.contributions > 0 ? Math.max(4, point.contributions / maxVal * CHART_H) : 0
        const expenseHeight = point.expenses > 0 ? Math.max(4, point.expenses / maxVal * CHART_H) : 0
        return (
          <View key={point.key} style={stylesForChart.column}>
            <View style={stylesForChart.bars}>
              <View style={[stylesForChart.bar, { height: contributedHeight, backgroundColor: colors.primary }]} />
              <View style={[stylesForChart.bar, { height: expenseHeight, backgroundColor: colors.error }]} />
            </View>
            <Text style={[stylesForChart.label, { color: colors.textMuted }]}>{point.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

const stylesForChart = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_H + 22 },
  column: { flex: 1, alignItems: 'center' },
  bars: { height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: BAR_W, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  label: { fontSize: 9, marginTop: 5 },
})

export default function ReportsScreen() {
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const styles = makeStyles(colors)
  const [period, setPeriod] = useState<Period>('6M')
  const [fundId, setFundId] = useState('all')
  const [fundOpen, setFundOpen] = useState(false)
  const [funds, setFunds] = useState<FundOption[]>([])
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const hasLoadedRef = useRef(false)
  const lastLoadedAtRef = useRef(0)
  const pdfHtmlCacheRef = useRef(new Map<string, { html: string; createdAt: number }>())
  const pdfHtmlInFlightRef = useRef(new Map<string, Promise<string>>())

  useFocusEffect(useCallback(() => {
    let active = true
    async function loadReports() {
      if (!userId) {
        setIsLoading(false)
        return
      }
      if (hasLoadedRef.current && Date.now() - lastLoadedAtRef.current < 30_000) return
      if (!hasLoadedRef.current) setIsLoading(true)
      setLoadError(false)
      try {
        const items = await loadHomeItems(userId)
        const optionById = new Map<string, FundOption>()
        items.forEach(item => {
          if (item.fundId && !optionById.has(item.fundId)) {
            optionById.set(item.fundId, { id: item.fundId, title: item.kind === 'eventFund' ? `${item.title} Fund` : item.title, currency: item.currency_code })
          }
        })
        const fundOptions = [...optionById.values()]
        const ids = fundOptions.map(option => option.id)
        if (!active) return
        setFunds(fundOptions)

        if (!ids.length) {
          setEntries([])
          setExports([])
          hasLoadedRef.current = true
          lastLoadedAtRef.current = Date.now()
          return
        }

        const [contributionResult, expenseResult, exportResult] = await Promise.all([
          supabase.from('contributions').select('id, fund_id, amount, contributor_name, confirmed_at').in('fund_id', ids).eq('status', 'confirmed').eq('is_refunded', false).order('confirmed_at', { ascending: false }),
          supabase.from('expenses').select('id, fund_id, amount, description, vendor_name, created_at').in('fund_id', ids).is('deleted_at', null).order('created_at', { ascending: false }),
          supabase.from('fund_exports').select('id, fund_id, export_type, created_at').in('fund_id', ids).order('created_at', { ascending: false }).limit(20),
        ])
        if (contributionResult.error) throw contributionResult.error
        if (expenseResult.error) throw expenseResult.error
        if (exportResult.error) throw exportResult.error
        if (!active) return

        const contributionEntries: LedgerEntry[] = (contributionResult.data ?? []).filter(row => row.confirmed_at).map(row => ({
          id: row.id, fundId: row.fund_id, type: 'contribution', amount: Number(row.amount ?? 0), date: row.confirmed_at!, description: row.contributor_name || 'Contribution',
        }))
        const expenseEntries: LedgerEntry[] = (expenseResult.data ?? []).map(row => ({
          id: row.id, fundId: row.fund_id, type: 'expense', amount: Number(row.amount ?? 0), date: row.created_at, description: row.description || row.vendor_name || 'Expense',
        }))
        setEntries([...contributionEntries, ...expenseEntries].sort((a, b) => b.date.localeCompare(a.date)))
        setExports((exportResult.data ?? []) as ExportRecord[])
        hasLoadedRef.current = true
        lastLoadedAtRef.current = Date.now()
      } catch {
        if (active && !hasLoadedRef.current) setLoadError(true)
      } finally {
        if (active) setIsLoading(false)
      }
    }
    loadReports()
    return () => { active = false }
  }, [userId]))

  const selectedFund = funds.find(fund => fund.id === fundId)
  const currency = selectedFund?.currency ?? funds[0]?.currency ?? 'BWP'
  const fundOptions = useMemo(() => [{ id: 'all', title: 'All funds', currency }, ...funds], [currency, funds])
  const filteredEntries = useMemo(() => {
    const start = startOfPeriod(period).getTime()
    return entries.filter(entry => (fundId === 'all' || entry.fundId === fundId) && new Date(entry.date).getTime() >= start)
  }, [entries, fundId, period])

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
  const totalExpenses = filteredEntries.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0)
  const netBalance = totalContributed - totalExpenses
  const activeFunds = fundId === 'all' ? new Set(filteredEntries.map(entry => entry.fundId)).size : 1
  const visibleExports = exports.filter(record => fundId === 'all' || record.fund_id === fundId).slice(0, 8)

  useEffect(() => {
    if (fundId === 'all') return
    const timeout = setTimeout(() => { void detailedReportHtml().catch(() => {}) }, 120)
    return () => clearTimeout(timeout)
  }, [fundId])

  async function detailedReportHtml() {
    if (fundId === 'all') throw new Error('Select one fund before generating a PDF report.')
    const reportFundId = fundId
    const cached = pdfHtmlCacheRef.current.get(reportFundId)
    if (cached && Date.now() - cached.createdAt < 30_000) return cached.html
    const existingRequest = pdfHtmlInFlightRef.current.get(reportFundId)
    if (existingRequest) return existingRequest

    const buildRequest = (async () => {

    const [fundResult, contributionResult, expenseResult, memberResult, profileResult, linkedEventResult] = await Promise.all([
      supabase.from('funds').select('id, title, description, fund_type, fund_code, currency_code, goal_amount, status, created_at, contribution_deadline, closed_at, linked_event_id, is_private').eq('id', reportFundId).single(),
      supabase.from('contributions').select('id, contributor_name, amount, payment_method, reference_number, status, is_refunded, confirmed_at, created_at, notes').eq('fund_id', reportFundId).order('created_at', { ascending: true }),
      supabase.from('expenses').select('id, description, category, amount, vendor_name, is_sponsored, sponsored_by_name, has_open_query, created_at').eq('fund_id', reportFundId).is('deleted_at', null).order('created_at', { ascending: true }),
      supabase.from('fund_members').select('id, role, status, joined_at').eq('fund_id', reportFundId).eq('status', 'joined').order('joined_at', { ascending: true }),
      supabase.rpc('get_fund_member_profiles', { p_fund_id: reportFundId }),
      supabase.from('events').select('name, event_date, event_time, venue_name').eq('linked_fund_id', reportFundId).maybeSingle(),
    ])
    if (fundResult.error || !fundResult.data) throw fundResult.error ?? new Error('Fund details are unavailable.')
    if (contributionResult.error) throw contributionResult.error
    if (expenseResult.error) throw expenseResult.error
    if (memberResult.error) throw memberResult.error

    const fund = fundResult.data
    const contributions = contributionResult.data ?? []
    const expenses = expenseResult.data ?? []
    const members = memberResult.data ?? []
    const profileByRow = new Map<string, { name: string; phone: string }>((profileResult.data ?? []).map((profile: any) => [profile.member_row_id, { name: profile.name, phone: profile.phone }]))
    const linkedEvent = linkedEventResult.data
    const reportCurrency = fund.currency_code
    const confirmed = contributions.filter(item => item.status === 'confirmed' && !item.is_refunded)
    const contributed = confirmed.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
    const spent = expenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
    const balance = contributed - spent
    const goal = Number(fund.goal_amount ?? 0)
    const progress = goal > 0 ? Math.min(Math.round(contributed / goal * 100), 999) : 0
    const categoryTotals = new Map<string, number>()
    expenses.forEach(item => {
      const category = item.category ? String(item.category).replace(/_/g, ' ') : 'Uncategorised'
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + Number(item.amount ?? 0))
    })
    const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('en-BW', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set'
    const contributionRows = contributions.map(item => `<tr><td>${formatDate(item.confirmed_at ?? item.created_at)}</td><td>${escapeHtml(item.contributor_name)}</td><td>${escapeHtml(String(item.payment_method ?? 'Not specified').replace(/_/g, ' '))}</td><td>${escapeHtml(item.reference_number ?? '—')}</td><td><span class="status">${item.is_refunded ? 'Refunded' : escapeHtml(item.status)}</span></td><td class="amount">${money(Number(item.amount ?? 0), reportCurrency)}</td></tr>`).join('')
    const expenseRows = expenses.map(item => `<tr><td>${formatDate(item.created_at)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.vendor_name ?? '—')}</td><td>${escapeHtml(item.category ? String(item.category).replace(/_/g, ' ') : 'Uncategorised')}</td><td>${item.has_open_query ? 'Queried' : item.is_sponsored ? `Sponsored${item.sponsored_by_name ? ` by ${escapeHtml(item.sponsored_by_name)}` : ''}` : 'Recorded'}</td><td class="amount expense">${money(Number(item.amount ?? 0), reportCurrency)}</td></tr>`).join('')
    const memberRows = members.map(member => { const profile = profileByRow.get(member.id); return `<tr><td>${escapeHtml(profile?.name ?? 'Member')}</td><td>${escapeHtml(profile?.phone ?? '—')}</td><td>${escapeHtml(String(member.role))}</td><td>${formatDate(member.joined_at)}</td></tr>` }).join('')
    const categoryRows = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([category, amount]) => `<tr><td>${escapeHtml(category)}</td><td class="amount expense">${money(amount, reportCurrency)}</td><td>${spent > 0 ? Math.round(amount / spent * 100) : 0}%</td></tr>`).join('')
    const eventSection = linkedEvent ? `<section><h2>Linked event</h2><div class="details"><div><span>Event</span><strong>${escapeHtml(linkedEvent.name)}</strong></div><div><span>Date</span><strong>${formatDate(linkedEvent.event_date)}</strong></div><div><span>Venue</span><strong>${escapeHtml(linkedEvent.venue_name ?? 'Not set')}</strong></div></div></section>` : ''

    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{margin:46px 42px}*{box-sizing:border-box}html{background:#fff}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#17151d;font-size:11px;margin:0;padding:0 18px}h1{font-size:26px;margin:0 0 4px}h2{font-size:15px;margin:0 0 12px;border-bottom:1px solid #ddd;padding-bottom:7px}.muted{color:#777}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}.brand{color:#7657f0;font-weight:800;letter-spacing:1px}.code{font-size:12px;font-weight:700;background:#f2ecff;padding:7px 10px;border-radius:7px}.summary{display:flex;gap:8px;margin:18px 0}.metric{flex:1;padding:12px;background:#f5f2fa;border-radius:9px}.metric span,.details span{display:block;font-size:8px;color:#777;font-weight:700;letter-spacing:.6px;margin-bottom:4px}.metric strong{font-size:16px}.metric .positive{color:#7657f0}.metric .negative{color:#c63e49}.progress{height:7px;background:#ece8f1;border-radius:4px;overflow:hidden;margin-top:7px}.progress div{height:100%;background:#7657f0}section{margin:22px 0;page-break-inside:avoid}.details{display:flex;gap:10px;flex-wrap:wrap}.details>div{min-width:145px;padding:9px 11px;background:#faf9fb;border:1px solid #e4e0e8;border-radius:8px}.details strong{font-size:11px}table{width:100%;border-collapse:collapse;page-break-inside:auto}tr{page-break-inside:avoid}th,td{text-align:left;padding:7px 6px;border-bottom:1px solid #e6e3e8;font-size:9px}th{font-size:8px;color:#666;text-transform:uppercase;letter-spacing:.4px;background:#f7f5f9}.amount{text-align:right;font-weight:700}.expense{color:#c63e49}.status{text-transform:capitalize}.footer{margin-top:28px;padding-top:10px;border-top:1px solid #ddd;color:#888;font-size:8px}
    </style></head><body>
      <div class="header"><div><div class="brand">TSHELO FUND REPORT</div><h1>${escapeHtml(fund.title)}</h1><div class="muted">Generated ${formatDate(new Date().toISOString())}</div></div><div class="code">${escapeHtml(fund.fund_code)}</div></div>
      <div class="details"><div><span>CREATED</span><strong>${formatDate(fund.created_at)}</strong></div><div><span>STATUS</span><strong>${escapeHtml(fund.status)}</strong></div><div><span>TYPE</span><strong>${escapeHtml(String(fund.fund_type).replace(/_/g, ' '))}</strong></div><div><span>DEADLINE</span><strong>${formatDate(fund.contribution_deadline)}</strong></div><div><span>VISIBILITY</span><strong>${fund.is_private ? 'Private' : 'Public'}</strong></div><div><span>MEMBERS</span><strong>${members.length}</strong></div></div>
      ${fund.description ? `<section><h2>Purpose</h2><p>${escapeHtml(fund.description)}</p></section>` : ''}
      <div class="summary"><div class="metric"><span>CONTRIBUTIONS</span><strong>${money(contributed, reportCurrency)}</strong></div><div class="metric"><span>SPENDING</span><strong class="negative">${money(spent, reportCurrency)}</strong></div><div class="metric"><span>BALANCE</span><strong class="positive">${money(balance, reportCurrency)}</strong></div><div class="metric"><span>GOAL</span><strong>${money(goal, reportCurrency)}</strong><div class="progress"><div style="width:${Math.min(progress, 100)}%"></div></div><small>${progress}% funded</small></div></div>
      ${eventSection}
      <section><h2>Spending breakdown</h2><table><thead><tr><th>Category</th><th class="amount">Amount</th><th>Share</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="3">No expenses recorded.</td></tr>'}</tbody></table></section>
      <section><h2>Contributions (${contributions.length})</h2><table><thead><tr><th>Date</th><th>Contributor</th><th>Method</th><th>Reference</th><th>Status</th><th class="amount">Amount</th></tr></thead><tbody>${contributionRows || '<tr><td colspan="6">No contributions recorded.</td></tr>'}</tbody></table></section>
      <section><h2>Expenses (${expenses.length})</h2><table><thead><tr><th>Date</th><th>Description</th><th>Vendor</th><th>Category</th><th>Status</th><th class="amount">Amount</th></tr></thead><tbody>${expenseRows || '<tr><td colspan="6">No expenses recorded.</td></tr>'}</tbody></table></section>
      <section><h2>Members (${members.length})</h2><table><thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Joined</th></tr></thead><tbody>${memberRows || '<tr><td colspan="4">No members recorded.</td></tr>'}</tbody></table></section>
      <div class="footer">This report reflects Tshelo records at the time it was generated. Confirm supporting receipts and payment references before relying on it for formal accounting.</div>
    </body></html>`
    pdfHtmlCacheRef.current.set(reportFundId, { html, createdAt: Date.now() })
    return html
    })()
    pdfHtmlInFlightRef.current.set(reportFundId, buildRequest)
    try {
      return await buildRequest
    } finally {
      pdfHtmlInFlightRef.current.delete(reportFundId)
    }
  }

  async function logExport(type: string) {
    if (!userId || fundId === 'all') return
    const { data } = await supabase.from('fund_exports').insert({ fund_id: fundId, exported_by: userId, export_type: type, was_free: true, tokens_spent: 0 }).select('id, fund_id, export_type, created_at').single()
    if (data) setExports(previous => [data as ExportRecord, ...previous])
  }

  async function exportPdf() {
    if (isExporting) return
    if (fundId === 'all') {
      Alert.alert('Select a fund', 'PDF reports are generated for one fund at a time. Choose a fund above first.')
      return
    }
    setIsExporting(true)
    try {
      const html = await detailedReportHtml()
      const { uri } = await Print.printToFileAsync({ html })
      void logExport('pdf')
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share fund report' })
      else Alert.alert('Report created', uri)
    } catch (error) {
      Alert.alert('Could not create report', error instanceof Error ? error.message : 'Please try again.')
    } finally { setIsExporting(false) }
  }

  async function exportCsv() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const header = 'Date,Description,Type,Amount,Currency\n'
      const csvRows = filteredEntries.map(entry => [new Date(entry.date).toISOString(), `"${entry.description.replace(/"/g, '""')}"`, entry.type, entry.amount, currency].join(',')).join('\n')
      const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory
      if (!directory) throw new Error('No writable export folder is available.')
      const path = `${directory}tshelo-report-${Date.now()}.csv`
      await FileSystem.writeAsStringAsync(path, header + csvRows, { encoding: FileSystem.EncodingType.UTF8 })
      await logExport('csv')
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Share CSV report' })
      else Alert.alert('CSV created', path)
    } catch (error) {
      Alert.alert('Could not export CSV', error instanceof Error ? error.message : 'Please try again.')
    } finally { setIsExporting(false) }
  }

  async function shareSummary() {
    await Share.share({ message: `Tshelo report — ${selectedFund?.title ?? 'All funds'} (${period})\nContributions: ${money(totalContributed, currency)}\nExpenses: ${money(totalExpenses, currency)}\nNet: ${money(netBalance, currency)}` })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.header}><Text style={styles.heading}>Reports</Text><Text style={styles.headerSubtitle}>Live financial overview</Text></View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.fundSelector} onPress={() => setFundOpen(value => !value)} activeOpacity={0.8}>
          <View><Text style={styles.selectorLabel}>REPORTING ON</Text><Text style={styles.fundSelectorText}>{selectedFund?.title ?? 'All funds'}</Text></View>
          <Ionicons name={fundOpen ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textMuted} />
        </TouchableOpacity>
        {fundOpen && <View style={styles.fundDropdown}>{fundOptions.map(option => <TouchableOpacity key={option.id} style={[styles.fundOption, option.id === fundId && styles.fundOptionActive]} onPress={() => { setFundId(option.id); setFundOpen(false) }}><Text style={[styles.fundOptionText, option.id === fundId && styles.fundOptionTextActive]}>{option.title}</Text>{option.id === fundId && <Ionicons name="checkmark" size={16} color={colors.primary} />}</TouchableOpacity>)}</View>}

        <View style={styles.periodRow}>{(['1M', '3M', '6M', '1Y'] as Period[]).map(value => <TouchableOpacity key={value} style={[styles.periodBtn, period === value && styles.periodBtnActive]} onPress={() => setPeriod(value)}><Text style={[styles.periodBtnText, period === value && styles.periodBtnTextActive]}>{value}</Text></TouchableOpacity>)}</View>

        {loadError ? <View style={styles.emptyState}><Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} /><Text style={styles.emptyTitle}>Couldn’t load reports</Text><Text style={styles.emptyText}>Check your connection and try again.</Text></View> : <>
          <View style={styles.chartCard}>
            <View style={styles.chartTop}><Text style={styles.chartTitle}>Money movement</Text><View style={styles.chartLegend}><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.primary }]} /><Text style={styles.legendText}>In</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.error }]} /><Text style={styles.legendText}>Out</Text></View></View></View>
            <BarChart data={chartData} colors={colors} />
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}><Text style={styles.statCardLabel}>CONTRIBUTIONS</Text><Text style={styles.statCardValue}>{money(totalContributed, currency)}</Text></View>
            <View style={styles.statCard}><Text style={styles.statCardLabel}>EXPENSES</Text><Text style={styles.statCardValue}>{money(totalExpenses, currency)}</Text></View>
            <View style={styles.statCard}><Text style={styles.statCardLabel}>NET BALANCE</Text><Text style={[styles.statCardValue, { color: netBalance < 0 ? colors.error : colors.primary }]}>{money(netBalance, currency)}</Text></View>
            <View style={styles.statCard}><Text style={styles.statCardLabel}>ACTIVE FUNDS</Text><Text style={styles.statCardValue}>{activeFunds}</Text></View>
          </View>

          <Text style={styles.sectionTitle}>Export report</Text>
          <View style={styles.exportRow}>
            <TouchableOpacity style={[styles.exportBtn, fundId === 'all' && styles.exportBtnDisabled]} onPress={exportPdf} disabled={isExporting}><Ionicons name="document-text-outline" size={19} color={fundId === 'all' ? colors.textMuted : colors.primary} /><Text style={[styles.exportBtnText, fundId === 'all' && styles.exportBtnTextDisabled]}>PDF</Text></TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={shareSummary}><Ionicons name="share-social-outline" size={19} color={colors.primary} /><Text style={styles.exportBtnText}>Share</Text></TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={exportCsv} disabled={isExporting}><Ionicons name="grid-outline" size={19} color={colors.primary} /><Text style={styles.exportBtnText}>CSV</Text></TouchableOpacity>
          </View>
          {fundId === 'all' && <Text style={styles.exportHint}>Select a specific fund to generate its detailed PDF report.</Text>}

          <View style={styles.historyHeader}><Text style={styles.sectionTitle}>Export history</Text><Text style={styles.historyCount}>{exports.length}</Text></View>
          {visibleExports.map(record => {
            const fundName = funds.find(fund => fund.id === record.fund_id)?.title ?? 'Fund'
            return <View key={record.id} style={styles.historyRow}><View style={styles.historyIcon}><Ionicons name={record.export_type === 'csv' ? 'grid-outline' : 'document-text-outline'} size={18} color={colors.primary} /></View><View style={styles.historyBody}><Text style={styles.historyName}>{record.export_type.toUpperCase()} report</Text><Text style={styles.historyMeta}>{fundName} · {new Date(record.created_at).toLocaleDateString('en-BW', { day: 'numeric', month: 'short', year: 'numeric' })}</Text></View></View>
          })}
          {!visibleExports.length && <Text style={styles.noHistory}>Generated reports will appear here.</Text>}
        </>}
      </ScrollView>
      {((isLoading && !hasLoadedRef.current) || isExporting) && <LoadingOverlay />}
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
    heading: { fontSize: 28, fontFamily: fonts.display.bold, color: colors.heading },
    headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 72 },
    fundSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
    selectorLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: colors.textMuted, marginBottom: 3 },
    fundSelectorText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    fundDropdown: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: 'hidden' },
    fundOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
    fundOptionActive: { backgroundColor: colors.primaryLight },
    fundOptionText: { fontSize: 13, color: colors.textPrimary },
    fundOptionTextActive: { fontWeight: '700', color: colors.primary },
    periodRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.border, marginTop: 10, marginBottom: 14 },
    periodBtn: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
    periodBtnActive: { backgroundColor: colors.primary },
    periodBtnText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    periodBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
    chartCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
    chartTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    chartTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
    chartLegend: { flexDirection: 'row', gap: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 7, height: 7, borderRadius: 4 },
    legendText: { fontSize: 10, color: colors.textMuted },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
    statCard: { width: '48.8%', backgroundColor: colors.surface, borderRadius: 13, padding: 12, borderWidth: 1, borderColor: colors.border },
    statCardLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: colors.textMuted, marginBottom: 5 },
    statCardValue: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: 10 },
    exportRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
    exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: colors.border },
    exportBtnText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    exportBtnDisabled: { opacity: 0.55 },
    exportBtnTextDisabled: { color: colors.textMuted },
    exportHint: { fontSize: 10, lineHeight: 15, color: colors.textMuted, marginTop: -15, marginBottom: 20 },
    historyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
    historyCount: { minWidth: 18, textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.primary, backgroundColor: colors.primaryLight, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2 },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 12, padding: 10, marginBottom: 7, borderWidth: 1, borderColor: colors.border },
    historyIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
    historyBody: { flex: 1 },
    historyName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    historyMeta: { fontSize: 10, color: colors.textMuted },
    noHistory: { fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingVertical: 22 },
    emptyState: { alignItems: 'center', paddingVertical: 54 },
    emptyTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginTop: 10 },
    emptyText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  })
}
