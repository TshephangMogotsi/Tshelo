import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import type { AppColors } from '../../theme/themes'
import { supabase } from '../../lib/supabase'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'Notifications'>
}

type NotificationRow = {
  id:         string
  fund_id:    string | null
  type:       string
  title:      string
  body:       string
  data:       Record<string, any> | null
  is_read:    boolean
  response_action: string | null
  created_at: string
}

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  join_request:       'person-add-outline',
  join_approved:      'checkmark-circle-outline',
  join_declined:      'close-circle-outline',
  member_joined:      'people-outline',
  member_removed:     'exit-outline',
  contribution_added: 'cash-outline',
  expense_added:      'receipt-outline',
  sms_detected:       'chatbubble-ellipses-outline',
  rich_auntie_tagged: 'ribbon-outline',
  event_announcement: 'megaphone-outline',
  reward_earned:       'trophy-outline',
  trust_level_changed: 'shield-checkmark-outline',
  tokens_purchased:    'wallet-outline',
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-BW', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NotificationsScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const styles = makeStyles(colors)

  const [items, setItems]         = useState<NotificationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true

      async function load() {
        if (!userId) return
        setIsLoading(true)
        setLoadError(null)

        const { data, error } = await supabase
          .from('notifications')
          .select('id, fund_id, type, title, body, data, is_read, response_action, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100)

        if (!active) return

        if (error) {
          setLoadError(error.message)
        } else {
          setItems(data ?? [])
        }
        setIsLoading(false)
      }

      load()
      return () => { active = false }
    }, [userId])
  )

  const unreadCount = items.filter(i => !i.is_read).length

  async function markRead(ids: string[]) {
    if (ids.length === 0) return
    const now = new Date().toISOString()
    setItems(prev => prev.map(i => (ids.includes(i.id) ? { ...i, is_read: true } : i)))
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: now })
      .in('id', ids)
  }

  function handleMarkAllRead() {
    markRead(items.filter(i => !i.is_read).map(i => i.id))
  }

  function handlePress(item: NotificationRow) {
    if (!item.is_read) markRead([item.id])

    if (item.data?.kind === 'reward_earned' || item.data?.kind === 'trust_level_changed') {
      navigation.navigate('Rewards')
      return
    }

    if (item.data?.kind === 'tokens_purchased') {
      navigation.navigate('TokenPurchase')
      return
    }

    if (item.data?.kind === 'event_announcement' && typeof item.data.eventId === 'string') {
      navigation.navigate('EventDetail', { eventId: item.data.eventId, tab: 'announcements' })
      return
    }

    if (item.data?.kind === 'rich_auntie_award' && typeof item.data.awardId === 'string') {
      navigation.navigate('RichAuntieCelebration', {
        awardId: item.data.awardId,
        recipientView: true,
      })
      return
    }

    const detected = item.data?.detectedSms
    if (detected && typeof detected.amount === 'number' && typeof detected.receivedAt === 'string') {
      if (item.response_action === 'recorded') {
        const recordedFundId = item.fund_id ?? item.data?.recordedFundId
        if (typeof recordedFundId === 'string') {
          navigation.navigate('FundDetail', { fundId: recordedFundId })
        } else {
          Alert.alert('Contribution recorded', 'This payment has already been recorded.')
        }
        return
      }
      navigation.navigate('AssignContribution', { detected, notificationId: item.id })
      return
    }

    const fundId = item.fund_id ?? item.data?.fundId
    if (fundId) navigation.navigate('FundDetail', { fundId })
  }

  async function respondToOrganiserInvite(item: NotificationRow, accept: boolean) {
    const inviteId = item.data?.organiserInviteId
    if (typeof inviteId !== 'string' || respondingTo) return
    setRespondingTo(item.id)
    const { data, error } = await supabase
      .rpc('respond_to_event_fund_organiser_invite', { p_invite_id: inviteId, p_accept: accept })
      .single()
    setRespondingTo(null)

    if (error || !data) {
      Alert.alert('Could not respond', error?.message ?? 'The invitation is no longer available.')
      return
    }

    const response = data as { fund_id: string }
    setItems(previous => previous.map(notification => notification.id === item.id
      ? { ...notification, is_read: true, response_action: accept ? 'accepted' : 'declined' }
      : notification
    ))

    if (accept) {
      Alert.alert('Invitation accepted', 'You can now manage both the event and its fund.', [
        { text: 'Open fund', onPress: () => navigation.navigate('FundDetail', { fundId: response.fund_id }) },
        { text: 'OK' },
      ])
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.75} style={styles.readAllBtn}>
            <Text style={styles.readAllText}>Read all</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : loadError ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            Event announcements, join requests, contributions, and expenses will show up here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {items.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.row, !item.is_read && styles.rowUnread]}
              onPress={() => handlePress(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, !item.is_read && styles.iconWrapUnread]}>
                <Ionicons
                  name={TYPE_ICONS[item.type] ?? 'notifications-outline'}
                  size={19}
                  color={item.is_read ? colors.textMuted : colors.primary}
                />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowTitle, !item.is_read && styles.rowTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
                </View>
                <Text style={styles.rowText} numberOfLines={2}>{item.body}</Text>
                {item.type === 'sms_detected' && item.response_action === 'recorded' && (
                  <View style={styles.recordedStatus}>
                    <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                    <Text style={styles.recordedStatusText}>Contribution recorded</Text>
                  </View>
                )}
                {item.data?.kind === 'event_fund_organiser_invite' && (
                  item.response_action ? (
                    <Text style={styles.responseStatus}>Invitation {item.response_action}</Text>
                  ) : (
                    <View style={styles.inviteActions}>
                      <TouchableOpacity
                        style={[styles.inviteButton, styles.declineButton]}
                        onPress={() => respondToOrganiserInvite(item, false)}
                        disabled={respondingTo === item.id}
                      >
                        <Text style={styles.declineText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.inviteButton, styles.acceptButton]}
                        onPress={() => respondToOrganiserInvite(item, true)}
                        disabled={respondingTo === item.id}
                      >
                        <Text style={styles.acceptText}>{respondingTo === item.id ? 'Saving…' : 'Accept'}</Text>
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </View>
              {!item.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 14,
      gap: 12,
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
    headerTitle: {
      flex: 1,
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    readAllBtn: {
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    readAllText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    headerSpacer: {
      width: 38,
    },
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 36,
      paddingBottom: 48,
    },
    errorText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    emptyEmoji: {
      fontSize: 40,
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      textAlign: 'center',
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 48,
    },
    row: {
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
    rowUnread: {
      borderColor: colors.primary,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconWrapUnread: {
      backgroundColor: colors.primaryLight,
    },
    rowBody: {
      flex: 1,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 3,
    },
    rowTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    rowTitleUnread: {
      fontWeight: '800',
    },
    rowTime: {
      fontSize: 11,
      color: colors.textMuted,
    },
    rowText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    inviteActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 12,
    },
    inviteButton: {
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderWidth: 1,
    },
    declineButton: {
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    acceptButton: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    declineText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
    acceptText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
    responseStatus: {
      marginTop: 9,
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary,
      textTransform: 'capitalize',
    },
    recordedStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 9,
    },
    recordedStatusText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.success,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 6,
    },
  })
}
