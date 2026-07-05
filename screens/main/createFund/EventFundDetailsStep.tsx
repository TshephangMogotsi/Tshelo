import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import EventFundHero from './EventFundHero'
import DateTimeSheet from './DateTimeSheet'
import { formatDateDisplay, formatTimeDisplay } from './format'
import { BRAND_LAVENDER, BRAND_PURPLE, BRAND_PURPLE_DARK } from './constants'

type Props = {
  selectedEventLabel: string
  selectedEventEmoji: string
  eventName: string
  onEventNameChange: (text: string) => void
  fundName: string
  onFundNameChange: (text: string) => void
  eventDate: Date | null
  onEventDateChange: (date: Date) => void
  eventTime: Date | null
  onEventTimeChange: (date: Date) => void
  eventVenue: string
  onEventVenueChange: (text: string) => void
  onContinue: (derivedFundName: string) => void
  onBack: () => void
}

export default function EventFundDetailsStep({
  selectedEventLabel,
  selectedEventEmoji,
  eventName,
  onEventNameChange,
  fundName,
  onFundNameChange,
  eventDate,
  onEventDateChange,
  eventTime,
  onEventTimeChange,
  eventVenue,
  onEventVenueChange,
  onContinue,
  onBack,
}: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const isStepValid = eventName.trim().length >= 3 && eventDate !== null && eventTime !== null && eventVenue.trim().length >= 3
  const derivedFundName = fundName.trim() || `${eventName.trim() || `${selectedEventLabel} Event`} Fund`

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_PURPLE} />

      <EventFundHero stepsDone={2} onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.eventFundDetailsScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.eventFundDetailsIntro}>
            <Text style={styles.eventFundDetailsEmoji}>{selectedEventEmoji}</Text>
            <View style={styles.eventFundDetailsIntroText}>
              <Text style={styles.eventFundDetailsTitle}>Event details</Text>
              <Text style={styles.eventFundDetailsSubtitle}>Tell us about your {selectedEventLabel.toLowerCase()}</Text>
            </View>
          </View>

          <View style={styles.eventFundDetailsField}>
            <Text style={styles.eventFundDetailsLabel}>Event name</Text>
            <TextInput
              style={styles.eventFundDetailsNameInput}
              placeholder={`${selectedEventLabel} Event`}
              placeholderTextColor={colors.textMuted}
              value={eventName}
              onChangeText={text => {
                onEventNameChange(text)
                if (!fundName.trim()) onFundNameChange(text.trim() ? `${text.trim()} Fund` : '')
              }}
              maxLength={90}
              autoCapitalize="words"
              multiline
              textAlignVertical="center"
            />
          </View>

          <View style={styles.eventFundDateTimeRow}>
            <View style={styles.eventFundDateTimeField}>
              <Text style={styles.eventFundDetailsLabel}>Date</Text>
              <TouchableOpacity
                style={styles.eventFundDateTimeBox}
                activeOpacity={0.84}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={[styles.eventFundDateTimeText, !eventDate && { color: colors.textMuted }]}>
                  {eventDate ? formatDateDisplay(eventDate) : 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.eventFundDateTimeField}>
              <Text style={styles.eventFundDetailsLabel}>Time</Text>
              <TouchableOpacity
                style={styles.eventFundDateTimeBox}
                activeOpacity={0.84}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={[styles.eventFundDateTimeText, !eventTime && { color: colors.textMuted }]}>
                  {eventTime ? formatTimeDisplay(eventTime) : 'Select time'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.eventFundDetailsField}>
            <Text style={styles.eventFundDetailsLabel}>Venue</Text>
            <View style={styles.eventFundVenueBox}>
              <TextInput
                style={styles.eventFundVenueInput}
                placeholder="Cresta Lodge, Gaborone"
                placeholderTextColor={colors.textMuted}
                value={eventVenue}
                onChangeText={onEventVenueChange}
                multiline
                maxLength={120}
                textAlignVertical="center"
              />
            </View>
          </View>

          <View style={styles.eventFundNameCard}>
            <View style={styles.eventFundNameHeader}>
              <Text style={styles.eventFundNameLabel}>💜  Fund name</Text>
              <TouchableOpacity onPress={() => onFundNameChange(derivedFundName)} activeOpacity={0.8}>
                <Text style={styles.eventFundEditText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.eventFundDerivedName}>{derivedFundName}</Text>
          </View>

          <DateTimeSheet
            visible={showDatePicker}
            mode="date"
            value={eventDate}
            minimumDate={new Date()}
            onClose={() => setShowDatePicker(false)}
            onChange={onEventDateChange}
          />
          <DateTimeSheet
            visible={showTimePicker}
            mode="time"
            value={eventTime}
            onClose={() => setShowTimePicker(false)}
            onChange={onEventTimeChange}
          />

          <TouchableOpacity
            style={[styles.eventFundContinue, !isStepValid && styles.eventContinueDisabled]}
            activeOpacity={isStepValid ? 0.86 : 1}
            onPress={() => {
              if (!isStepValid) return
              onContinue(derivedFundName)
            }}
          >
            <Text style={styles.eventFundContinueText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    eventFundDetailsScroll: {
      flexGrow: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: 28,
      paddingTop: 34,
      paddingBottom: 44,
    },
    eventFundDetailsIntro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      marginBottom: 28,
    },
    eventFundDetailsEmoji: {
      width: 76,
      fontSize: 48,
      textAlign: 'center',
    },
    eventFundDetailsIntroText: {
      flex: 1,
    },
    eventFundDetailsTitle: {
      fontSize: 27,
      lineHeight: 33,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    eventFundDetailsSubtitle: {
      fontSize: 18,
      lineHeight: 25,
      color: colors.textMuted,
    },
    eventFundDetailsField: {
      marginBottom: 24,
    },
    eventFundDetailsLabel: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 10,
    },
    eventFundDetailsNameInput: {
      minHeight: 116,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
      borderRadius: 16,
      paddingHorizontal: 22,
      paddingVertical: 18,
      fontSize: 21,
      lineHeight: 27,
      color: colors.textPrimary,
    },
    eventFundDateTimeRow: {
      flexDirection: 'row',
      gap: 20,
      marginBottom: 24,
    },
    eventFundDateTimeField: {
      flex: 1,
    },
    eventFundDateTimeBox: {
      minHeight: 92,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 16,
    },
    eventFundDateTimeText: {
      fontSize: 19,
      lineHeight: 25,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    eventFundVenueBox: {
      minHeight: 100,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 22,
    },
    eventFundVenueInput: {
      flex: 1,
      fontSize: 19,
      lineHeight: 26,
      color: colors.textPrimary,
      paddingVertical: 18,
    },
    eventFundNameCard: {
      backgroundColor: BRAND_LAVENDER,
      borderRadius: 18,
      paddingHorizontal: 22,
      paddingVertical: 20,
      marginBottom: 28,
    },
    eventFundNameHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    eventFundNameLabel: {
      fontSize: 16,
      fontWeight: '900',
      color: BRAND_PURPLE,
    },
    eventFundEditText: {
      fontSize: 16,
      fontWeight: '700',
      color: BRAND_PURPLE,
    },
    eventFundDerivedName: {
      fontSize: 21,
      lineHeight: 28,
      color: colors.textPrimary,
    },
    eventFundContinue: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE_DARK,
      borderRadius: 28,
      paddingVertical: 17,
      shadowColor: BRAND_PURPLE,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 6,
    },
    eventFundContinueText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    eventContinueDisabled: {
      backgroundColor: colors.disabled,
      shadowOpacity: 0,
      elevation: 0,
    },
  })
}
