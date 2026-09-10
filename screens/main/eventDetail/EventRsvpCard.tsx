import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { EventGuest } from '@shared/contracts'
import { isEventRsvpClosed, rsvpDeadlineDetails } from '@shared/event-schedule'
import { api } from '../../../lib/api'
import { runApiRead, toApiUiError } from '../../../lib/apiScreen'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import type { NativeSchedule } from './EventScheduleCard'
import {
  allowedPlusOnes,
  invitationAllowanceTitle,
  resizePlusOneNames,
  rsvpParty,
  type RsvpChoice,
} from './rsvp'

type Props = {
  eventId: string
  schedule: NativeSchedule
  onSaved: (guest: EventGuest) => void
}

function scheduleEvent(schedule: NativeSchedule) {
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

export default function EventRsvpCard({ eventId, schedule, onSaved }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [guest, setGuest] = useState<EventGuest | null>(null)
  const [status, setStatus] = useState<RsvpChoice | null>(null)
  const [plusOnes, setPlusOnes] = useState(0)
  const [names, setNames] = useState<string[]>([])
  const [dietary, setDietary] = useState('')
  const [accessibility, setAccessibility] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void runApiRead(call => api.events.myRsvp(eventId, call), { signal: controller.signal })
      .then(value => {
        if (controller.signal.aborted || !value) return
        setGuest(value)
        setStatus(value.rsvp_status === 'pending' ? null : value.rsvp_status)
        setPlusOnes(value.plus_ones)
        setNames(resizePlusOneNames(value.plus_ones_names, value.plus_ones))
        setDietary(value.dietary_requirements ?? '')
        setAccessibility(value.accessibility_needs ?? '')
        setNote(value.rsvp_note ?? '')
      })
      .catch(cause => { if (!controller.signal.aborted) setError(toApiUiError(cause, controller.signal).message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [eventId])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const source = scheduleEvent(schedule)
  const deadline = rsvpDeadlineDetails(source, now)
  const closed = schedule.status !== 'active' || isEventRsvpClosed(source, now)
  const allowance = allowedPlusOnes(guest?.allowed_plus_ones)

  function changePlusOnes(next: number) {
    const bounded = Math.max(0, Math.min(allowance, next))
    setPlusOnes(bounded)
    setNames(current => resizePlusOneNames(current, bounded))
  }

  function selectStatus(next: RsvpChoice) {
    setStatus(next)
    if (next === 'no') changePlusOnes(0)
  }

  async function save() {
    if (!guest || !status || closed || saving) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await api.events.respondRsvp(eventId, {
        status,
        ...rsvpParty(status, Math.min(plusOnes, allowance), names),
        dietary_requirements: dietary.trim() || null,
        accessibility_needs: accessibility.trim() || null,
        rsvp_note: note.trim() || null,
      })
      setGuest(updated)
      setStatus(updated.rsvp_status === 'pending' ? null : updated.rsvp_status)
      setPlusOnes(updated.plus_ones)
      setNames(resizePlusOneNames(updated.plus_ones_names, updated.plus_ones))
      setNotice('Your RSVP has been saved.')
      onSaved(updated)
    } catch (cause) {
      setError(toApiUiError(cause).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.help}>Loading your invitation…</Text></View>
  if (!guest) return (
    <View style={styles.card}>
      <Text style={styles.title}>Your RSVP</Text>
      <Text style={styles.help}>{error || 'Your personal guest invitation could not be found. Open the original invite or ask the organiser to invite your current phone number.'}</Text>
    </View>
  )

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>YOUR RSVP</Text>
          <Text style={styles.title}>Will you attend?</Text>
          <Text style={styles.help}>{schedule.rsvpDeadline ? `Respond by ${deadline.date} · ${deadline.countdown}` : 'Let the organiser know your plans.'}</Text>
        </View>
        <Ionicons name="people-circle-outline" size={30} color={colors.primary} />
      </View>

      <View style={styles.allowance}>
        <Ionicons name="people-outline" size={19} color={colors.primary} />
        <View style={styles.allowanceCopy}>
          <Text style={styles.allowanceTitle}>{invitationAllowanceTitle(allowance)}</Text>
          <Text style={styles.allowanceText}>{allowance > 0 ? `You can add no more than ${allowance} guest${allowance === 1 ? '' : 's'} to this RSVP.` : 'No additional guests are included with this invitation.'}</Text>
        </View>
      </View>

      <View style={styles.choices}>
        {([
          ['yes', 'checkmark', 'Yes'],
          ['maybe', 'help', 'Maybe'],
          ['no', 'close', 'No'],
        ] as const).map(([value, icon, label]) => (
          <TouchableOpacity
            key={value}
            style={[styles.choice, status === value && styles.choiceSelected]}
            onPress={() => selectStatus(value)}
            disabled={closed || saving}
            accessibilityRole="radio"
            accessibilityState={{ checked: status === value, disabled: closed || saving }}
            accessibilityLabel={`${label} RSVP`}
          >
            <Ionicons name={icon} size={17} color={status === value ? '#FFFFFF' : colors.textSecondary} />
            <Text style={[styles.choiceText, status === value && styles.choiceTextSelected]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {status && status !== 'no' && allowance > 0 ? (
        <View style={styles.plusOnes}>
          <View style={styles.counterRow}>
            <View style={styles.counterCopy}>
              <Text style={styles.fieldLabel}>GUESTS JOINING YOU</Text>
              <Text style={styles.help}>{plusOnes} of {allowance} additional guests</Text>
            </View>
            <TouchableOpacity style={styles.counterButton} onPress={() => changePlusOnes(plusOnes - 1)} disabled={plusOnes === 0 || saving} accessibilityLabel="Remove one additional guest"><Ionicons name="remove" size={19} color={colors.textPrimary} /></TouchableOpacity>
            <Text style={styles.counterValue}>{plusOnes}</Text>
            <TouchableOpacity style={styles.counterButton} onPress={() => changePlusOnes(plusOnes + 1)} disabled={plusOnes >= allowance || saving} accessibilityLabel="Add one additional guest"><Ionicons name="add" size={19} color={colors.textPrimary} /></TouchableOpacity>
          </View>
          {names.map((name, index) => (
            <TextInput
              key={index}
              value={name}
              onChangeText={value => setNames(current => current.map((item, itemIndex) => itemIndex === index ? value : item))}
              editable={!closed && !saving}
              maxLength={100}
              placeholder={`Guest ${index + 1} name (optional)`}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              accessibilityLabel={`Additional guest ${index + 1} name`}
            />
          ))}
        </View>
      ) : null}

      <Text style={styles.fieldLabel}>DIETARY REQUIREMENTS · OPTIONAL</Text>
      <TextInput value={dietary} onChangeText={setDietary} editable={!closed && !saving} maxLength={1000} multiline placeholder="Food allergies or dietary needs" placeholderTextColor={colors.textMuted} style={[styles.input, styles.textarea]} />
      <Text style={styles.fieldLabel}>ACCESSIBILITY NEEDS · OPTIONAL</Text>
      <TextInput value={accessibility} onChangeText={setAccessibility} editable={!closed && !saving} maxLength={1000} multiline placeholder="Anything the organiser should arrange" placeholderTextColor={colors.textMuted} style={[styles.input, styles.textarea]} />
      <Text style={styles.fieldLabel}>NOTE TO ORGANISER · OPTIONAL</Text>
      <TextInput value={note} onChangeText={setNote} editable={!closed && !saving} maxLength={2000} multiline placeholder="Add a private RSVP note" placeholderTextColor={colors.textMuted} style={[styles.input, styles.textarea]} />

      {notice ? <Text style={styles.notice} accessibilityRole="alert">{notice}</Text> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {closed ? <Text style={styles.closed}>{isEventRsvpClosed(source, now) ? `Responses closed after ${deadline.date}.` : `This event is ${schedule.status}, so RSVP responses are closed.`}</Text> : null}
      <TouchableOpacity style={[styles.saveButton, (!status || closed || saving) && styles.disabled]} onPress={() => { void save() }} disabled={!status || closed || saving} accessibilityLabel="Save RSVP">
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" />}
        <Text style={styles.saveText}>{saving ? 'Saving RSVP…' : 'Save RSVP'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  loading: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: fonts.inter.black, fontSize: 8, letterSpacing: 0.6, color: colors.primary },
  title: { marginTop: 2, fontFamily: fonts.inter.extraBold, fontSize: 17, color: colors.textPrimary },
  help: { marginTop: 3, fontFamily: fonts.inter.regular, fontSize: 11, lineHeight: 16, color: colors.textSecondary },
  allowance: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 13, backgroundColor: colors.primaryLight },
  allowanceCopy: { flex: 1 },
  allowanceTitle: { fontFamily: fonts.inter.bold, fontSize: 12, color: colors.textPrimary },
  allowanceText: { marginTop: 2, fontFamily: fonts.inter.regular, fontSize: 10, lineHeight: 15, color: colors.textSecondary },
  choices: { flexDirection: 'row', gap: 7 },
  choice: { flex: 1, minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  choiceText: { fontFamily: fonts.inter.bold, fontSize: 11, color: colors.textSecondary },
  choiceTextSelected: { color: '#FFFFFF' },
  plusOnes: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.background },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterCopy: { flex: 1 },
  counterButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  counterValue: { minWidth: 22, textAlign: 'center', fontFamily: fonts.inter.extraBold, fontSize: 15, color: colors.textPrimary },
  fieldLabel: { marginTop: 2, fontFamily: fonts.inter.black, fontSize: 8, letterSpacing: 0.45, color: colors.textSecondary },
  input: { minHeight: 45, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fonts.inter.regular, fontSize: 12, color: colors.textPrimary },
  textarea: { minHeight: 66, paddingTop: 11, textAlignVertical: 'top' },
  notice: { fontFamily: fonts.inter.semiBold, fontSize: 11, color: '#047857' },
  error: { fontFamily: fonts.inter.regular, fontSize: 11, lineHeight: 16, color: colors.error },
  closed: { padding: 10, borderRadius: 10, backgroundColor: colors.background, fontFamily: fonts.inter.regular, fontSize: 11, lineHeight: 16, color: colors.textSecondary },
  saveButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, backgroundColor: colors.primary },
  saveText: { fontFamily: fonts.inter.bold, fontSize: 13, color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
})
