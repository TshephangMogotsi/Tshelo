import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { EventStatus } from '@shared/contracts'
import {
  EVENT_TIME_ZONE_SUGGESTIONS,
  eventCountdownLabel,
  eventDurationLabel,
  eventTimeZoneLabel,
  eventLocalDateTime,
  isRecognisedTimeZone,
  resolvedEventTimeZone,
  rsvpDeadlineDetails,
  type ScheduleEvent,
} from '@shared/event-schedule'
import { api } from '../../../lib/api'
import { toApiUiError } from '../../../lib/apiScreen'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'

export type NativeSchedule = {
  eventDate: string
  eventTime: string | null
  eventEndDate: string | null
  eventEndTime: string | null
  timeZone?: string
  rsvpDeadline?: string | null
  status: EventStatus
}

type Props = {
  eventId: string
  schedule: NativeSchedule
  canManage: boolean
  onUpdated: (metadata: {
    eventDate: string
    eventTime: string | null
    eventEndDate: string | null
    eventEndTime: string | null
    timeZone?: string
    rsvpDeadline?: string | null
  }) => void
}

function scheduleEvent(schedule: NativeSchedule): ScheduleEvent {
  return {
    event_date: schedule.eventDate,
    event_time: schedule.eventTime,
    event_end_date: schedule.eventEndDate,
    event_end_time: schedule.eventEndTime,
    time_zone: schedule.timeZone,
    rsvp_deadline: schedule.rsvpDeadline,
    status: schedule.status,
  }
}

function displayTime(value: string | null) {
  if (!value) return 'To be confirmed'
  const [hourValue, minuteValue] = value.split(':').map(Number)
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) return value
  const suffix = hourValue >= 12 ? 'PM' : 'AM'
  return `${hourValue % 12 || 12}:${String(minuteValue).padStart(2, '0')} ${suffix}`
}

function timeRange(schedule: NativeSchedule) {
  const start = displayTime(schedule.eventTime)
  if (!schedule.eventEndTime) return start
  return `${start} – ${displayTime(schedule.eventEndTime)}`
}

function validDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
  return date.toISOString().slice(0, 10) === value
}

