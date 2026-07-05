import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, SectionList, Modal, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type ActivityType = 'contribution' | 'expense'
type ActivityStatus = 'confirmed' | 'pending' | 'sms_detected'
type PaymentMethod = 'Orange Money' | 'MyZaka' | 'Manual'

type ActivityItem = {
  id:          string
  memberName:  string
  fundId:      string
  fundName:    string
  method:      PaymentMethod
  amount:      number
  type:        ActivityType
  status:      ActivityStatus
}

type Section = {
  title: string
  data:  ActivityItem[]
}

function thebeToBWP(thebe: number) {
  return `P ${(thebe / 100).toLocaleString('en-BW', { minimumFractionDigits: 2 })}`
}

const RAW_ACTIVITY: ActivityItem[] = [
  { id: '1', memberName: 'Kgosi Moeng',      fundId: '1', fundName: "Kgosi's Funeral Fund",  method: 'Orange Money', amount: 25000, type: 'contribution', status: 'confirmed'    },
  { id: '2', memberName: 'Naledi Phiri',      fundId: '1', fundName: "Kgosi's Funeral Fund",  method: 'MyZaka',       amount: 25000, type: 'contribution', status: 'pending'      },
  { id: '3', memberName: 'Mpho Sefuthi',      fundId: '2', fundName: 'Mpho & Tebogo Wedding', method: 'Orange Money', amount: 20000, type: 'contribution', status: 'confirmed'    },
  { id: '4', memberName: 'Admin',             fundId: '1', fundName: "Kgosi's Funeral Fund",  method: 'Manual',       amount:  5000, type: 'expense',      status: 'confirmed'    },
  { id: '5', memberName: 'Boitumelo Sithole', fundId: '1', fundName: "Kgosi's Funeral Fund",  method: 'Orange Money', amount: 25000, type: 'contribution', status: 'sms_detected' },
  { id: '6', memberName: 'Refilwe Dlamini',   fundId: '2', fundName: 'Mpho & Tebogo Wedding', method: 'Manual',       amount: 20000, type: 'contribution', status: 'confirmed'    },
  { id: '7', memberName: 'Tebogo Motsepe',    fundId: '2', fundName: 'Mpho & Tebogo Wedding', method: 'MyZaka',       amount: 20000, type: 'contribution', status: 'confirmed'    },
]

const SECTIONS: Section[] = [
  { title: 'Today',     data: RAW_ACTIVITY.slice(0, 2) },
  { title: 'Yesterday', data: RAW_ACTIVITY.slice(2, 4) },
  { title: '15 May',    data: RAW_ACTIVITY.slice(4)    },
]

const FILTERS = ['All', 'Contributions', 'Expenses', "Kgosi's Fund", 'Mpho & Tebogo']

const FUNDS = [
  { id: '1', title: "Kgosi's Funeral Fund" },
  { id: '2', title: 'Mpho & Tebogo Wedding' },
]

const METHOD_ICONS: Record<PaymentMethod, keyof typeof Ionicons.glyphMap> = {
  'Orange Money': 'phone-portrait-outline',
  'MyZaka':       'phone-portrait-outline',
  'Manual':       'cash-outline',
}

