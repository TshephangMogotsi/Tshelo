import { View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import EmojiPickerModal from './EmojiPickerModal'
import {
  BRAND_LAVENDER,
  BRAND_PURPLE,
  BRAND_PURPLE_DARK,
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

export default function EventTypeStep({
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <FlowHeader title="Create Event" step="Step 1 of 3" onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.eventScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eventQuestion}>What are you planning?</Text>

        <View style={styles.eventGrid}>
          {EVENT_TYPES.map(item => {
            const active = eventType.id === item.id
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.eventTypeCard, active && styles.eventTypeCardActive]}
                activeOpacity={0.84}
                onPress={() => onSelectType(item)}
              >
                <Text style={styles.eventTypeEmoji}>{item.emoji}</Text>
                <Text style={[styles.eventTypeLabel, active && styles.eventTypeLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {isOtherEvent && (
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
              >
                <Ionicons name="add" size={22} color={BRAND_PURPLE} />
              </TouchableOpacity>
            </View>
          </View>
        )}

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
    eventScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
    },
    eventQuestion: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 28,
    },
    eventGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      marginBottom: 34,
    },
    eventTypeCard: {
      width: '48%',
      minHeight: 124,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 24,
    },
    eventTypeCardActive: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    eventTypeEmoji: {
      fontSize: 38,
      marginBottom: 12,
    },
    eventTypeLabel: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    eventTypeLabelActive: {
      color: colors.textPrimary,
    },
    customEventPanel: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginTop: -8,
      marginBottom: 24,
    },
    customEventLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 8,
    },
    customEventInput: {
      minHeight: 56,
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
    customEmojiRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    customEmojiButton: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1.5,
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
    customEmojiText: {
      fontSize: 24,
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
