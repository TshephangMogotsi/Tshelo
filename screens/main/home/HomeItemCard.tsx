import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { HomeItem, formatEventDate, formatMoney } from './helpers'

type Props = {
  item: HomeItem
  onPress: () => void
}

export default function HomeItemCard({ item, onPress }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const pct     = item.goal_amount > 0 ? Math.round((item.total_contributions / item.goal_amount) * 100) : 0
  const isEvent = item.kind === 'event'
  const isEF    = item.kind === 'eventFund'

  return (
    <TouchableOpacity
      style={styles.overviewCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.overviewTop}>
        <View style={[styles.fundLetterIcon, (isEvent || isEF) && styles.eventLetterIcon]}>
          <Text style={styles.fundLetterText}>{item.emoji}</Text>
        </View>
        <View style={styles.overviewInfo}>
          <Text style={styles.overviewTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.overviewTagRow}>
            <View style={[styles.overviewTag, (isEvent || isEF) && styles.eventTag]}>
              <Text style={[styles.overviewTagText, (isEvent || isEF) && styles.eventTagText]}>{item.category}</Text>
            </View>
            {!isEvent && item.role === 'member' && (
              <View style={styles.memberBadge}>
                <Text style={styles.memberBadgeText}>Member</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {!isEvent && (
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={[colors.primary, '#55CFC6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` as any }]}
          />
        </View>
      )}

      {(isEvent || isEF) && (
        <View style={styles.eventMetaCard}>
          <View style={styles.eventMetaItem}>
            <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
            <Text style={styles.eventMetaText}>{formatEventDate(item.event_date)}</Text>
          </View>
          <View style={styles.eventMetaItem}>
            <Ionicons name="location-outline" size={15} color={colors.textMuted} />
            <Text style={styles.eventMetaText} numberOfLines={1}>{item.venue_name || 'Venue TBC'}</Text>
          </View>
          <View style={styles.eventMetaItem}>
            <Ionicons name="people-outline" size={15} color={colors.textMuted} />
            <Text style={styles.eventMetaText}>{item.guest_count} {item.guest_count === 1 ? 'guest' : 'guests'}</Text>
          </View>
        </View>
      )}

      <View style={styles.overviewBottom}>
        <Text style={styles.overviewMeta}>
          {isEvent
            ? `${item.guest_count} invited`
            : `${formatMoney(item.total_contributions, item.currency_code)} contributed · ${item.member_count} members`}
        </Text>
        <Text style={[styles.overviewAction, (isEvent || isEF) && styles.eventAction]}>
          {isEvent ? 'View event' : `${pct}%`}
        </Text>
      </View>

      {!isEvent && (
        <View style={styles.fundAmountsRow}>
          <View style={styles.fundAmount}>
            <Text style={styles.fundAmountLabel}>Available balance</Text>
            <Text style={styles.fundAmountValue}>{formatMoney(item.balance, item.currency_code)}</Text>
          </View>
          <View style={[styles.fundAmount, styles.fundAmountRight]}>
            <Text style={styles.fundAmountLabel}>Goal</Text>
            <Text style={styles.fundAmountValue}>{formatMoney(item.goal_amount, item.currency_code)}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    overviewCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.04,
      shadowRadius: 14,
      elevation: 2,
    },
    overviewTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 14,
    },
    fundLetterIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    eventLetterIcon: {
      backgroundColor: '#55CFC6',
    },
    fundLetterText: {
      fontSize: 19,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    overviewInfo: {
      flex: 1,
      gap: 9,
    },
    overviewTitle: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    overviewTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    overviewTag: {
      alignSelf: 'flex-start',
      minWidth: 95,
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 18,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    overviewTagText: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.primary,
    },
    memberBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    memberBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    eventTag: {
      backgroundColor: '#CFF5EF',
    },
    eventTagText: {
      color: '#0F9F8D',
    },
    eventMetaCard: {
      gap: 7,
      marginBottom: 12,
      paddingHorizontal: 11,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.background,
    },
    eventMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    eventMetaText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    overviewBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    overviewMeta: {
      flex: 1,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    overviewAction: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.primary,
    },
    eventAction: {
      color: '#059669',
    },
    fundAmountsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    fundAmount: {
      flex: 1,
      gap: 3,
    },
    fundAmountRight: {
      alignItems: 'flex-end',
    },
    fundAmountLabel: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      color: colors.textMuted,
    },
    fundAmountValue: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    progressTrack: {
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginBottom: 6,
    },
    progressFill: { height: '100%', borderRadius: 6, backgroundColor: colors.primary },
  })
}
