import { useCallback, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { loadMyFundPermissions } from '../../lib/useFundPermissions'
import type { FundPermission } from '../../lib/fundPermissions'
import LoadingOverlay from '../../components/LoadingOverlay'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'GuestList'>
  route: RouteProp<MainStackParamList, 'GuestList'>
}

type GuestStatus = 'yes' | 'pending' | 'no'
type Filter = 'all' | 'yes' | 'pending' | 'no'

type Guest = {
  id: string
  name: string
  initials: string
  status: GuestStatus
  partySize: number
  note: string
  color: string
}

export default function GuestListScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const styles = makeStyles(colors)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [guests, setGuests] = useState<Guest[]>([])
  const [canManageGuests, setCanManageGuests] = useState<boolean | null>(null)
  const permissionAlerted = useRef(false)

  useFocusEffect(useCallback(() => {
    let active = true
    permissionAlerted.current = false
    setCanManageGuests(null)

    async function load() {
      const [eventResult, organiserResult] = await Promise.all([
        supabase
          .from('events')
          .select('creator_id, linked_fund_id')
          .eq('id', route.params.eventId)
          .single(),
        userId
          ? supabase
            .from('event_organisers')
            .select('id')
            .eq('event_id', route.params.eventId)
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (!active) return
      if (eventResult.error || !eventResult.data) {
        setCanManageGuests(false)
        Alert.alert(
          'Guest list unavailable',
          eventResult.error?.message ?? 'This event could not be loaded.',
          [{ text: 'Go back', onPress: () => navigation.goBack() }],
        )
        return
      }

      const permissions = eventResult.data?.linked_fund_id
        ? await loadMyFundPermissions(eventResult.data.linked_fund_id)
          .catch(() => new Set<FundPermission>())
        : new Set<FundPermission>()
      if (!active) return

      const allowed = Boolean(
        eventResult.data
        && (eventResult.data.creator_id === userId
          || organiserResult.data
          || permissions.has('manage_event_guests')),
      )
      setCanManageGuests(allowed)
      if (!allowed) {
        if (!permissionAlerted.current) {
          permissionAlerted.current = true
          Alert.alert(
            'Guest access required',
            'You do not have permission to manage this event guest list.',
            [{ text: 'Go back', onPress: () => navigation.goBack() }],
          )
        }
        return
      }

      const { data } = await supabase
        .from('event_guests')
        .select('id, guest_name, guest_phone, rsvp_status, plus_ones')
        .eq('event_id', route.params.eventId)
        .order('invited_at', { ascending: false })
      if (!active) return

      setGuests((data ?? []).map(row => {
        const name: string = String(row.guest_name?.trim() || row.guest_phone?.trim() || 'Guest')
        const status: GuestStatus = row.rsvp_status === 'yes' || row.rsvp_status === 'confirmed'
          ? 'yes'
          : row.rsvp_status === 'no' || row.rsvp_status === 'declined'
            ? 'no'
            : 'pending'
        const plusOnes = Math.max(0, Number(row.plus_ones ?? 0))
        return {
          id: row.id,
          name,
          initials: name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
          status,
          partySize: 1 + plusOnes,
          note: status === 'yes' ? (plusOnes ? `+${plusOnes} guest${plusOnes === 1 ? '' : 's'}` : 'Confirmed') : status === 'no' ? "Can't make it" : "Hasn't responded",
          color: status === 'yes' ? '#16A34A' : status === 'no' ? '#EF4444' : '#F59E0B',
        }
      }))
    }

    void load()
    return () => { active = false }
  }, [navigation, route.params.eventId, userId]))

  const visibleGuests = guests.filter(guest => {
    const matchesFilter = filter === 'all' || guest.status === filter
    const matchesSearch = guest.name.toLowerCase().includes(search.trim().toLowerCase())
    return matchesFilter && matchesSearch
  })

  const counts = {
    confirmed: guests.filter(guest => guest.status === 'yes').reduce((sum, guest) => sum + guest.partySize, 0),
    pending: guests.filter(guest => guest.status === 'pending').length,
    declined: guests.filter(guest => guest.status === 'no').length,
  }
  const invitedPeople = guests.reduce((sum, guest) => sum + guest.partySize, 0)

  function statusLabel(status: GuestStatus) {
    if (status === 'yes') return 'Yes'
    if (status === 'no') return 'No'
    return '...'
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Guests</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.introRow}>
          <View><Text style={styles.pageTitle}>Guest list</Text><Text style={styles.pageSubtitle}>{invitedPeople} people invited</Text></View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={styles.statValue}>{counts.confirmed}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={16} color="#D97706" />
            <Text style={styles.statValue}>{counts.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="close-circle" size={16} color="#DC2626" />
            <Text style={styles.statValue}>{counts.declined}</Text>
            <Text style={styles.statLabel}>Declined</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search guests" placeholderTextColor={colors.textMuted} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={17} color={colors.textMuted} /></TouchableOpacity> : null}
        </View>

        <View style={styles.filterRow}>
          {[
            { id: 'all' as const, label: 'All' },
            { id: 'yes' as const, label: 'Yes' },
            { id: 'pending' as const, label: 'Pending' },
            { id: 'no' as const, label: 'Declined' },
          ].map(item => {
            const active = filter === item.id
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(item.id)}
                activeOpacity={0.82}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.guestList}>
          {visibleGuests.length === 0 && (
            <View style={styles.emptyState}><Ionicons name="people-outline" size={28} color={colors.textMuted} /><Text style={styles.emptyText}>{guests.length ? 'No guests match this view.' : 'No guests have been invited yet.'}</Text></View>
          )}
          {visibleGuests.map(guest => (
            <View key={guest.id} style={styles.guestCard}>
              <View style={[styles.avatar, { backgroundColor: guest.color }]}>
                <Text style={styles.avatarText}>{guest.initials}</Text>
              </View>
              <View style={styles.guestBody}>
                <Text style={styles.guestName}>{guest.name}</Text>
                <Text style={[
                  styles.guestNote,
                  guest.status === 'yes' && { color: '#16A34A' },
                  guest.status === 'no' && { color: '#EF4444' },
                ]}>
                  {guest.note}
                </Text>
              </View>
              <View style={[
                styles.statusPill,
                guest.status === 'yes' && styles.yesPill,
                guest.status === 'pending' && styles.pendingPill,
                guest.status === 'no' && styles.noPill,
              ]}>
                <Text style={styles.statusPillText}>{statusLabel(guest.status)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      {canManageGuests === null ? <LoadingOverlay /> : null}
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 4,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    headerSpacer: { width: 36 },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 72,
    },
    introRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
    pageTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.textPrimary },
    pageSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 11,
      gap: 0,
      marginBottom: 12,
    },
    statCard: {
      flex: 1,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: 2,
    },
    statDotWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    statDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    statValue: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
    },
    searchBox: {
      minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 12, marginBottom: 10,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 10 },
    filterRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 3,
      marginBottom: 14,
    },
    filterChip: {
      flex: 1,
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
    },
    filterText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    filterTextActive: {
      color: '#FFFFFF',
    },
    guestList: {
      gap: 7,
    },
    guestCard: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 10,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    guestBody: {
      flex: 1,
    },
    guestName: {
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    guestNote: {
      fontSize: 11,
      lineHeight: 16,
      color: colors.textMuted,
    },
    statusPill: {
      minWidth: 52,
      minHeight: 26,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      paddingHorizontal: 8,
    },
    yesPill: { backgroundColor: '#16A34A' },
    pendingPill: { backgroundColor: '#F59E0B' },
    noPill: { backgroundColor: '#EF4444' },
    statusPillText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    emptyState: { alignItems: 'center', gap: 8, paddingVertical: 46 },
    emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  })
}
