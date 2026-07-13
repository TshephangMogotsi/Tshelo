import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type FundStatus = 'active' | 'closed' | 'suspended'

type RecentActivity = {
  id:      string
  name:    string
  amount:  number
  timeAgo: string
}

type Fund = {
  id:                 string
  title:              string
  status:             FundStatus
  goal_amount:        number
  raised:             number
  member_count:       number
  category:           string
  emoji:              string
  next_payout:        string
  stats_contributed:  number
  stats_pending:      number
  stats_expenses:     number
  recent_activity:    RecentActivity[]
}

type SmsNotification = {
  id:        string
  amount:    number
  phone:     string
  provider:  string
  timeAgo:   string
  fundId:    string
  fundTitle: string
}

function formatBWP(thebe: number): string {
  const bwp = thebe / 100
  return `P ${bwp.toLocaleString('en-BW', { minimumFractionDigits: 0 })}`
}

const MOCK_FUNDS: Fund[] = [
  {
    id: '1', title: 'Mma Kgosi Funeral', status: 'active',
    goal_amount: 500000, raised: 295000,
    member_count: 12, category: 'Funeral', emoji: '🕯️',
    next_payout: '15 Jun 2025',
    stats_contributed: 8, stats_pending: 4, stats_expenses: 0,
    recent_activity: [
      { id: 'a1', name: 'Thabo M.',     amount: 30000, timeAgo: '2h ago' },
      { id: 'a2', name: 'Keitumetse P.', amount: 20000, timeAgo: '5h ago' },
    ],
  },
]

const MOCK_SMS: SmsNotification[] = [
  {
    id: 's1', amount: 50000, phone: '72 345 678',
    provider: 'Orange Money', timeAgo: '5 min ago',
    fundId: '1', fundTitle: 'Mma Kgosi Funeral',
  },
]