const STATUS_CONFIG = {
  confirmed:    { label: 'Confirmed',     bg: '#D1FAE5', text: '#065F46' },
  pending:      { label: 'Pending',       bg: '#FEF3C7', text: '#92400E' },
  sms_detected: { label: 'SMS detected', bg: '#EDE9FE', text: '#5B21B6' },
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function ActivityScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const [filter,      setFilter]      = useState('All')
  const [showPicker,  setShowPicker]  = useState(false)

  const totalIn  = RAW_ACTIVITY.filter(a => a.type === 'contribution').reduce((s, a) => s + a.amount, 0)
  const totalOut = RAW_ACTIVITY.filter(a => a.type === 'expense').reduce((s, a) => s + a.amount, 0)
  const net      = totalIn - totalOut

  function filterItems(items: ActivityItem[]) {
    if (filter === 'All')           return items
    if (filter === 'Contributions') return items.filter(i => i.type === 'contribution')
    if (filter === 'Expenses')      return items.filter(i => i.type === 'expense')
    if (filter === "Kgosi's Fund")  return items.filter(i => i.fundId === '1')
    if (filter === 'Mpho & Tebogo') return items.filter(i => i.fundId === '2')
    return items
  }

  const filteredSections: Section[] = SECTIONS
    .map(s => ({ ...s, data: filterItems(s.data) }))
    .filter(s => s.data.length > 0)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <Text style={styles.heading}>Activity</Text>
      </View>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{thebeToBWP(totalIn)}</Text>
          <View style={styles.summaryLabelRow}>
            <Ionicons name="arrow-down-outline" size={12} color="#059669" />
            <Text style={[styles.summaryLabel, { color: '#059669' }]}>In</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{thebeToBWP(totalOut)}</Text>
          <View style={styles.summaryLabelRow}>
            <Ionicons name="arrow-up-outline" size={12} color={colors.error} />
            <Text style={[styles.summaryLabel, { color: colors.error }]}>Out</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: net >= 0 ? '#059669' : colors.error }]}>
            {thebeToBWP(net)}
          </Text>
          <Text style={styles.summaryLabel}>Net</Text>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={styles.filtersScroll}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Ledger */}
      <SectionList
        style={styles.list}
        sections={filteredSections}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const isExpense = item.type === 'expense'
          const status = STATUS_CONFIG[item.status]
          return (
            <View style={styles.row}>
              <View style={styles.rowAvatar}>
                <Text style={styles.rowAvatarText}>{initials(item.memberName)}</Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTopLine}>
                  <Text style={styles.rowName}>{item.memberName}</Text>
                  <Text style={[styles.rowAmount, { color: isExpense ? colors.error : '#059669' }]}>
                    {isExpense ? '−' : '+'}{thebeToBWP(item.amount)}
                  </Text>
                </View>
                <View style={styles.rowMeta}>
                  <View style={styles.fundTag}>
                    <Text style={styles.fundTagText} numberOfLines={1}>{item.fundName}</Text>
                  </View>
                  <View style={styles.methodTag}>
                    <Ionicons name={METHOD_ICONS[item.method]} size={11} color={colors.textMuted} />
                    <Text style={styles.methodText}>{item.method}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
                  </View>
                </View>
              </View>
            </View>
          )
        }}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Fund picker */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowPicker(false)}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Record Contribution For</Text>
            {FUNDS.map(fund => (
              <TouchableOpacity
                key={fund.id}
                style={styles.fundOption}
                onPress={() => {
                  setShowPicker(false)
                  navigation.navigate('RecordContribution', { fundId: fund.id, fundTitle: fund.title })
                }}
                activeOpacity={0.75}
              >
                <View style={styles.fundOptionIcon}>
                  <Ionicons name="wallet-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.fundOptionText}>{fund.title}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe:   { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
    heading: {
      fontSize: 30,
      fontFamily: fonts.display.bold,
      color: colors.heading,
    },

    summaryRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
    },
    summaryItem:    { flex: 1, alignItems: 'center' },
    summaryDivider: { width: 1, backgroundColor: colors.border },
    summaryValue:   { fontSize: 13, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    summaryLabel:   { fontSize: 11, color: colors.textMuted },

    filtersScroll: { flexGrow: 0, marginBottom: 8 },
    filtersRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 2 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    chipActive:     { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    chipText:       { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    chipTextActive: { color: colors.textPrimary },

    list:        { flex: 1 },
    listContent: { paddingHorizontal: 20, paddingBottom: 100 },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 20,
      marginBottom: 10,
    },

    row: {
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
    rowAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowAvatarText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    rowBody:    { flex: 1 },
    rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    rowName:    { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    rowMeta:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    fundTag:  {
      backgroundColor: colors.primaryLight,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      maxWidth: 130,
    },
    fundTagText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
    methodTag:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
    methodText:  { fontSize: 11, color: colors.textMuted },
    rowAmount: { fontSize: 14, fontWeight: '800' },
    statusBadge: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    statusText: { fontSize: 10, fontWeight: '700' },

    fab: {
      position: 'absolute',
      right: 24,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },

    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 48,
    },
    pickerHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 20,
    },
    pickerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 16,
    },
    fundOption: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    fundOptionIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fundOptionText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  })
}