export default function EventScheduleCard({ eventId, schedule, canManage, onUpdated }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [now, setNow] = useState(() => new Date())
  const [showEditor, setShowEditor] = useState(false)
  const [eventDate, setEventDate] = useState(schedule.eventDate)
  const [eventTime, setEventTime] = useState(schedule.eventTime?.slice(0, 5) ?? '')
  const [eventEndDate, setEventEndDate] = useState(schedule.eventEndDate ?? '')
  const [eventEndTime, setEventEndTime] = useState(schedule.eventEndTime?.slice(0, 5) ?? '')
  const [timeZone, setTimeZone] = useState(resolvedEventTimeZone(scheduleEvent(schedule)))
  const [deadline, setDeadline] = useState(schedule.rsvpDeadline ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const source = scheduleEvent(schedule)
  const deadlineDetails = rsvpDeadlineDetails(source, now)
  const displayedTime = timeRange(schedule)
  const displayedDuration = eventDurationLabel(source)
  const displayedTimeZone = eventTimeZoneLabel(source)
  const metadataSupported = schedule.timeZone !== undefined

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    const start = () => {
      setNow(new Date())
      if (!interval) interval = setInterval(() => setNow(new Date()), 60_000)
    }
    const stop = () => {
      if (interval) clearInterval(interval)
      interval = null
    }
    if (AppState.currentState === 'active') start()
    const subscription = AppState.addEventListener('change', state => state === 'active' ? start() : stop())
    return () => { stop(); subscription.remove() }
  }, [])

  function openEditor() {
    setEventDate(schedule.eventDate)
    setEventTime(schedule.eventTime?.slice(0, 5) ?? '')
    setEventEndDate(schedule.eventEndDate ?? '')
    setEventEndTime(schedule.eventEndTime?.slice(0, 5) ?? '')
    setTimeZone(resolvedEventTimeZone(source))
    setDeadline(schedule.rsvpDeadline ?? '')
    setError(null)
    setShowEditor(true)
  }

  async function save() {
    const cleanEventDate = eventDate.trim()
    const cleanEventTime = eventTime.trim()
    const cleanEndDate = eventEndDate.trim()
    const cleanEndTime = eventEndTime.trim()
    const cleanZone = timeZone.trim()
    const cleanDeadline = deadline.trim()
    const validTime = (value: string) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    if (!validDate(cleanEventDate)) {
      setError('Enter the event date as YYYY-MM-DD.')
      return
    }
    if (cleanEndDate && !validDate(cleanEndDate)) {
      setError('Enter the end date as YYYY-MM-DD, or leave it empty.')
      return
    }
    if (!validTime(cleanEventTime) || !validTime(cleanEndTime)) {
      setError('Enter times using 24-hour HH:MM format.')
      return
    }
    if (cleanEndTime && !cleanEventTime) {
      setError('Set a start time before adding an end time.')
      return
    }
    if (!isRecognisedTimeZone(cleanZone)) {
      setError('Enter a recognised IANA time zone, such as Africa/Gaborone.')
      return
    }
    if (cleanDeadline && !validDate(cleanDeadline)) {
      setError('Enter the RSVP deadline as YYYY-MM-DD.')
      return
    }
    if (cleanDeadline && cleanDeadline > cleanEventDate) {
      setError('The RSVP deadline cannot be after the event date.')
      return
    }
    if (cleanEventTime && cleanEndTime) {
      const start = eventLocalDateTime(cleanEventDate, `${cleanEventTime}:00`, cleanZone)
      const end = eventLocalDateTime(cleanEndDate || cleanEventDate, `${cleanEndTime}:00`, cleanZone)
      if (!start || !end || end < start) {
        setError('The event end must be at or after its start.')
        return
      }
    } else if (cleanEndDate && cleanEndDate < cleanEventDate) {
      setError('The event end date cannot be before its start date.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await api.events.update(eventId, {
        event_date: cleanEventDate,
        event_time: cleanEventTime ? `${cleanEventTime}:00` : null,
        event_end_date: cleanEndDate || null,
        event_end_time: cleanEndTime ? `${cleanEndTime}:00` : null,
        time_zone: cleanZone,
        rsvp_deadline: cleanDeadline || null,
      })
      onUpdated({
        eventDate: updated.event_date,
        eventTime: updated.event_time,
        eventEndDate: updated.event_end_date,
        eventEndTime: updated.event_end_time,
        timeZone: updated.time_zone,
        rsvpDeadline: updated.rsvp_deadline,
      })
      setShowEditor(false)
    } catch (cause) {
      setError(toApiUiError(cause).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>EVENT SCHEDULE</Text>
            <Text style={styles.countdown}>{eventCountdownLabel(source, now)}</Text>
          </View>
          {canManage && schedule.status === 'active' && metadataSupported ? (
            <TouchableOpacity style={styles.editButton} onPress={openEditor} accessibilityLabel="Edit event schedule settings">
              <Ionicons name="create-outline" size={15} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.metrics}>
          <View style={styles.metric} accessible accessibilityLabel={`Time, ${displayedTime}`}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={styles.metricLabel}>Time</Text>
            <Text style={styles.metricValue} numberOfLines={2}>{displayedTime}</Text>
          </View>
          <View style={styles.metric} accessible accessibilityLabel={`Duration, ${displayedDuration}`}>
            <Ionicons name="hourglass-outline" size={16} color={colors.primary} />
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue} numberOfLines={2}>{displayedDuration}</Text>
          </View>
          <View
            style={[styles.metric, styles.metricWide]}
            accessible
            accessibilityLabel={`RSVP deadline, ${deadlineDetails.date}. ${deadlineDetails.countdown}`}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.metricLabel}>RSVP deadline</Text>
            <Text style={styles.metricValue}>{deadlineDetails.date}</Text>
            <Text style={styles.metricDetail}>{deadlineDetails.countdown}</Text>
          </View>
        </View>
        <View style={styles.zoneRow}>
          <Ionicons name="globe-outline" size={14} color={colors.textMuted} />
          <Text style={styles.zone} numberOfLines={2}>{displayedTimeZone}</Text>
        </View>
      </View>

      <Modal visible={showEditor} transparent animationType="slide" onRequestClose={() => setShowEditor(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.dismiss} onPress={() => setShowEditor(false)} />
          <View style={styles.editor}>
            <View style={styles.editorHeader}>
              <View style={styles.editorHeading}>
                <Text style={styles.editorTitle}>Schedule settings</Text>
                <Text style={styles.editorSubtitle}>The saved time zone controls countdowns, RSVP closure, and calendar times on every device.</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowEditor(false)} accessibilityLabel="Close schedule settings">
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>EVENT DATE</Text>
                  <TextInput value={eventDate} onChangeText={setEventDate} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Event date" />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>START TIME</Text>
                  <TextInput value={eventTime} onChangeText={setEventTime} keyboardType="numbers-and-punctuation" placeholder="HH:MM (optional)" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Event start time" />
                </View>
              </View>
              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>END DATE</Text>
                  <TextInput value={eventEndDate} onChangeText={setEventEndDate} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Event end date" />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>END TIME</Text>
                  <TextInput value={eventEndTime} onChangeText={setEventEndTime} keyboardType="numbers-and-punctuation" placeholder="HH:MM (optional)" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Event end time" />
                </View>
              </View>
              <Text style={styles.label}>EVENT TIME ZONE</Text>
              <TextInput
                value={timeZone}
                onChangeText={setTimeZone}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Africa/Gaborone"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                accessibilityLabel="Event time zone"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneChoices}>
                {EVENT_TIME_ZONE_SUGGESTIONS.map(zone => (
                  <TouchableOpacity key={zone} style={[styles.zoneChoice, timeZone === zone && styles.zoneChoiceActive]} onPress={() => setTimeZone(zone)}>
                    <Text style={[styles.zoneChoiceText, timeZone === zone && styles.zoneChoiceTextActive]}>{zone}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.label}>RSVP DEADLINE</Text>
              <TextInput
                value={deadline}
                onChangeText={setDeadline}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                placeholder="YYYY-MM-DD (optional)"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                accessibilityLabel="RSVP deadline"
              />
              <Text style={styles.help}>Guests can respond through the end of this date in the event time zone.</Text>
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} onPress={() => { void save() }} disabled={saving} accessibilityLabel="Save schedule settings">
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save settings'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: { marginBottom: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#DED8E8', backgroundColor: '#F8F6FC' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: fonts.inter.black, fontSize: 9, letterSpacing: 0.65, color: colors.primary },
  countdown: { marginTop: 3, fontFamily: fonts.inter.extraBold, fontSize: 16, color: colors.textPrimary },
  editButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFFFFF' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { minHeight: 72, flexGrow: 1, flexBasis: '46%', minWidth: 120, padding: 11, borderRadius: 12, backgroundColor: '#FFFFFF' },
  metricWide: { flexBasis: '100%' },
  metricLabel: { marginTop: 5, fontFamily: fonts.inter.regular, fontSize: 9, color: colors.textMuted },
  metricValue: { marginTop: 2, fontFamily: fonts.inter.bold, fontSize: 11, lineHeight: 15, color: colors.textPrimary },
  metricDetail: { marginTop: 2, fontFamily: fonts.inter.semiBold, fontSize: 9, color: colors.primary },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#E8E3EF' },
  zone: { flex: 1, fontFamily: fonts.inter.regular, fontSize: 9, lineHeight: 13, color: colors.textSecondary },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(13,13,13,0.46)' },
  dismiss: { flex: 1 },
  editor: { maxHeight: '90%', padding: 20, paddingBottom: 20, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.surface },
  editorHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  editorHeading: { flex: 1 },
  editorTitle: { fontFamily: fonts.inter.extraBold, fontSize: 19, color: colors.textPrimary },
  editorSubtitle: { marginTop: 4, fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.background },
  editorScroll: { flexShrink: 1 },
  editorContent: { paddingBottom: 12 },
  fieldRow: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  fieldHalf: { flex: 1, minWidth: 0 },
  label: { marginBottom: 7, fontFamily: fonts.inter.black, fontSize: 9, letterSpacing: 0.55, color: colors.textSecondary },
  input: { minHeight: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.inter.regular, fontSize: 14, color: colors.textPrimary },
  zoneChoices: { gap: 7, paddingVertical: 10, paddingBottom: 18 },
  zoneChoice: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  zoneChoiceActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  zoneChoiceText: { fontFamily: fonts.inter.semiBold, fontSize: 10, color: colors.textSecondary },
  zoneChoiceTextActive: { color: colors.primary },
  help: { marginTop: 7, fontFamily: fonts.inter.regular, fontSize: 11, lineHeight: 16, color: colors.textMuted },
  error: { marginTop: 10, fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 18, color: colors.error },
  saveButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18, borderRadius: 14, backgroundColor: colors.primary },
  saveText: { fontFamily: fonts.inter.bold, fontSize: 14, color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
})
