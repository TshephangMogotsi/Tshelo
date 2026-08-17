import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import ProviderLogo, { hasProviderLogo } from '../../../components/ProviderLogo'
import {
  Contribution,
  Expense,
  Member,
  PendingRequest,
  PROVIDER_COLORS,
  formatDate,
  formatMoney,
} from './types'

function formatRowMoney(amount: number, currencyCode: string) {
  return formatMoney(amount, currencyCode).replace(/^P\s/, 'P')
}

export function ContributionRow({ item, currencyCode, onPress }: { item: Contribution; currencyCode: string; onPress?: () => void }) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const providerColor = item.payment_method
    ? (PROVIDER_COLORS[item.payment_method] ?? colors.textMuted)
    : colors.textMuted
  const displayAmount = item.status === 'pledged'
    ? Number(item.pledged_amount ?? item.amount)
    : Number(item.amount)
  const statusLabel = item.is_refunded
    ? 'Refunded'
    : item.pledge_state === 'partially_paid'
      ? 'Partially paid'
      : item.pledge_state === 'fulfilled'
        ? 'Fulfilled'
        : item.status.charAt(0).toUpperCase() + item.status.slice(1)
  const showStatus = statusLabel !== 'Confirmed'

  return (
    <TouchableOpacity style={styles.listRow} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      {hasProviderLogo(item.payment_method) ? (
        <View style={styles.providerLogoWrap}>
          <ProviderLogo provider={item.payment_method} size={36} variant="mark" />
        </View>
      ) : (
        <View style={[styles.providerDot, { backgroundColor: providerColor + '20' }]}>
          {item.payment_method ? (
            <Text style={[styles.providerDotText, { color: providerColor }]}>
              {item.payment_method.charAt(0).toUpperCase()}
            </Text>
          ) : (
            <Ionicons name="person-outline" size={19} color={providerColor} />
          )}
        </View>
      )}

      <View style={styles.contributionBody}>
        <Text style={styles.listRowName} numberOfLines={1}>{item.contributor_name}</Text>
        <View style={styles.contributionMeta}>
          <View style={[
            styles.contributorTypeBadge,
            item.contributor_type === 'guest' && styles.guestTypeBadge,
          ]}>
            <Text style={[
              styles.contributorTypeBadgeText,
              item.contributor_type === 'guest' && styles.guestTypeBadgeText,
            ]}>
              {item.contributor_type === 'member' ? 'Member' : 'Guest'}
            </Text>
          </View>
          {showStatus && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{statusLabel}</Text>
            </View>
          )}
          {item.detected_via !== 'manual' && (
            <View style={styles.smsBadge}>
              <Text style={styles.smsBadgeText}>SMS</Text>
            </View>
          )}
        </View>
        {item.outstanding_amount !== null && item.allocated_amount > 0 && (
          <Text style={styles.allocationText}>
            Received {formatMoney(item.allocated_amount, currencyCode)} · Outstanding {formatMoney(item.outstanding_amount, currencyCode)}
          </Text>
        )}
      </View>
      <View style={styles.contributionTrailing}>
        <Text style={styles.listRowAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {formatRowMoney(displayAmount, currencyCode)}
        </Text>
        <Text style={styles.listRowDate}>{formatDate(item.confirmed_at ?? item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  )
}

export function ExpenseRow({ item, currencyCode, onPress }: { item: Expense; currencyCode: string; onPress?: () => void }) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  return (
    <TouchableOpacity style={styles.listRow} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <View style={[styles.providerDot, { backgroundColor: colors.errorLight }]}>
        <Text style={[styles.providerDotText, { color: item.is_sponsored ? colors.accent : colors.error }]}>
          {item.is_sponsored ? '♛' : '↑'}
        </Text>
      </View>

      <View style={styles.listRowBody}>
        <View style={styles.listRowTop}>
          <Text style={styles.listRowName} numberOfLines={1}>{item.description}</Text>
          <Text style={[styles.listRowAmount, { color: item.is_sponsored ? colors.accent : colors.error }]}>
            {item.is_sponsored ? '' : '−'}{formatRowMoney(item.amount, currencyCode)}
          </Text>
        </View>
        <View style={styles.listRowBottom}>
          <Text style={styles.listRowDate}>{formatDate(item.created_at)}</Text>
          {item.vendor_name ? (
            <Text style={styles.listRowVendor} numberOfLines={1}>· {item.vendor_name}</Text>
          ) : null}
          {item.category ? (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{item.category}</Text>
            </View>
          ) : null}
          {item.has_open_query ? (
            <View style={styles.disputedBadge}>
              <Text style={styles.disputedBadgeText}>Queried</Text>
            </View>
          ) : null}
          {item.is_sponsored ? (
            <View style={styles.categoryChip}>
              <Text style={[styles.categoryChipText, { color: colors.accent }]}>
                Sponsored{item.sponsored_by_name ? ` by ${item.sponsored_by_name}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
        {item.notes ? <Text style={styles.listRowNote}>{item.notes}</Text> : null}
      </View>
    </TouchableOpacity>
  )
}

export function MemberRow({
  item, isRichAuntie, canRemove, isRemoving, onRemove, onPress, onOptions,
}: {
  item: Member
  isRichAuntie?: boolean
  canRemove?: boolean
  isRemoving?: boolean
  onRemove?: () => void
  onPress?: () => void
  onOptions?: () => void
}) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const initials = item.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  function handleOptions() {
    if (onOptions) {
      onOptions()
      return
    }
    Alert.alert(item.display_name, undefined, [
      { text: 'Remove Member', style: 'destructive', onPress: onRemove },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <TouchableOpacity
      style={[styles.listRow, isRichAuntie && styles.richAuntieRow]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.72 : 1}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
        {isRichAuntie && (
          <View style={styles.richAuntieCrown}>
            <Text style={styles.richAuntieCrownText}>♛</Text>
          </View>
        )}
      </View>
      <View style={styles.listRowBody}>
        <View style={styles.listRowTop}>
          <Text style={styles.listRowName}>{item.display_name}</Text>
          <View style={styles.memberRecognitionBadges}>
            {isRichAuntie && (
              <View style={styles.richAuntieBadge}>
                <Text style={styles.richAuntieBadgeText}>♛ Rich Auntie</Text>
              </View>
            )}
            {item.role === 'owner' && (
              <View style={styles.organiserBadge}>
                <Text style={styles.organiserBadgeText}>Organiser</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.listRowDate}>{item.phone}</Text>
      </View>
      {(canRemove || onOptions) && (
        isRemoving ? (
          <ActivityIndicator size="small" color={colors.error} />
        ) : (
          <View style={styles.memberTrailingGroup}>
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>{item.role === 'admin' ? 'Admin' : 'Member'}</Text>
            </View>
            <TouchableOpacity
              style={styles.memberOptionsBtn}
              onPress={handleOptions}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Manage ${item.display_name}`}
            >
              <Text style={styles.memberOptionsBtnText}>⋮</Text>
            </TouchableOpacity>
          </View>
        )
      )}
    </TouchableOpacity>
  )
}

