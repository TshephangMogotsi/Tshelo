import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import DateTimeSheet from './DateTimeSheet'
import { formatDateDisplay } from './format'
import {
  BRAND_LAVENDER,
  BRAND_PURPLE,
  EMOJI_OPTIONS,
  EmojiOption,
  GOAL_PRESETS,
} from './constants'

type Props = {
  name: string
  onNameChange: (name: string) => void
  selectedEmoji: EmojiOption
  onSelectEmoji: (emoji: EmojiOption) => void
  goalBWP: string
  onGoalChange: (goal: string) => void
  targetDate: Date | null
  onTargetDateChange: (date: Date) => void
  isPrivate: boolean
  onPrivateChange: (isPrivate: boolean) => void
  currencyCode: string
  currencySymbol: string
  isValid: boolean
  isCreatingFund: boolean
  onSubmit: () => void
  onBack: () => void
}

export default function FundFormStep({
  name,
  onNameChange,
  selectedEmoji,
  onSelectEmoji,
  goalBWP,
  onGoalChange,
  targetDate,
  onTargetDateChange,
  isPrivate,
  onPrivateChange,
  currencyCode,
  currencySymbol,
  isValid,
  isCreatingFund,
  onSubmit,
  onBack,
}: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const [showDatePicker, setShowDatePicker] = useState(false)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <FlowHeader title="Create Fund" step={`Step 1 of 2 • ${currencyCode}`} onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.fundFormScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.fundFormField}>
            <Text style={styles.fundFormLabel}>Fund name</Text>
            <TextInput
              style={styles.fundNameInput}
              placeholder="Mma's Funeral Fund"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={onNameChange}
              maxLength={80}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fundFormField}>
            <Text style={styles.fundFormLabel}>Choose an emoji</Text>
            <View style={styles.emojiRow}>
              {EMOJI_OPTIONS.map(item => {
                const active = selectedEmoji.id === item.id
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.emojiChoice, active && styles.emojiChoiceActive]}
                    activeOpacity={0.84}
                    onPress={() => onSelectEmoji(item)}
                  >
                    <Text style={styles.emojiChoiceText}>{item.emoji}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={styles.fundFormField}>
            <Text style={styles.fundFormLabel}>Fundraising goal <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.goalInputRow}>
              <Text style={styles.goalCurrencySymbol}>{currencySymbol}</Text>
              <TextInput
                style={styles.goalInput}
                placeholder="15,000"
                placeholderTextColor={colors.textMuted}
                value={goalBWP}
                onChangeText={onGoalChange}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            <View style={styles.goalPresetRow}>
              {GOAL_PRESETS.map(preset => {
                const active = goalBWP.replace(/,/g, '') === preset.value.replace(/,/g, '')
                return (
                  <TouchableOpacity
                    key={preset.value}
                    style={[styles.goalPreset, active && styles.goalPresetActive]}
                    activeOpacity={0.84}
                    onPress={() => onGoalChange(preset.value)}
                  >
                    <Text style={[styles.goalPresetText, active && styles.goalPresetTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={styles.fundFormField}>
            <Text style={styles.fundFormLabel}>Target date <Text style={styles.optional}>(optional)</Text></Text>
            <TouchableOpacity
              style={styles.dateRow}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dateInput, !targetDate && { color: colors.textMuted }]}>
                {targetDate ? formatDateDisplay(targetDate) : 'Select date'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <DateTimeSheet
            visible={showDatePicker}
            mode="date"
            value={targetDate}
            minimumDate={new Date()}
            onClose={() => setShowDatePicker(false)}
            onChange={onTargetDateChange}
          />

          <View style={styles.fundFormField}>
            <Text style={styles.fundFormLabel}>Fund visibility</Text>
            <View style={styles.privacyToggleRow}>
              <TouchableOpacity
                style={[styles.privacyOption, !isPrivate && styles.privacyOptionActive]}
                activeOpacity={0.84}
                onPress={() => onPrivateChange(false)}
              >
                <Ionicons name="globe-outline" size={16} color={!isPrivate ? BRAND_PURPLE : colors.textMuted} />
                <Text style={[styles.privacyOptionTitle, !isPrivate && styles.privacyOptionTitleActive]}>Public</Text>
                <Text style={styles.privacyOptionHint}>Anyone with the code joins instantly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.privacyOption, isPrivate && styles.privacyOptionActive]}
                activeOpacity={0.84}
                onPress={() => onPrivateChange(true)}
              >
                <Ionicons name="lock-closed-outline" size={16} color={isPrivate ? BRAND_PURPLE : colors.textMuted} />
                <Text style={[styles.privacyOptionTitle, isPrivate && styles.privacyOptionTitleActive]}>Private</Text>
                <Text style={styles.privacyOptionHint}>You approve each join request</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.fundContinueButton, (!isValid || isCreatingFund) && styles.fundContinueDisabled]}
            activeOpacity={isValid && !isCreatingFund ? 0.85 : 1}
            onPress={onSubmit}
            disabled={!isValid || isCreatingFund}
          >
            <Text style={styles.fundContinueText}>{isCreatingFund ? 'Creating...' : 'Create Fund'}</Text>
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
    fundFormScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
    },
    fundFormField: {
      marginBottom: 20,
    },
    fundFormLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 8,
    },
    fundNameInput: {
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
    emojiRow: {
      flexDirection: 'row',
      gap: 16,
    },
    emojiChoice: {
      width: 62,
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
    },
    emojiChoiceActive: {
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
      backgroundColor: BRAND_LAVENDER,
    },
    emojiChoiceText: {
      fontSize: 34,
    },
    optional: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textMuted,
    },
    goalInputRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      gap: 10,
      marginBottom: 14,
    },
    goalCurrencySymbol: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textMuted,
    },
    goalInput: {
      flex: 1,
      fontSize: 16,
      color: colors.textPrimary,
      paddingVertical: 16,
    },
    goalPresetRow: {
      flexDirection: 'row',
      gap: 12,
    },
    goalPreset: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
    },
    goalPresetActive: {
      backgroundColor: BRAND_PURPLE,
      borderColor: BRAND_PURPLE,
    },
    goalPresetText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textMuted,
    },
    goalPresetTextActive: {
      color: '#FFFFFF',
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 15,
    },
    dateInput: {
      flex: 1,
      fontSize: 16,
      color: colors.textPrimary,
    },
    privacyToggleRow: {
      flexDirection: 'row',
      gap: 12,
    },
    privacyOption: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 4,
    },
    privacyOptionActive: {
      borderColor: BRAND_PURPLE,
      backgroundColor: colors.primaryLight,
    },
    privacyOptionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 4,
    },
    privacyOptionTitleActive: {
      color: BRAND_PURPLE,
    },
    privacyOptionHint: {
      fontSize: 11,
      color: colors.textMuted,
      lineHeight: 15,
    },
    fundContinueButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE,
      borderRadius: 28,
      paddingVertical: 17,
      marginTop: 4,
      shadowColor: BRAND_PURPLE,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },
    fundContinueDisabled: {
      backgroundColor: colors.disabled,
      shadowOpacity: 0,
      elevation: 0,
    },
    fundContinueText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  })
}
