import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

const { width: W } = Dimensions.get('window')
const CHART_H = 140
const BAR_W   = 12

type Period = '1M' | '3M' | '6M' | '1Y'

type ChartPoint = { month: string; contributions: number; expenses: number }

const ALL_DATA: ChartPoint[] = [
  { month: 'Jun', contributions: 900,  expenses: 180 },
  { month: 'Jul', contributions: 1200, expenses: 350 },
  { month: 'Aug', contributions: 800,  expenses: 200 },
  { month: 'Sep', contributions: 1400, expenses: 420 },
  { month: 'Oct', contributions: 2000, expenses: 580 },
  { month: 'Nov', contributions: 1600, expenses: 390 },
  { month: 'Dec', contributions: 1800, expenses: 450 },
  { month: 'Jan', contributions: 900,  expenses: 200 },
  { month: 'Feb', contributions: 1100, expenses: 280 },
  { month: 'Mar', contributions: 1500, expenses: 380 },
  { month: 'Apr', contributions: 800,  expenses: 220 },
  { month: 'May', contributions: 2100, expenses: 540 },
]

const PERIOD_SLICE: Record<Period, number> = { '1M': 4, '3M': 3, '6M': 6, '1Y': 12 }

const FUNDS = [
  { id: 'all', title: 'All Funds'            },
  { id: '1',   title: "Kgosi's Funeral Fund" },
  { id: '2',   title: 'Mpho & Tebogo Wedding'},
]

type PrevReport = { id: string; name: string; fund: string; date: string; size: string }
const PREV_REPORTS: PrevReport[] = [
  { id: '1', name: 'April 2025 Report', fund: "Kgosi's Funeral Fund",  date: '1 May 2025', size: '245 KB' },
  { id: '2', name: 'Q1 2025 Summary',   fund: 'All Funds',             date: '2 Apr 2025', size: '892 KB' },
  { id: '3', name: 'March 2025 Report', fund: 'Mpho & Tebogo Wedding', date: '1 Apr 2025', size: '189 KB' },
]

function BarChart({ data, colors }: { data: ChartPoint[]; colors: AppColors }) {
  const maxVal = Math.max(...data.flatMap(d => [d.contributions, d.expenses]))
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H + 20, paddingHorizontal: 4 }}>
      {data.map((d, i) => {
        const cH = Math.max(4, (d.contributions / maxVal) * CHART_H)
        const eH = Math.max(4, (d.expenses / maxVal) * CHART_H)
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: CHART_H }}>
              <View style={{ width: BAR_W, height: cH, backgroundColor: '#7657F0', borderRadius: 3 }} />
              <View style={{ width: BAR_W, height: eH, backgroundColor: '#FF6B6B', borderRadius: 3 }} />
            </View>
            <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 4 }}>{d.month}</Text>
          </View>
        )
      })}
    </View>
  )
}

