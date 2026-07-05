import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import DateTimeSheet from './DateTimeSheet'
import { formatEventDateDisplay, formatTimeDisplay } from './format'
import { BRAND_PURPLE, BRAND_PURPLE_DARK } from './constants'

type Props = {
  selectedEventLabel: string
  eventName: string
  onEventNameChange: (text: string) => void
  eventDate: Date | null
  onEventDateChange: (date: Date) => void
  eventTime: Date | null
  onEventTimeChange: (date: Date) => void
  eventVenue: string
  onEventVenueChange: (text: string) => void
  isStepValid: boolean
  onContinue: () => void
  onBack: () => void
}

export default function EventDetailsStep({
  selectedEventLabel,
  eventName,
  onEventNameChange,
  eventDate,
  onEventDateChange,
  eventTime,
  onEventTimeChange,
  eventVenue,
  onEventVenueChange,
  isStepValid,
  onContinue,
  onBack,
}: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <FlowHeader title="Event Details" step="Step 2 of 3" onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.eventDetailsScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.eventDetailsField}>
            <Text style={styles.eventDetailsLabel}>Event name</Text>
            <TextInput
              style={styles.eventDetailsInput}
              placeholder={`${selectedEventLabel} event`}
              placeholderTextColor={colors.textMuted}
              value={eventName}
              onChangeText={onEventNameChange}
              maxLength={90}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.eventDetailsField}>
            <Text style={styles.eventDetailsLabel}>Date</Text>
            <TouchableOpacity
              style={styles.eventDetailsPicker}
              activeOpacity={0.84}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.eventDetailsPickerText, !eventDate && { color: colors.textMuted }]}>
                {eventDate ? formatEventDateDisplay(eventDate) : 'Select date'}
              </Text>
              <Ionicons name="calendar-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.eventDetailsField}>
            <Text style={styles.eventDetailsLabel}>Time</Text>
            <TouchableOpacity
              style={styles.eventDetailsPicker}
              activeOpacity={0.84}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={[styles.eventDetailsPickerText, !eventTime && { color: colors.textMuted }]}>
                {eventTime ? formatTimeDisplay(eventTime) : 'Select time'}
              </Text>
              <Ionicons name="time-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.eventDetailsField}>
            <Text style={styles.eventDetailsLabel}>Venue</Text>
            <View style={styles.eventDetailsVenueRow}>
              <TextInput
                style={styles.eventDetailsVenueInput}
                placeholder="Cresta Lodge, Gaborone"
                placeholderTextColor={colors.textMuted}
                value={eventVenue}
                onChangeText={onEventVenueChange}
                multiline
                maxLength={120}
                textAlignVertical="center"
              />
              <Ionicons name="location-outline" size={22} color={colors.textMuted} />
            </View>
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
            style={[styles.eventContinueButton, !isStepValid && styles.eventContinueDisabled]}
            activeOpacity={isStepValid ? 0.86 : 1}
            onPress={() => {
              if (!isStepValid) return
              onContinue()
            }}
          >
            <Text style={styles.eventContinueText}>Continue</Text>
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
    eventDetailsScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
    },
    eventDetailsField: {
      marginBottom: 20,
    },
    eventDetailsLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 8,
    },
    eventDetailsInput: {
      minHeight: 56,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 16,
      color: colors.textPrimary,
    },
    eventDetailsPicker: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 10,
    },
    eventDetailsPickerText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    eventDetailsVenueRow: {
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      gap: 10,
    },
    eventDetailsVenueInput: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
      paddingVertical: 16,
    },
    eventContinueButton: {
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
    eventContinueText: {
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