export default function FundsScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  const [smsItems, setSmsItems] = useState<SmsNotification[]>(MOCK_SMS)

  const activeFunds = MOCK_FUNDS.filter(f => f.status === 'active')

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* ── Header ─────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.heading}>Funds</Text>
        <Text style={styles.activeCount}>{activeFunds.length} active</Text>
      </View>
      <View style={styles.headerDivider} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SMS banner ─────────────────────────── */}
        {smsItems.map(sms => (
          <View key={sms.id} style={styles.smsBanner}>
            <View style={styles.smsBannerHeader}>
              <View style={styles.smsIconWrap}>
                <Ionicons name="phone-portrait-outline" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.smsBannerTitle}>New SMS contribution</Text>
              <TouchableOpacity onPress={() => setSmsItems(prev => prev.filter(s => s.id !== sms.id))}>
                <Ionicons name="close" size={18} color="#D97706" />
              </TouchableOpacity>
            </View>

            <View style={styles.smsContent}>
              <View style={styles.smsAmountRow}>
                <Text style={styles.smsAmount}>{formatBWP(sms.amount)}</Text>
                <Text style={styles.smsTime}>{sms.timeAgo}</Text>
              </View>
              <Text style={styles.smsMeta}>From {sms.phone} · {sms.provider}</Text>
            </View>

            <TouchableOpacity
              style={styles.smsAddBtn}
              onPress={() => {
                setSmsItems(prev => prev.filter(s => s.id !== sms.id))
                navigation.navigate('RecordContribution', { fundId: sms.fundId, fundTitle: sms.fundTitle })
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.smsAddBtnText}>Add to {sms.fundTitle}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* ── Fund cards ─────────────────────────── */}
        {activeFunds.map(fund => {
          const pct = Math.round((fund.raised / fund.goal_amount) * 100)
          return (
            <View key={fund.id} style={styles.fundCard}>
              {/* Card top */}
              <View style={styles.cardTop}>
                <View style={styles.fundIconCircle}>
                  <Text style={styles.fundEmoji}>{fund.emoji}</Text>
                </View>
                <View style={styles.cardTopInfo}>
                  <Text style={styles.fundTitle}>{fund.title}</Text>
                  <View style={styles.fundMeta}>
                    <View style={styles.categoryTag}>
                      <Text style={styles.categoryTagText}>{fund.category}</Text>
                    </View>
                    <Ionicons name="people-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.memberText}>{fund.member_count} members</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate('FundDetail', { fundId: fund.id })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Raised + progress */}
              <View style={styles.raisedRow}>
                <Text style={styles.raisedLabel}>{formatBWP(fund.raised)} raised</Text>
                <Text style={styles.pctLabel}>{pct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` as any }]} />
              </View>
              <View style={styles.goalRow}>
                <Text style={styles.goalText}>Goal: {formatBWP(fund.goal_amount)}</Text>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.dateText}>{fund.next_payout}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{fund.stats_contributed}</Text>
                  <Text style={styles.statLabel}>Contributed</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{fund.stats_pending}</Text>
                  <Text style={styles.statLabel}>Pending</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{formatBWP(fund.stats_expenses)}</Text>
                  <Text style={styles.statLabel}>Expenses</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Recent activity */}
              <Text style={styles.activityHeader}>RECENT ACTIVITY</Text>
              {fund.recent_activity.map(item => (
                <View key={item.id} style={styles.activityRow}>
                  <View style={styles.activityIcon}>
                    <Ionicons name="person-outline" size={12} color="#059669" />
                  </View>
                  <Text style={styles.activityText} numberOfLines={1}>
                    <Text style={styles.activityName}>{item.name}</Text>
                    {` contributed ${formatBWP(item.amount)}`}
                  </Text>
                  <Text style={styles.activityTime}>{item.timeAgo}</Text>
                </View>
              ))}
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe:   { flex: 1, backgroundColor: colors.background },

    // ── Header ─────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 14,
    },
    heading: {
      fontSize: 30,
      fontFamily: fonts.display.bold,
      color: colors.textPrimary,
    },
    activeCount: {
      fontSize: 14,
      fontWeight: '600',
      color: '#D97706',
    },
    headerDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 0,
      marginBottom: 16,
    },

    scroll:        { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    // ── SMS banner ─────────────────────────────────────────────
    smsBanner: {
      backgroundColor: '#FEECA4',
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: '#F59E0B',
      padding: 14,
      marginBottom: 16,
      gap: 10,
    },
    smsBannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    smsIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: '#F59E0B',
      alignItems: 'center',
      justifyContent: 'center',
    },
    smsBannerTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: '#92400E',
    },
    smsContent: {
      backgroundColor: '#FFF9E4',
      borderRadius: 10,
      padding: 12,
    },
    smsAmountRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    smsAmount: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    smsTime: {
      fontSize: 12,
      fontWeight: '600',
      color: '#D97706',
    },
    smsMeta: {
      fontSize: 13,
      color: '#D97706',
    },
    smsAddBtn: {
      backgroundColor: '#F59E0B',
      borderRadius: 20,
      paddingVertical: 12,
      alignItems: 'center',
    },
    smsAddBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // ── Fund card ──────────────────────────────────────────────
    fundCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 16,
    },
    fundIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fundEmoji:   { fontSize: 26 },
    cardTopInfo: { flex: 1 },
    fundTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    fundMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    categoryTag: {
      backgroundColor: colors.primaryLight,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    categoryTagText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    memberText: { fontSize: 12, color: colors.textMuted },

    // Progress
    raisedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    raisedLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    pctLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    progressTrack: {
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    goalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    goalText: { fontSize: 12, color: colors.textMuted },
    dateRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dateText: { fontSize: 12, color: colors.textMuted },

    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 14,
    },

    // Stats
    statsRow: {
      flexDirection: 'row',
      marginBottom: 14,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.border,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 3,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },

    // Recent activity
    activityHeader: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    activityIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: '#D1FAE5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
    },
    activityName: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    activityTime: {
      fontSize: 12,
      color: colors.textMuted,
    },
  })
}