export default function ReportsScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  const [period,     setPeriod]     = useState<Period>('6M')
  const [fundIdx,    setFundIdx]    = useState(0)
  const [fundOpen,   setFundOpen]   = useState(false)

  const chartData = ALL_DATA.slice(-PERIOD_SLICE[period])

  const totalContributed = chartData.reduce((s, d) => s + d.contributions, 0)
  const totalExpenses    = chartData.reduce((s, d) => s + d.expenses, 0)
  const netBalance       = totalContributed - totalExpenses
  const membersPaid      = 14

  const prevPeriodContrib = ALL_DATA.slice(-PERIOD_SLICE[period] * 2, -PERIOD_SLICE[period])
    .reduce((s, d) => s + d.contributions, 0) || 1
  const contribTrend = Math.round(((totalContributed - prevPeriodContrib) / prevPeriodContrib) * 100)

  function handleExport(type: string) {
    Alert.alert('Export', `${type} export coming soon.`)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <Text style={styles.heading}>Reports</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Fund selector */}
        <TouchableOpacity
          style={styles.fundSelector}
          onPress={() => setFundOpen(v => !v)}
          activeOpacity={0.8}
        >
          <Text style={styles.fundSelectorText}>{FUNDS[fundIdx].title}</Text>
          <Ionicons name={fundOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {fundOpen && (
          <View style={styles.fundDropdown}>
            {FUNDS.map((f, i) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.fundOption, i === fundIdx && styles.fundOptionActive]}
                onPress={() => { setFundIdx(i); setFundOpen(false) }}
              >
                <Text style={[styles.fundOptionText, i === fundIdx && styles.fundOptionTextActive]}>
                  {f.title}
                </Text>
                {i === fundIdx && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Period toggle */}
        <View style={styles.periodRow}>
          {(['1M', '3M', '6M', '1Y'] as Period[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#7657F0' }]} />
              <Text style={styles.legendText}>Contributions</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
              <Text style={styles.legendText}>Expenses</Text>
            </View>
          </View>
          <BarChart data={chartData} colors={colors} />
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Total Contributed', value: `P ${totalContributed.toLocaleString()}`,    trend: contribTrend },
            { label: 'Total Expenses',    value: `P ${totalExpenses.toLocaleString()}`,        trend: -8          },
            { label: 'Net Balance',       value: `P ${netBalance.toLocaleString()}`,           trend: 12          },
            { label: 'Members Paid',      value: `${membersPaid} / 19`,                        trend: 4           },
          ].map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statCardLabel}>{stat.label}</Text>
              <Text style={styles.statCardValue}>{stat.value}</Text>
              <View style={styles.trendRow}>
                <Ionicons
                  name={stat.trend >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
                  size={13}
                  color={stat.trend >= 0 ? '#059669' : colors.error}
                />
                <Text style={[styles.trendText, { color: stat.trend >= 0 ? '#059669' : colors.error }]}>
                  {stat.trend >= 0 ? '+' : ''}{stat.trend}% vs prev
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Export options */}
        <View style={styles.exportSection}>
          <Text style={styles.sectionTitle}>Export</Text>
          <View style={styles.exportRow}>
            <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('PDF')} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={styles.exportBtnText}>Download PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('WhatsApp')} activeOpacity={0.8}>
              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
              <Text style={styles.exportBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('CSV')} activeOpacity={0.8}>
              <Ionicons name="grid-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.exportBtnText}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Previous reports */}
        <View style={styles.prevSection}>
          <Text style={styles.sectionTitle}>Previous Reports</Text>
          {PREV_REPORTS.map(r => (
            <TouchableOpacity key={r.id} style={styles.prevRow} activeOpacity={0.75}>
              <View style={styles.prevIcon}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.prevBody}>
                <Text style={styles.prevName}>{r.name}</Text>
                <Text style={styles.prevMeta}>{r.fund} · {r.date} · {r.size}</Text>
              </View>
              <Ionicons name="download-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe:          { flex: 1, backgroundColor: colors.background },
    header:        { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
    heading:       { fontSize: 30, fontFamily: fonts.display.bold, color: colors.heading },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },

    fundSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderWidth: 1.5,
      borderColor: colors.border,
      marginBottom: 4,
    },
    fundSelectorText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    fundDropdown: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
      overflow: 'hidden',
    },
    fundOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    fundOptionActive:   { backgroundColor: colors.primaryLight },
    fundOptionText:     { fontSize: 14, color: colors.textPrimary },
    fundOptionTextActive: { color: colors.textPrimary, fontWeight: '700' },

    periodRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    periodBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 9,
      alignItems: 'center',
    },
    periodBtnActive:   { backgroundColor: colors.primary },
    periodBtnText:     { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    periodBtnTextActive: { color: '#FFFFFF' },

    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    chartLegend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot:   { width: 10, height: 10, borderRadius: 5 },
    legendText:  { fontSize: 12, color: colors.textMuted },

    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 24,
    },
    statCard: {
      width: (W - 50) / 2,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statCardLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
    statCardValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 },
    trendRow:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
    trendText:     { fontSize: 11, fontWeight: '600' },

    exportSection: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    exportRow: { flexDirection: 'row', gap: 10 },
    exportBtn: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    exportBtnText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

    prevSection: { marginBottom: 24 },
    prevRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    prevIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prevBody:  { flex: 1 },
    prevName:  { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
    prevMeta:  { fontSize: 12, color: colors.textMuted },
  })
}
