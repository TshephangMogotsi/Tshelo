import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Linking, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import DateTimeSheet from './DateTimeSheet'
import {
  formatDateDisplay,
  formatTimeDisplay,
  shouldSyncSuggestedFundName,
  suggestedEventFundName,
} from './format'
import { BRAND_LAVENDER, BRAND_PURPLE, BRAND_PURPLE_DARK } from './constants'
import { isMapsUrl, mapsSearchUrl } from '../../../lib/maps'

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
  eventVenueMapLink: string
  onEventVenueMapLinkChange: (text: string) => void
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
  eventVenueMapLink,
  onEventVenueMapLinkChange,
  onContinue,
  onBack,
}: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const hasInvalidMapLink = eventVenueMapLink.trim().length > 0 && !isMapsUrl(eventVenueMapLink)
  const isStepValid = eventName.trim().length >= 3
    && eventDate !== null
    && eventTime !== null
    && eventVenue.trim().length >= 3
    && !hasInvalidMapLink
  const derivedFundName = fundName.trim() || suggestedEventFundName(eventName, selectedEventLabel)

  function openVenueSearch() {
    void Linking.openURL(mapsSearchUrl(eventVenue, Platform.OS === 'ios' ? 'ios' : 'android'))
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <FlowHeader title="Event + Fund" step="Step 2 of 4" onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.eventFundDetailsScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eventFundDetailsTitle}>{selectedEventEmoji} Event details</Text>
          <Text style={styles.eventFundDetailsSubtitle}>Tell us about your {selectedEventLabel.toLowerCase()}.</Text>

          <View style={styles.eventFundDetailsField}>
            <Text style={styles.eventFundDetailsLabel}>Event name</Text>
            <TextInput
              style={styles.eventFundDetailsNameInput}
              placeholder={`${selectedEventLabel} Event`}
              placeholderTextColor={colors.textMuted}
              value={eventName}
              onChangeText={text => {
                const syncFundName = shouldSyncSuggestedFundName(fundName, eventName, selectedEventLabel)
                onEventNameChange(text)
                if (syncFundName) onFundNameChange(suggestedEventFundName(text, selectedEventLabel))
              }}
              maxLength={90}
              autoCapitalize="words"
              returnKeyType="next"
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
              <Ionicons name="location-outline" size={22} color={colors.textMuted} />
            </View>
            <TouchableOpacity style={styles.openMapsButton} onPress={openVenueSearch} activeOpacity={0.75}>
              <Ionicons name="map-outline" size={16} color={BRAND_PURPLE} />
              <Text style={styles.openMapsText}>Find this venue in Maps</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.eventFundDetailsField}>
            <View style={styles.mapLinkLabelRow}>
              <Text style={styles.eventFundDetailsLabel}>Maps link</Text>
              <Text style={styles.optionalLabel}>Optional</Text>
            </View>
            <View style={[styles.mapLinkRow, hasInvalidMapLink && styles.inputError]}>
              <TextInput
                style={styles.mapLinkInput}
                placeholder="Paste a Google, Apple Maps or Waze link"
                placeholderTextColor={colors.textMuted}
                value={eventVenueMapLink}
                onChangeText={onEventVenueMapLinkChange}
                maxLength={500}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Ionicons name="link-outline" size={21} color={colors.textMuted} />
            </View>
            {hasInvalidMapLink ? (
              <Text style={styles.mapLinkError}>Use a Google Maps, Apple Maps or Waze link.</Text>
            ) : (
              <Text style={styles.mapLinkHelp}>Open Maps above, share or copy the place link, then paste it here.</Text>
            )}
          </View>

          <View style={styles.eventFundDetailsField}>
            <Text style={styles.eventFundDetailsLabel}>Fund name</Text>
            <TextInput style={styles.eventFundDetailsNameInput} value={derivedFundName} onChangeText={onFundNameChange} maxLength={90} />
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
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
    },
    eventFundDetailsTitle: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    eventFundDetailsSubtitle: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.textMuted,
      marginBottom: 24,
    },
    eventFundDetailsField: {
      marginBottom: 20,
    },
    eventFundDetailsLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 8,
    },
    mapLinkLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    optionalLabel: {
      marginBottom: 8,
      fontSize: 11,
      color: colors.textMuted,
    },
    eventFundDetailsNameInput: {
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
    eventFundDateTimeRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    eventFundDateTimeField: {
      flex: 1,
    },
    eventFundDateTimeBox: {
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 16,
    },
    eventFundDateTimeText: {
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    eventFundVenueBox: {
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
    eventFundVenueInput: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
      paddingVertical: 18,
    },
    openMapsButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 9,
      paddingVertical: 4,
    },
    openMapsText: {
      fontSize: 13,
      fontWeight: '700',
      color: BRAND_PURPLE,
    },
    mapLinkRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      gap: 10,
    },
    mapLinkInput: {
      flex: 1,
      paddingVertical: 15,
      fontSize: 14,
      color: colors.textPrimary,
    },
    inputError: { borderColor: colors.error },
    mapLinkHelp: { marginTop: 6, fontSize: 11, lineHeight: 16, color: colors.textMuted },
    mapLinkError: { marginTop: 6, fontSize: 11, lineHeight: 16, color: colors.error },
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
      backgroundColor: BRAND_PURPLE,
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
