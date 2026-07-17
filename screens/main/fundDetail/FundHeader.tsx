import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { FundDetail, formatMoney } from './types'

type Styles = ReturnType<typeof makeStyles>

function ProgressBar({ value, max, styles }: { value: number; max: number; styles: Styles }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} />
    </View>
  )
}

type Props = {
  fund: FundDetail
  isOrganiser: boolean
  isOwner: boolean
  isDeleting: boolean
  onBack: () => void
  onRecordContribution: () => void
  onRecordExpense: () => void
  onViewHistory: () => void
  onViewEvent?: () => void
  onMoreOptions: () => void
  onCopyCode: () => void
  onShareInvite: () => void
}

export default function FundHeader({
  fund,
  isOrganiser,
  isOwner,
  isDeleting,
  onBack,
  onRecordContribution,
  onRecordExpense,
  onViewHistory,
  onViewEvent,
  onMoreOptions,
  onCopyCode,
  onShareInvite,
}: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const pct = fund.goal_amount > 0
    ? Math.round((fund.total_contributions / fund.goal_amount) * 100)
    : 0

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {isOrganiser && (
            <>
              <TouchableOpacity
                style={styles.recordBtn}
                onPress={onRecordContribution}
                activeOpacity={0.85}
              >
                <Text style={styles.recordBtnText}>＋ Contribution</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.recordBtn, styles.recordBtnExpense]}
                onPress={onRecordExpense}
                activeOpacity={0.85}
              >
                <Text style={styles.recordBtnText}>↑ Expense</Text>
              </TouchableOpacity>
            </>
          )}
          {isOwner && (
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={onMoreOptions}
              disabled={isDeleting}
              activeOpacity={0.7}
            >
              <Text style={styles.moreBtnText}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.fundTitle}>{fund.title}</Text>
        {fund.status !== 'active' && <Text style={styles.statusBadge}>{fund.status}</Text>}
        <TouchableOpacity style={styles.historyBtn} onPress={onViewHistory} activeOpacity={0.8}>
          <Text style={styles.historyIcon}>↻</Text>
          <Text style={styles.historyText}>History</Text>
        </TouchableOpacity>
      </View>

      {onViewEvent && (
        <TouchableOpacity style={styles.linkedEventBtn} onPress={onViewEvent} activeOpacity={0.8}>
          <Text style={styles.linkedEventIcon}>📅</Text>
          <Text style={styles.linkedEventText}>View linked event</Text>
          <Text style={styles.linkedEventArrow}>↔</Text>
        </TouchableOpacity>
      )}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatMoney(fund.balance, fund.currency_code)}</Text>
          <Text style={styles.statLabel}>Balance</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatMoney(fund.goal_amount, fund.currency_code)}</Text>
          <Text style={styles.statLabel}>Goal</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{fund.member_count}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <ProgressBar value={fund.total_contributions} max={fund.goal_amount} styles={styles} />
        <Text style={styles.progressPct}>{pct}%</Text>
      </View>

      {isOrganiser && fund.fund_code ? (
        <View style={styles.inviteRow}>
          <View style={styles.inviteCode}>
            <Text style={styles.inviteLabel}>Invite Code</Text>
            <Text style={styles.inviteCodeText}>{fund.fund_code}</Text>
          </View>
          <TouchableOpacity style={styles.inviteAction} onPress={onCopyCode} activeOpacity={0.8}>
            <Text style={styles.inviteActionText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inviteAction} onPress={onShareInvite} activeOpacity={0.8}>
            <Text style={styles.inviteActionText}>Share</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    backIcon: {
      fontSize: 20,
      color: colors.textPrimary,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    recordBtn: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recordBtnExpense: {},
    recordBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    moreBtn: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    moreBtnText: {
      fontSize: 18,
      color: colors.textPrimary,
      lineHeight: 22,
    },
    fundTitle: {
      flex: 1,
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    historyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 18,
      paddingHorizontal: 11,
      paddingVertical: 7,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    statusBadge: {
      fontSize: 10,
      fontWeight: '900',
      color: colors.textMuted,
      textTransform: 'uppercase',
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 4,
      backgroundColor: colors.border,
    },
    historyIcon: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primary,
    },
    historyText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary,
    },
    linkedEventBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    linkedEventIcon: { fontSize: 16 },
    linkedEventText: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.primary },
    linkedEventArrow: { fontSize: 16, fontWeight: '800', color: colors.primary },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },
    statDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.border,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    progressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    progressPct: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      width: 36,
      textAlign: 'right',
    },
    inviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inviteCode: {
      flex: 1,
    },
    inviteLabel: {
      fontSize: 10,
      color: colors.textMuted,
      marginBottom: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inviteCodeText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: 1.5,
    },
    inviteAction: {
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inviteActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
  })
}