export function PendingRequestRow({
  request, isDeciding, onApprove, onReject,
}: {
  request: PendingRequest
  isDeciding: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  return (
    <View style={styles.pendingRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {request.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={styles.pendingBody}>
        <Text style={styles.listRowName}>{request.display_name}</Text>
        <Text style={styles.listRowDate}>{request.phone}</Text>
      </View>
      {isDeciding ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.pendingActions}>
          <TouchableOpacity
            style={styles.pendingRejectBtn}
            onPress={onReject}
            activeOpacity={0.8}
          >
            <Text style={styles.pendingRejectBtnText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pendingApproveBtn}
            onPress={onApprove}
            activeOpacity={0.8}
          >
            <Text style={styles.pendingApproveBtnText}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    providerLogoWrap: {
      width: 36,
      height: 36,
      alignSelf: 'center',
      flexShrink: 0,
    },
    statusBadge: {
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusBadgeText: {
      fontSize: 9,
      fontFamily: fonts.inter.bold,
      color: colors.textSecondary,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 64,
      backgroundColor: '#F7F7F7',
      borderRadius: 13,
      padding: 10,
      marginBottom: 8,
      gap: 10,
      borderWidth: 1,
      borderColor: '#D9D9D9',
    },
    richAuntieRow: {
      backgroundColor: '#FFF3C4',
      borderColor: '#F4A300',
      borderWidth: 1.5,
      shadowColor: '#C77800',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 5,
      elevation: 2,
    },
    providerDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    providerDotText: {
      fontSize: 15,
      fontFamily: fonts.inter.extraBold,
    },
    listRowBody: {
      flex: 1,
    },
    contributionBody: {
      flex: 1,
      minWidth: 0,
      minHeight: 36,
      justifyContent: 'center',
    },
    contributionTrailing: {
      width: 96,
      minWidth: 0,
      alignSelf: 'stretch',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 4,
    },
    contributionMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 1,
    },
    listRowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    contributorNameWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginRight: 8,
    },
    listRowName: {
      fontSize: 13,
      lineHeight: 16,
      fontFamily: fonts.inter.bold,
      color: colors.textPrimary,
      flex: 1,
    },
    contributorTypeBadge: {
      flexShrink: 0,
      borderRadius: 999,
      minWidth: 54,
      paddingHorizontal: 6,
      paddingVertical: 1,
      alignItems: 'center',
      backgroundColor: '#E8DDFF',
    },
    contributorTypeBadgeText: {
      fontSize: 8,
      lineHeight: 10,
      fontFamily: fonts.inter.bold,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    guestTypeBadge: {
      backgroundColor: '#FEF3C7',
    },
    guestTypeBadgeText: {
      color: '#B45309',
    },
    listRowAmount: {
      width: '100%',
      fontSize: 13,
      fontFamily: fonts.inter.bold,
      color: colors.primary,
      textAlign: 'right',
    },
    listRowBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    listRowDate: {
      fontSize: 9,
      fontFamily: fonts.inter.regular,
      color: colors.textMuted,
    },
    listRowVendor: {
      fontSize: 12,
      color: colors.textSecondary,
      fontFamily: fonts.inter.semiBold,
      flexShrink: 1,
    },
    listRowNote: {
      fontSize: 12,
      fontFamily: fonts.inter.italic,
      color: colors.textSecondary,
      marginTop: 4,
    },
    allocationText: {
      marginTop: 5,
      fontSize: 11,
      color: colors.success,
      fontFamily: fonts.inter.semiBold,
    },
    badgeRow: {
      flexDirection: 'row',
      gap: 6,
    },
    smsBadge: {
      backgroundColor: colors.primaryLight,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    smsBadgeText: {
      fontSize: 10,
      fontFamily: fonts.inter.bold,
      color: colors.primary,
    },
    disputedBadge: {
      backgroundColor: colors.errorLight,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    disputedBadgeText: {
      fontSize: 10,
      fontFamily: fonts.inter.bold,
      color: colors.error,
    },
    categoryChip: {
      backgroundColor: colors.background,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryChipText: {
      fontSize: 10,
      fontFamily: fonts.inter.semiBold,
      color: colors.textSecondary,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      position: 'relative',
    },
    avatarText: {
      fontSize: 14,
      fontFamily: fonts.inter.extraBold,
      color: colors.primary,
    },
    richAuntieCrown: {
      position: 'absolute',
      right: -5,
      bottom: -5,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F4A300',
      borderWidth: 2,
      borderColor: '#F7F7F7',
    },
    richAuntieCrownText: {
      color: '#FFFFFF',
      fontSize: 10,
      lineHeight: 12,
      fontFamily: fonts.inter.bold,
    },
    memberRecognitionBadges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flexShrink: 0,
    },
    richAuntieBadge: {
      backgroundColor: '#FFF3D6',
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    richAuntieBadgeText: {
      fontSize: 9,
      fontFamily: fonts.inter.bold,
      color: '#C77800',
    },
    organiserBadge: {
      backgroundColor: colors.primaryLight,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    organiserBadgeText: {
      fontSize: 10,
      fontFamily: fonts.inter.bold,
      color: colors.primary,
    },
    memberTrailingGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'center',
    },
    memberBadge: {
      backgroundColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    memberBadgeText: {
      fontSize: 10,
      fontFamily: fonts.inter.bold,
      color: colors.textSecondary,
    },
    memberOptionsBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberOptionsBtnText: {
      fontSize: 26,
      fontFamily: fonts.inter.regular,
      color: colors.textPrimary,
      textAlignVertical: 'center',
      includeFontPadding: false,
    },
    pendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentLight,
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pendingBody: {
      flex: 1,
    },
    pendingActions: {
      flexDirection: 'row',
      gap: 8,
    },
    pendingRejectBtn: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: colors.error,
    },
    pendingRejectBtnText: {
      fontSize: 12,
      fontFamily: fonts.inter.bold,
      color: colors.error,
    },
    pendingApproveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    pendingApproveBtnText: {
      fontSize: 12,
      fontFamily: fonts.inter.bold,
      color: '#FFFFFF',
    },
  })
}
