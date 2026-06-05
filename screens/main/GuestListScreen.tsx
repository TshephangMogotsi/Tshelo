import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'GuestList'>
  route: RouteProp<MainStackParamList, 'GuestList'>
}

type GuestStatus = 'yes' | 'pending' | 'no'
type Filter = 'all' | 'yes' | 'pending'

const GUESTS: {
  id: string
  name: string
  initials: string
  status: GuestStatus
  note: string
  color: string
}[] = [
  { id: '1', name: 'Mma Kgosi',      initials: 'MK', status: 'yes',     note: '+2 guests',       color: '#16A34A' },
  { id: '2', name: 'Thabo Molefe',   initials: 'TM', status: 'pending', note: "Hasn't responded", color: '#F59E0B' },
  { id: '3', name: 'Lorato Kgosana', initials: 'LK', status: 'no',      note: "Can't make it",    color: '#EF4444' },
  { id: '4', name: 'Kago Modise',    initials: 'KM', status: 'yes',     note: '+1 guest',         color: '#16A34A' },
  { id: '5', name: 'Mpho Kgosi',     initials: 'MP', status: 'pending', note: "Hasn't responded", color: '#F59E0B' },
]

export default function GuestListScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const [filter, setFilter] = useState<Filter>('all')

  const visibleGuests = GUESTS.filter(guest => {
    if (filter === 'all') return true
    return guest.status === filter
  })

  const counts = {
    confirmed: 47,
    pending: 12,
    declined: 3,
  }

  function statusLabel(status: GuestStatus) {
    if (status === 'yes') return 'Yes'
    if (status === 'no') return 'No'
    return '...'
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Guest List</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statDotWrap, { backgroundColor: '#D1FAE5' }]}>
              <View style={[styles.statDot, { backgroundColor: '#16A34A' }]} />
            </View>
            <Text style={styles.statValue}>{counts.confirmed}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statDotWrap, { backgroundColor: '#FEF3C7' }]}>
              <View style={[styles.statDot, { backgroundColor: '#F59E0B' }]} />
            </View>
            <Text style={styles.statValue}>{counts.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statDotWrap, { backgroundColor: '#FEE2E2' }]}>
              <View style={[styles.statDot, { backgroundColor: '#EF4444' }]} />
            </View>
            <Text style={styles.statValue}>{counts.declined}</Text>
            <Text style={styles.statLabel}>Declined</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {[
            { id: 'all' as const, label: 'All' },
            { id: 'yes' as const, label: 'Yes' },
            { id: 'pending' as const, label: 'Pending' },
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
      paddingVertical: 14,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 30,
      fontFamily: fonts.display.bold,
      fontWeight: '900',
      color: colors.heading,
      textAlign: 'center',
    },
    headerSpacer: { width: 40 },
    scroll: {
      paddingHorizontal: 24,
      paddingTop: 26,
      paddingBottom: 44,
    },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 10,
      gap: 8,
      marginBottom: 18,
    },
    statCard: {
      flex: 1,
      minHeight: 78,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.background,
      paddingVertical: 10,
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
      fontSize: 22,
      lineHeight: 27,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    filterRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 24,
      padding: 4,
      marginBottom: 18,
    },
    filterChip: {
      flex: 1,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
    },
    filterText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textMuted,
    },
    filterTextActive: {
      color: '#FFFFFF',
    },
    guestList: {
      gap: 10,
    },
    guestCard: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 17,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    guestBody: {
      flex: 1,
    },
    guestName: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    guestNote: {
      fontSize: 14,
      lineHeight: 19,
      color: colors.textMuted,
    },
    statusPill: {
      minWidth: 58,
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
      paddingHorizontal: 12,
    },
    yesPill: { backgroundColor: '#16A34A' },
    pendingPill: { backgroundColor: '#F59E0B' },
    noPill: { backgroundColor: '#EF4444' },
    statusPillText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
    },
  })
}
