import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useFocusEffect } from '@react-navigation/native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { Asset } from 'expo-asset'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'
import { api } from '../../lib/api'
import { runApiRead } from '../../lib/apiScreen'
import type { FundExport, FundExportType, FundReportBundle } from '@shared/contracts'
import LoadingOverlay from '../../components/LoadingOverlay'
import { loadHomeItems } from './home/loadHomeItems'
import { buildFundReportHtml } from './reports/buildFundReportHtml'
import { useFundPermissions } from '../../lib/useFundPermissions'

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
type PledgeEntry = {
  id: string
  fundId: string
  amount: number
  received: number
  date: string
  description: string
}
type ChartPoint = { key: string; label: string; contributions: number; expenses: number }
type ExportRecord = FundExport

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

let reportLogoPromise: Promise<string | undefined> | null = null

function loadReportLogoDataUri() {
  if (!reportLogoPromise) {
    reportLogoPromise = (async () => {
      const asset = Asset.fromModule(require('../../assets/tshelo-icon.png'))
      await asset.downloadAsync()
      const uri = asset.localUri ?? asset.uri
      if (!uri || uri.startsWith('http')) return undefined
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
      return `data:image/png;base64,${base64}`
    })().catch(() => undefined)
  }
  return reportLogoPromise
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
  const styles = makeStyles(colors)
  const [period, setPeriod] = useState<Period>('6M')
  const [fundId, setFundId] = useState('all')
  const [fundOpen, setFundOpen] = useState(false)
  const [funds, setFunds] = useState<FundOption[]>([])
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [pledges, setPledges] = useState<PledgeEntry[]>([])
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const permissionFundId = fundId === 'all' ? null : fundId
  const { can, isLoading: permissionsLoading } = useFundPermissions(permissionFundId)
  const canExportSelectedFund = fundId !== 'all' && !permissionsLoading && can('export_reports')
  const hasLoadedRef = useRef(false)
  const lastLoadedAtRef = useRef(0)
  const pdfHtmlCacheRef = useRef(new Map<string, { html: string; createdAt: number }>())
  const pdfHtmlInFlightRef = useRef(new Map<string, Promise<string>>())
  const reportByFundRef = useRef(new Map<string, FundReportBundle>())

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    let active = true
    async function loadReports() {
      if (hasLoadedRef.current && Date.now() - lastLoadedAtRef.current < 30_000) return
      if (!hasLoadedRef.current) setIsLoading(true)
      setLoadError(false)
      try {
        const items = await loadHomeItems(undefined, controller.signal)
        const ids = [...new Set(items.flatMap(item => item.fundId ? [item.fundId] : []))]
        if (!active) return

        if (!ids.length) {
          reportByFundRef.current.clear()
          setFunds([])
          setEntries([])
          setPledges([])
          setExports([])
          hasLoadedRef.current = true
          lastLoadedAtRef.current = Date.now()
          return
        }

        const reports = await Promise.all(ids.map(id => (
          runApiRead(call => api.funds.report(id, call), { signal: controller.signal })
        )))
        if (!active) return

        reportByFundRef.current = new Map(reports.map(report => [report.fund.id, report]))
        setFunds(reports.map(report => ({ id: report.fund.id, title: report.fund.title, currency: report.fund.currency_code })))
        const contributionEntries: LedgerEntry[] = reports.flatMap(report => report.contributions
          .filter(row => row.status === 'confirmed' && !row.is_refunded && row.confirmed_at)
          .map(row => ({
            id: row.id, fundId: report.fund.id, type: 'contribution' as const,
            amount: Number(row.amount), date: row.confirmed_at!, description: row.contributor_name || 'Contribution',
          })))
        const pledgeEntries: PledgeEntry[] = reports.flatMap(report => report.pledge_balances.map(row => ({
          id: row.pledge_id, fundId: report.fund.id, amount: Number(row.pledged_amount),
          received: Number(row.allocated_amount), date: row.created_at, description: row.contributor_name || 'Pledge',
        })))
        const expenseEntries: LedgerEntry[] = reports.flatMap(report => report.expenses
          .filter(row => !row.deleted_at && !row.is_sponsored)
          .map(row => ({
            id: row.id, fundId: report.fund.id, type: 'expense' as const,
            amount: Number(row.amount), date: row.created_at, description: row.description || row.vendor_name || 'Expense',
          })))
        setEntries([...contributionEntries, ...expenseEntries].sort((a, b) => b.date.localeCompare(a.date)))
        setPledges(pledgeEntries)
        setExports(reports.flatMap(report => report.export_history).sort((a, b) => b.created_at.localeCompare(a.created_at)))
        hasLoadedRef.current = true
        lastLoadedAtRef.current = Date.now()
      } catch {
        if (active && !hasLoadedRef.current) setLoadError(true)
      } finally {
        if (active) setIsLoading(false)
      }
    }
    loadReports()
    return () => { active = false; controller.abort() }
  }, []))

  const selectedFund = funds.find(fund => fund.id === fundId)
  const currency = selectedFund?.currency ?? funds[0]?.currency ?? 'BWP'
  const fundOptions = useMemo(() => [{ id: 'all', title: 'All funds', currency }, ...funds], [currency, funds])
  const filteredEntries = useMemo(() => {
    const start = startOfPeriod(period).getTime()
    return entries.filter(entry => (fundId === 'all' || entry.fundId === fundId) && new Date(entry.date).getTime() >= start)
  }, [entries, fundId, period])
  const filteredPledges = useMemo(() => {
    const start = startOfPeriod(period).getTime()
    return pledges.filter(entry => (fundId === 'all' || entry.fundId === fundId) && new Date(entry.date).getTime() >= start)
  }, [pledges, fundId, period])

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
  const netBalance = totalContributed - totalExpenses
  const activeFunds = fundId === 'all' ? new Set([...filteredEntries.map(entry => entry.fundId), ...filteredPledges.map(entry => entry.fundId)]).size : 1
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
      const [report, logoDataUri] = await Promise.all([
        reportByFundRef.current.get(reportFundId)
          ? Promise.resolve(reportByFundRef.current.get(reportFundId)!)
          : runApiRead(call => api.funds.report(reportFundId, call)),
        loadReportLogoDataUri(),
      ])
      reportByFundRef.current.set(reportFundId, report)

      const html = buildFundReportHtml({
        fund: report.fund,
        contributions: report.contributions,
        expenses: report.expenses,
        members: report.members,
        contributors: report.contributors,
        pledgeBalances: report.pledge_balances,
        linkedEvent: report.linked_event,
        sponsorshipItems: report.sponsorship_items,
        richAuntieAwards: report.rich_auntie_awards,
        memberProfiles: report.member_profiles,
        auditHistory: report.audit_history,
        contributionEdits: report.contribution_edits,
        expenseEdits: report.expense_edits,
        exportHistory: report.export_history,
        logoDataUri,
        generatedAt: report.history_snapshot_at,
      })
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

  async function logExport(type: FundExportType) {
    if (fundId === 'all') return
    const data = await api.funds.createExport(fundId, { export_type: type })
    setExports(previous => [data, ...previous.filter(record => record.id !== data.id)])
    const report = reportByFundRef.current.get(fundId)
    if (report) reportByFundRef.current.set(fundId, {
      ...report,
      export_history: [...report.export_history, data],
    })
    pdfHtmlCacheRef.current.delete(fundId)
  }

  async function exportPdf() {
    if (isExporting) return
    if (fundId === 'all') {
      Alert.alert('Select a fund', 'PDF reports are generated for one fund at a time. Choose a fund above first.')
      return
    }
    if (!canExportSelectedFund) {
      Alert.alert('Export access required', 'You do not have permission to export reports for this fund.')
      return
    }
    setIsExporting(true)
    try {
      const html = await detailedReportHtml()
      const { uri } = await Print.printToFileAsync({ html })
      await logExport('pdf')
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share fund report' })
      else Alert.alert('Report created', uri)
    } catch (error) {
      Alert.alert('Could not create report', error instanceof Error ? error.message : 'Please try again.')
    } finally { setIsExporting(false) }
  }

  async function exportCsv() {
    if (isExporting) return
    if (fundId === 'all') {
      Alert.alert('Select a fund', 'CSV reports are generated for one fund at a time. Choose a fund above first.')
      return
    }
    if (!canExportSelectedFund) {
      Alert.alert('Export access required', 'You do not have permission to export reports for this fund.')
      return
    }
    setIsExporting(true)
    try {
      const header = 'Date,Description,Type,Amount,Currency\n'
      const csvEntries = [
        ...filteredEntries,
        ...filteredPledges.map(entry => ({ ...entry, type: 'pledge' as const })),
      ].sort((a, b) => b.date.localeCompare(a.date))
      const csvRows = csvEntries.map(entry => [new Date(entry.date).toISOString(), `"${entry.description.replace(/"/g, '""')}"`, entry.type, entry.amount, currency].join(',')).join('\n')
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
    if (fundId === 'all') {
      Alert.alert('Select a fund', 'Choose one fund before sharing its financial summary.')
      return
    }
    if (!canExportSelectedFund) {
      Alert.alert('Export access required', 'You do not have permission to share reports for this fund.')
      return
    }
    if (isExporting) return
    setIsExporting(true)
    try {
      await Share.share({ message: `Tshelo report - ${selectedFund?.title ?? 'All funds'} (${period})\nTotal in: ${money(totalContributed, currency)}\nTotal out: ${money(totalExpenses, currency)}\nAvailable balance: ${money(netBalance, currency)}\nPledged: ${money(totalPledged, currency)}\nOpen pledges: ${money(totalOutstanding, currency)}` })
      await logExport('share')
    } catch (error) {
      Alert.alert('Could not share report', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setIsExporting(false)
    }
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
            <View style={styles.statCard}><Text style={styles.statCardLabel}>PLEDGED</Text><Text style={styles.statCardValue}>{money(totalPledged, currency)}</Text></View>
            <View style={styles.statCard}><Text style={styles.statCardLabel}>TOTAL IN</Text><Text style={[styles.statCardValue, { color: colors.primary }]}>{money(totalContributed, currency)}</Text></View>
            <View style={styles.statCard}><Text style={styles.statCardLabel}>OPEN PLEDGES</Text><Text style={[styles.statCardValue, { color: totalOutstanding > 0 ? colors.error : colors.textPrimary }]}>{money(totalOutstanding, currency)}</Text></View>
            <View style={styles.statCard}><Text style={styles.statCardLabel}>TOTAL OUT</Text><Text style={styles.statCardValue}>{money(totalExpenses, currency)}</Text></View>
            <View style={styles.statCard}><Text style={styles.statCardLabel}>AVAILABLE</Text><Text style={[styles.statCardValue, { color: netBalance < 0 ? colors.error : colors.primary }]}>{money(netBalance, currency)}</Text></View>
            <View style={styles.statCard}><Text style={styles.statCardLabel}>ACTIVE FUNDS</Text><Text style={styles.statCardValue}>{activeFunds}</Text></View>
          </View>

          <Text style={styles.sectionTitle}>Export report</Text>
          <View style={styles.exportRow}>
            <TouchableOpacity style={[styles.exportBtn, !canExportSelectedFund && styles.exportBtnDisabled]} onPress={exportPdf} disabled={isExporting || !canExportSelectedFund}><Ionicons name="document-text-outline" size={19} color={canExportSelectedFund ? colors.primary : colors.textMuted} /><Text style={[styles.exportBtnText, !canExportSelectedFund && styles.exportBtnTextDisabled]}>PDF</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.exportBtn, !canExportSelectedFund && styles.exportBtnDisabled]} onPress={shareSummary} disabled={isExporting || !canExportSelectedFund}><Ionicons name="share-social-outline" size={19} color={canExportSelectedFund ? colors.primary : colors.textMuted} /><Text style={[styles.exportBtnText, !canExportSelectedFund && styles.exportBtnTextDisabled]}>Share</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.exportBtn, !canExportSelectedFund && styles.exportBtnDisabled]} onPress={exportCsv} disabled={isExporting || !canExportSelectedFund}><Ionicons name="grid-outline" size={19} color={canExportSelectedFund ? colors.primary : colors.textMuted} /><Text style={[styles.exportBtnText, !canExportSelectedFund && styles.exportBtnTextDisabled]}>CSV</Text></TouchableOpacity>
          </View>
          {!canExportSelectedFund && <Text style={styles.exportHint}>{fundId === 'all' ? 'Select a specific fund to export its report.' : permissionsLoading ? 'Checking your export permission…' : 'Ask the fund owner for report export permission.'}</Text>}

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
