import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import { FundDetail } from './types'

export const FUND_HEADER_PURPLE = '#E8DDFF'

type Styles = ReturnType<typeof makeStyles>

function formatHeaderMoney(amount: number, currencyCode: string, fractionDigits = 2) {
  const symbol = currencyCode === 'BWP' ? 'P' : currencyCode
  return `${symbol}${Number(amount ?? 0).toLocaleString('en-BW', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`
}

function ProgressBar({ value, max, styles }: { value: number; max: number; styles: Styles }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} />
    </View>
  )
}

function MoneyMetric({
  label,
  amount,
  currencyCode,
  styles,
}: {
  label: string
  amount: number
  currencyCode: string
  styles: Styles
}) {
  return (
    <View style={styles.moneyMetric}>
      <Text style={styles.moneyMetricLabel}>{label}</Text>
      <Text style={styles.moneyMetricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {formatHeaderMoney(amount, currencyCode)}
      </Text>
    </View>
  )
}

type Props = {
  fund: FundDetail
  isOwner: boolean
  isDeleting: boolean
  remainingToTarget: number
  amountOverTarget: number
  onBack: () => void
  onViewHistory: () => void
  onViewEvent?: () => void
  onMoreOptions: () => void
}

export default function FundHeader({
  fund,
  isOwner,
  isDeleting,
  remainingToTarget,
  amountOverTarget,
  onBack,
  onViewHistory,
  onViewEvent,
  onMoreOptions,
}: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onBack}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="#0D0D0D" />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onMoreOptions}
            disabled={isDeleting}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={isOwner ? 'Fund actions' : 'Membership actions'}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#0D0D0D" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.fundTitle} numberOfLines={2}>{fund.title}</Text>
          {fund.status !== 'active' && <Text style={styles.statusBadge}>{fund.status}</Text>}
        </View>
        <TouchableOpacity style={styles.historyButton} onPress={onViewHistory} activeOpacity={0.82}>
          <Text style={styles.historyText}>History</Text>
        </TouchableOpacity>
      </View>

      {onViewEvent && (
        <TouchableOpacity style={styles.linkedEventButton} onPress={onViewEvent} activeOpacity={0.8}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={styles.linkedEventText}>View linked event</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      <ProgressBar value={fund.total_contributions} max={fund.goal_amount} styles={styles} />

      <View style={styles.detailsCard}>
        <View style={styles.targetRow}>
          <Text style={styles.targetLabel}>FUND TARGET</Text>
          <View style={styles.targetPill}>
            <Text style={styles.targetValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {formatHeaderMoney(fund.goal_amount, fund.currency_code, 0)}
            </Text>
          </View>
        </View>

        <View style={styles.moneyMetrics}>
          <MoneyMetric label="Total In" amount={fund.total_contributions} currencyCode={fund.currency_code} styles={styles} />
          <MoneyMetric label="Total Out" amount={fund.total_expenses} currencyCode={fund.currency_code} styles={styles} />
          <MoneyMetric label="Outstanding" amount={remainingToTarget} currencyCode={fund.currency_code} styles={styles} />
        </View>

        <View style={styles.positionRow}>
          <Text style={styles.positionLabel}>Available balance</Text>
          <Text style={styles.positionValue}>{formatHeaderMoney(fund.balance, fund.currency_code)}</Text>
        </View>

        {amountOverTarget > 0 && (
          <View style={styles.overTargetBanner}>
            <Ionicons name="trending-up" size={15} color={colors.success} />
            <Text style={styles.overTargetText}>
              {formatHeaderMoney(amountOverTarget, fund.currency_code)} above target
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      backgroundColor: FUND_HEADER_PURPLE,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#F1F1F1',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    titleWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    fundTitle: {
      flexShrink: 1,
      fontSize: 18,
      lineHeight: 23,
      fontFamily: fonts.inter.extraBold,
      color: '#0D0D0D',
    },
    statusBadge: {
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: '#FFFFFFAA',
      color: '#52525B',
      fontSize: 9,
      fontFamily: fonts.inter.black,
      textTransform: 'uppercase',
    },
    historyButton: {
      minWidth: 76,
      height: 34,
      paddingHorizontal: 14,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
    },
    historyText: {
      fontSize: 12,
      fontFamily: fonts.inter.bold,
      color: colors.primary,
    },
    linkedEventButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 40,
      paddingHorizontal: 14,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: '#FFFFFFAA',
    },
    linkedEventText: {
      flex: 1,
      fontSize: 12,
      fontFamily: fonts.inter.extraBold,
      color: colors.primary,
    },
    progressTrack: {
      height: 4,
      marginBottom: 12,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: '#FFFFFF',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    detailsCard: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 14,
      borderRadius: 15,
      backgroundColor: '#FFFFFF',
    },
    targetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    targetLabel: {
      fontSize: 12,
      fontFamily: fonts.inter.bold,
      color: '#0D0D0D',
    },
    targetPill: {
      minWidth: 100,
      maxWidth: 130,
      height: 28,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: FUND_HEADER_PURPLE,
      borderWidth: 1,
      borderColor: '#D2C3F1',
    },
    targetValue: {
      width: '100%',
      fontSize: 13,
      fontFamily: fonts.inter.bold,
      color: '#0D0D0D',
      textAlign: 'center',
    },
    moneyMetrics: {
      flexDirection: 'row',
      gap: 6,
    },
    moneyMetric: {
      flex: 1,
      minWidth: 0,
      minHeight: 43,
      paddingHorizontal: 7,
      paddingVertical: 6,
      borderRadius: 8,
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E4E4E7',
    },
    moneyMetricLabel: {
      marginBottom: 2,
      fontSize: 8,
      color: '#A1A1AA',
      fontFamily: fonts.inter.regular,
    },
    moneyMetricValue: {
      width: '100%',
      fontSize: 12,
      fontFamily: fonts.inter.bold,
      color: '#0D0D0D',
    },
    positionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#E4E4E7',
    },
    positionLabel: {
      fontSize: 11,
      fontFamily: fonts.inter.medium,
      color: '#71717A',
    },
    positionValue: {
      fontSize: 12,
      fontFamily: fonts.inter.extraBold,
      color: '#0D0D0D',
    },
    overTargetBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 9,
      backgroundColor: colors.successLight,
    },
    overTargetText: {
      fontSize: 11,
      fontFamily: fonts.inter.bold,
      color: colors.success,
    },
  })
}
