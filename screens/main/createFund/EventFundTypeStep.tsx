import { KeyboardAvoidingView, Platform, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import EmojiPickerModal from './EmojiPickerModal'
import {
  BRAND_LAVENDER,
  BRAND_PURPLE,
  CUSTOM_EVENT_EMOJIS,
  EVENT_TYPES,
  EventTypeOption,
} from './constants'

type Props = {
  eventType: EventTypeOption
  onSelectType: (type: EventTypeOption) => void
  isOtherEvent: boolean
  customEventType: string
  onCustomEventTypeChange: (text: string) => void
  customEventEmoji: string
  onCustomEventEmojiChange: (emoji: string) => void
  showEmojiDialog: boolean
  onShowEmojiDialog: (visible: boolean) => void
  emojiSearch: string
  onEmojiSearchChange: (text: string) => void
  emojiCategory: string
  onEmojiCategoryChange: (category: string) => void
  isStepValid: boolean
  onContinue: () => void
  onBack: () => void
}

export default function EventFundTypeStep({
  eventType,
  onSelectType,
  isOtherEvent,
  customEventType,
  onCustomEventTypeChange,
  customEventEmoji,
  onCustomEventEmojiChange,
  showEmojiDialog,
  onShowEmojiDialog,
  emojiSearch,
  onEmojiSearchChange,
  emojiCategory,
  onEmojiCategoryChange,
  isStepValid,
  onContinue,
  onBack,
}: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const eventFundTypes = [
    ...EVENT_TYPES.slice(0, 4),
    EVENT_TYPES.find(item => item.id === 'other')!,
  ]

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <FlowHeader title="Event + Fund" step="Step 1 of 4" onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.eventFundScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.eventFundTitle}>What are you creating?</Text>
        <Text style={styles.eventFundSubtitle}>Choose the event this contribution fund is for.</Text>

        <View style={styles.eventFundGrid}>
          {eventFundTypes.map(item => {
            const active = eventType.id === item.id
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.eventFundTypeCard, active && styles.eventFundTypeCardActive]}
                activeOpacity={0.84}
                onPress={() => onSelectType(item)}
              >
                <Text style={styles.eventFundTypeEmoji}>{item.emoji}</Text>
                <Text style={[styles.eventFundTypeLabel, active && styles.eventFundTypeLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {isOtherEvent ? (
          <View style={styles.customEventPanel}>
            <Text style={styles.customEventLabel}>Custom event type</Text>
            <TextInput
              style={styles.customEventInput}
              placeholder="Name your event type"
              placeholderTextColor={colors.textMuted}
              value={customEventType}
              onChangeText={onCustomEventTypeChange}
              maxLength={32}
              autoCapitalize="words"
              returnKeyType="done"
            />

            <Text style={styles.customEmojiLabel}>Choose an emoji</Text>
            <View style={styles.customEmojiRow}>
              {CUSTOM_EVENT_EMOJIS.map(emoji => {
                const active = customEventEmoji === emoji
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.customEmojiButton, active && styles.customEmojiButtonActive]}
                    activeOpacity={0.84}
                    onPress={() => onCustomEventEmojiChange(emoji)}
                  >
                    <Text style={styles.customEmojiText}>{emoji}</Text>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity
                style={styles.customEmojiMoreButton}
                activeOpacity={0.84}
                onPress={() => onShowEmojiDialog(true)}
                accessibilityLabel="Choose another emoji"
              >
                <Ionicons name="add" size={22} color={BRAND_PURPLE} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <EmojiPickerModal
          visible={showEmojiDialog}
          selected={customEventEmoji}
          search={emojiSearch}
          onSearchChange={onEmojiSearchChange}
          category={emojiCategory}
          onCategoryChange={onEmojiCategoryChange}
          onSelect={native => {
            onCustomEventEmojiChange(native)
            onShowEmojiDialog(false)
          }}
          onClose={() => onShowEmojiDialog(false)}
        />

        <TouchableOpacity
          style={[styles.eventFundContinue, !isStepValid && styles.eventFundContinueDisabled]}
          activeOpacity={isStepValid ? 0.86 : 1}
          disabled={!isStepValid}
          onPress={() => {
            if (isStepValid) onContinue()
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
    eventFundScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
    },
    eventFundTitle: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    eventFundSubtitle: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 28,
    },
    eventFundGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      marginBottom: 24,
    },
    eventFundTypeCard: {
      width: '48%',
      minHeight: 112,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 24,
    },
    eventFundTypeCardActive: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    eventFundTypeEmoji: {
      fontSize: 38,
      marginBottom: 12,
    },
    eventFundTypeLabel: {
      fontSize: 16,
      lineHeight: 25,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    eventFundTypeLabelActive: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    customEventPanel: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      marginBottom: 24,
    },
    customEventLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 8,
    },
    customEventInput: {
      minHeight: 54,
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: BRAND_PURPLE,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 16,
    },
    customEmojiLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 10,
    },
    customEmojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    customEmojiButton: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    customEmojiButtonActive: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    customEmojiMoreButton: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: BRAND_PURPLE,
      borderRadius: 14,
    },
    customEmojiText: { fontSize: 24 },
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
    eventFundContinueDisabled: {
      backgroundColor: colors.disabled,
      shadowOpacity: 0,
      elevation: 0,
    },
  })
}
