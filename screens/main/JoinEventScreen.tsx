import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { useHardwareBack } from '../../lib/useHardwareBack'
import { hapticError, hapticSuccess } from '../../lib/haptics'
import { supabase } from '../../lib/supabase'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'JoinEvent'>
  route: RouteProp<MainStackParamList, 'JoinEvent'>
}

type Phase = 'input' | 'searching' | 'preview' | 'joining'

type EventPreview = {
  id: string
  name: string
  eventType: string
  emoji: string
  date: string
  time: string | null
  venue: string | null
  status: string
  organiserName: string
  hasLinkedFund: boolean
  alreadyJoined: boolean
}

function cleanEventCode(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function displayDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return 'Date to be confirmed'
  return new Date(year, month - 1, day).toLocaleDateString('en-BW', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function displayTime(value: string | null) {
  if (!value) return null
  const [hourValue, minuteValue] = value.split(':').map(Number)
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) return value
  const suffix = hourValue >= 12 ? 'PM' : 'AM'
  const hour = hourValue % 12 || 12
  return `${hour}:${String(minuteValue).padStart(2, '0')} ${suffix}`
}

export default function JoinEventScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const requireOnline = useRequireOnline()
  const styles = makeStyles(colors)
  const initialCode = cleanEventCode(route.params?.code ?? '')

  const [code, setCode] = useState(initialCode)
  const [phase, setPhase] = useState<Phase>('input')
  const [preview, setPreview] = useState<EventPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cleanedCode = cleanEventCode(code.trim())
  const isValid = cleanedCode.length >= 8
  const isBusy = phase === 'searching' || phase === 'joining'

  useHardwareBack(() => {
    if (phase === 'preview') {
      setPreview(null)
      setPhase('input')
      return true
    }
    return false
  })

  function changeCode(value: string) {
    setCode(cleanEventCode(value))
    setPreview(null)
    setError(null)
    setPhase('input')
  }

  async function findEvent() {
    if (!isValid || !userId || !requireOnline()) return
    setPhase('searching')
    setError(null)

    const { data: rows, error: rpcError } = await supabase.rpc('find_event_by_code', {
      p_code: cleanedCode,
    })
    const row = rows?.[0] ?? null

    if (rpcError || !row) {
      hapticError()
      setError('No event was found with that code. Check the code with the organiser and try again.')
      setPhase('input')
      return
    }

    if (row.status !== 'active') {
      hapticError()
      setError('This event is closed and is no longer accepting guests.')
      setPhase('input')
      return
    }

    setPreview({
      id: row.id,
      name: row.name,
      eventType: row.event_type,
      emoji: row.event_emoji || '🎉',
      date: row.event_date,
      time: row.event_time,
      venue: row.venue_name,
      status: row.status,
      organiserName: row.organiser_name || 'Event organiser',
      hasLinkedFund: Boolean(row.has_linked_fund),
      alreadyJoined: Boolean(row.already_joined),
    })
    setPhase('preview')
  }

  async function joinEvent() {
    if (!preview || !userId || !requireOnline()) return
    if (preview.alreadyJoined) {
      navigation.replace('EventDetail', { eventId: preview.id })
      return
    }

    setPhase('joining')
    setError(null)
    const { data: rows, error: rpcError } = await supabase.rpc('join_event_by_code', {
      p_code: cleanedCode,
    })
    const joined = rows?.[0] ?? null

    if (rpcError || !joined?.event_id) {
      hapticError()
      setError(rpcError?.message || 'Could not join this event. Please try again.')
      setPhase('preview')
      return
    }

    hapticSuccess()
    navigation.replace('EventDetail', { eventId: joined.event_id })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.heroIcon}>
            <Ionicons name="ticket-outline" size={34} color={colors.primary} />
          </View>
          <Text style={styles.title}>Join an Event</Text>
          <Text style={styles.subtitle}>Enter the RSVP code shared by the event organiser.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Event code</Text>
            <TextInput
              value={code}
              onChangeText={changeCode}
              editable={!isBusy}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={32}
              returnKeyType="search"
              onSubmitEditing={findEvent}
              placeholder="EVT-XXXXXXXX"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, isValid && styles.inputValid, isBusy && styles.inputDisabled]}
              accessibilityLabel="Event invite code"
            />
            <Text style={styles.hint}>Codes are not case-sensitive and may include “EVT-”.</Text>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={19} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {preview ? (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View style={styles.emojiWrap}><Text style={styles.emoji}>{preview.emoji}</Text></View>
                <View style={styles.previewHeading}>
                  <Text style={styles.eventName}>{preview.name}</Text>
                  <Text style={styles.eventType}>{titleCase(preview.eventType)}</Text>
                </View>
                {preview.alreadyJoined ? <Text style={styles.joinedBadge}>JOINED</Text> : null}
              </View>

              <View style={styles.divider} />
              <DetailRow icon="person-outline" text={`Hosted by ${preview.organiserName}`} colors={colors} styles={styles} />
              <DetailRow icon="calendar-outline" text={displayDate(preview.date)} colors={colors} styles={styles} />
              {displayTime(preview.time) ? <DetailRow icon="time-outline" text={displayTime(preview.time)!} colors={colors} styles={styles} /> : null}
              <DetailRow icon="location-outline" text={preview.venue?.trim() || 'Venue to be confirmed'} colors={colors} styles={styles} />

              {preview.hasLinkedFund ? (
                <View style={styles.notice}>
                  <Ionicons name="information-circle-outline" size={19} color={colors.primary} />
                  <Text style={styles.noticeText}>This event has a contribution fund. Joining here gives you event access only.</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {phase === 'preview' ? (
            <TouchableOpacity style={styles.primaryButton} onPress={joinEvent} activeOpacity={0.86}>
              <Text style={styles.primaryButtonText}>{preview?.alreadyJoined ? 'Open Event' : 'Join Event'}</Text>
              <Ionicons name={preview?.alreadyJoined ? 'arrow-forward' : 'checkmark'} size={19} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, (!isValid || isBusy) && styles.primaryButtonDisabled]}
              onPress={findEvent}
              disabled={!isValid || isBusy}
              activeOpacity={0.86}
            >
              {phase === 'searching' ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <Text style={styles.primaryButtonText}>Find Event</Text>
                  <Ionicons name="search" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}

          {phase === 'joining' ? (
            <View style={styles.joiningOverlay}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.joiningText}>Joining event…</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function DetailRow({ icon, text, colors, styles }: {
  icon: keyof typeof Ionicons.glyphMap
  text: string
  colors: AppColors
  styles: ReturnType<typeof makeStyles>
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 28,
    },
    heroIcon: {
      width: 68,
      height: 68,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      marginBottom: 18,
    },
    title: { fontSize: 30, fontFamily: fonts.display.bold, color: colors.heading, marginBottom: 8 },
    subtitle: { fontSize: 15, lineHeight: 22, color: colors.textSecondary, marginBottom: 30 },
    field: { marginBottom: 18 },
    label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' },
    input: {
      height: 58,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: 1.8,
      color: colors.textPrimary,
    },
    inputValid: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    inputDisabled: { opacity: 0.62 },
    hint: { marginTop: 7, fontSize: 12, color: colors.textMuted },
    errorCard: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, backgroundColor: colors.errorLight, marginBottom: 18 },
    errorText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.error },
    previewCard: { borderRadius: 20, padding: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
    previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
    emojiWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
    emoji: { fontSize: 27 },
    previewHeading: { flex: 1 },
    eventName: { fontSize: 18, fontWeight: '900', color: colors.textPrimary, marginBottom: 3 },
    eventType: { fontSize: 13, color: colors.textMuted },
    joinedBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, color: '#047857', backgroundColor: '#D1FAE5', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 10 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    detailText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 13, backgroundColor: colors.primaryLight, marginTop: 5 },
    noticeText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
    primaryButton: { height: 56, borderRadius: 17, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
    primaryButtonDisabled: { opacity: 0.42 },
    primaryButtonText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
    joiningOverlay: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, marginTop: 16 },
    joiningText: { fontSize: 13, color: colors.textMuted },
  })
}
