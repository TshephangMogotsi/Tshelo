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
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  const pct     = item.goal_amount > 0 ? Math.round((item.total_contributions / item.goal_amount) * 100) : 0
  const isEvent = item.kind === 'event'
  const isEF    = item.kind === 'eventFund'

  return (
    <TouchableOpacity
      style={[
        styles.overviewCard,
        isEvent ? styles.eventCard : isEF ? styles.eventFundCard : styles.fundCard,
        isDark && styles.darkCard,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.cardPanel}>
        <View style={styles.overviewTop}>
          <View style={styles.fundLetterIcon}>
            <Text style={styles.fundLetterText}>{item.emoji}</Text>
          </View>
          <View style={styles.overviewInfo}>
            <Text style={styles.overviewTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.overviewTagRow}>
              <View style={styles.overviewTag}>
                <Text style={styles.overviewTagText}>{item.category}</Text>
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
              <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
              <Text style={styles.eventMetaText} numberOfLines={1}>{formatEventDate(item.event_date)}</Text>
            </View>
            <View style={[styles.eventMetaItem, styles.eventMetaVenue]}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.eventMetaText, styles.eventMetaVenueText]} numberOfLines={1}>{item.venue_name || 'Venue TBC'}</Text>
            </View>
            <View style={styles.eventMetaItem}>
              <Ionicons name="people-outline" size={13} color={colors.textMuted} />
              <Text style={styles.eventMetaText} numberOfLines={1}>{item.guest_count}</Text>
            </View>
          </View>
        )}

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
      </View>

      <View style={styles.overviewBottom}>
        <Text style={styles.overviewMeta} numberOfLines={1}>
          {isEvent
            ? `${item.guest_count} invited`
            : `${formatMoney(item.total_contributions, item.currency_code)} contributed · ${item.member_count} members`}
        </Text>
        <Text style={styles.overviewAction}>
          {isEvent ? 'View event' : `${pct}%`}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    overviewCard: {
      borderRadius: 21,
      borderWidth: 1,
      borderColor: '#D2C2FF',
      backgroundColor: '#E7DEFF',
      shadowColor: '#5A3FA3',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.13,
      shadowRadius: 16,
      elevation: 5,
      overflow: 'visible',
    },
    fundCard: { backgroundColor: '#E7DEFF', borderColor: '#D2C2FF' },
    eventCard: { backgroundColor: '#FFF0C2', borderColor: '#F5D977' },
    eventFundCard: { backgroundColor: '#FFD8D0', borderColor: '#FFBCAF' },
    darkCard: { backgroundColor: colors.primaryLight, borderColor: colors.border },
    cardPanel: {
      backgroundColor: colors.surface,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      shadowColor: '#3C286B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 9,
      elevation: 3,
    },
    overviewTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      marginBottom: 12,
    },
    fundLetterIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    fundLetterText: {
      fontSize: 19,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    overviewInfo: {
      flex: 1,
      gap: 5,
    },
    overviewTitle: {
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '800',
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
      minWidth: 0,
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    overviewTagText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
    },
    memberBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    memberBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
    },
    eventMetaCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: 2,
    },
    eventMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      flexShrink: 0,
      minHeight: 34,
      paddingHorizontal: 9,
      paddingVertical: 7,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
    },
    eventMetaVenue: { flex: 1, minWidth: 0, flexShrink: 1 },
    eventMetaVenueText: { flex: 1, minWidth: 0 },
    eventMetaText: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    overviewBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 42,
      paddingHorizontal: 16,
      paddingTop: 7,
      paddingBottom: 8,
    },
    overviewMeta: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '500',
      color: colors.textPrimary,
      opacity: 0.68,
    },
    overviewAction: {
      fontSize: 12,
      fontWeight: '900',
      color: colors.primary,
      letterSpacing: 0.3,
    },
    fundAmountsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    fundAmount: {
      flex: 1,
      gap: 2,
      minHeight: 51,
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 11,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    fundAmountRight: {
      alignItems: 'flex-start',
    },
    fundAmountLabel: {
      fontSize: 9,
      lineHeight: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.45,
    },
    fundAmountValue: {
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    progressTrack: {
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginBottom: 6,
    },
    progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  })
}
