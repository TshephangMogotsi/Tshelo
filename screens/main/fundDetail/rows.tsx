import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import {
  Contribution,
  Expense,
  Member,
  PendingRequest,
  PROVIDER_COLORS,
  formatDate,
  formatMoney,
} from './types'

export function ContributionRow({ item, currencyCode }: { item: Contribution; currencyCode: string }) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const providerColor = item.payment_method
    ? (PROVIDER_COLORS[item.payment_method] ?? colors.textMuted)
    : colors.textMuted

  return (
    <View style={styles.listRow}>
      <View style={[styles.providerDot, { backgroundColor: providerColor + '20' }]}>
        <Text style={[styles.providerDotText, { color: providerColor }]}>
          {item.payment_method ? item.payment_method.charAt(0).toUpperCase() : '?'}
        </Text>
      </View>

      <View style={styles.listRowBody}>
        <View style={styles.listRowTop}>
          <Text style={styles.listRowName} numberOfLines={1}>{item.contributor_name}</Text>
          <Text style={styles.listRowAmount}>{formatMoney(item.amount, currencyCode)}</Text>
        </View>
        <View style={styles.listRowBottom}>
          <Text style={styles.listRowDate}>
            {item.confirmed_at ? formatDate(item.confirmed_at) : 'Pending'}
          </Text>
          <View style={styles.badgeRow}>
            {item.detected_via !== 'manual' && (
              <View style={styles.smsBadge}>
                <Text style={styles.smsBadgeText}>SMS</Text>
              </View>
            )}
          </View>
        </View>
        {item.notes ? <Text style={styles.listRowNote}>{item.notes}</Text> : null}
      </View>
    </View>
  )
}

export function ExpenseRow({ item, currencyCode }: { item: Expense; currencyCode: string }) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const displayName = item.vendor_name ?? item.description

  return (
    <View style={styles.listRow}>
      <View style={[styles.providerDot, { backgroundColor: colors.errorLight }]}>
        <Text style={[styles.providerDotText, { color: colors.error }]}>↑</Text>
      </View>

      <View style={styles.listRowBody}>
        <View style={styles.listRowTop}>
          <Text style={styles.listRowName} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.listRowAmount, { color: colors.error }]}>
            −{formatMoney(item.amount, currencyCode)}
          </Text>
        </View>
        <View style={styles.listRowBottom}>
          <Text style={styles.listRowDate}>{formatDate(item.created_at)}</Text>
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
        </View>
        {item.notes ? <Text style={styles.listRowNote}>{item.notes}</Text> : null}
      </View>
    </View>
  )
}

export function MemberRow({
  item, canRemove, isRemoving, onRemove,
}: {
  item: Member
  canRemove?: boolean
  isRemoving?: boolean
  onRemove?: () => void
}) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const initials = item.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  function handleOptions() {
    Alert.alert(item.display_name, undefined, [
      { text: 'Remove Member', style: 'destructive', onPress: onRemove },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <View style={styles.listRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.listRowBody}>
        <View style={styles.listRowTop}>
          <Text style={styles.listRowName}>{item.display_name}</Text>
          {item.role === 'owner' && (
            <View style={styles.organiserBadge}>
              <Text style={styles.organiserBadgeText}>Organiser</Text>
            </View>
          )}
        </View>
        <Text style={styles.listRowDate}>{item.phone}</Text>
      </View>
      {canRemove && (
        isRemoving ? (
          <ActivityIndicator size="small" color={colors.error} />
        ) : (
          <View style={styles.memberTrailingGroup}>
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>{item.role === 'admin' ? 'Admin' : 'Member'}</Text>
            </View>
            <TouchableOpacity style={styles.memberOptionsBtn} onPress={handleOptions} activeOpacity={0.7}>
              <Text style={styles.memberOptionsBtnText}>⋮</Text>
            </TouchableOpacity>
          </View>
        )
      )}
    </View>
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
    listRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    providerDot: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    providerDotText: {
      fontSize: 15,
      fontWeight: '800',
    },
    listRowBody: {
      flex: 1,
    },
    listRowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    listRowName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
      marginRight: 8,
    },
    listRowAmount: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.primary,
    },
    listRowBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    listRowDate: {
      fontSize: 12,
      color: colors.textMuted,
    },
    listRowNote: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      fontStyle: 'italic',
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
      fontWeight: '700',
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
      fontWeight: '700',
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
      fontWeight: '600',
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
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary,
    },
    organiserBadge: {
      backgroundColor: colors.primaryLight,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    organiserBadgeText: {
      fontSize: 10,
      fontWeight: '700',
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
      fontWeight: '700',
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
      fontWeight: '700',
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
      fontWeight: '700',
      color: '#FFFFFF',
    },
  })
}
