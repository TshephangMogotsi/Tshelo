import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import FundIconPickerSheet from './FundIconPickerSheet'
import {
  BRAND_LAVENDER,
  BRAND_PURPLE,
  EVENT_TYPES,
  EmojiOption,
  EventTypeOption,
  isOtherFundIcon,
} from './constants'

type Props = {
  eventType: EventTypeOption
  onSelectType: (type: EventTypeOption) => void
  isOtherEvent: boolean
  customEventType: string
  onCustomEventTypeChange: (text: string) => void
  selectedFundIcon: EmojiOption
  onSelectFundIcon: (icon: EmojiOption) => void
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
  selectedFundIcon,
  onSelectFundIcon,
  isStepValid,
  onContinue,
  onBack,
}: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const [showFundIconPicker, setShowFundIconPicker] = useState(false)
  const eventFundTypes = [
    ...EVENT_TYPES.slice(0, 4),
    EVENT_TYPES.find(item => item.id === 'other')!,
  ]

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <FlowHeader title="Event + Fund" step="Step 2 of 5" onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>What are you creating?</Text>
          <Text style={styles.subtitle}>Choose the event this contribution fund is for.</Text>

          <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Event type">
            {eventFundTypes.map(item => {
              const active = eventType.id === item.id
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.typeCard, active && styles.typeCardActive]}
                  activeOpacity={0.84}
                  onPress={() => onSelectType(item)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${item.label} event type`}
                >
                  <View style={[styles.typeIcon, active && styles.typeIconActive]}>
                    <Ionicons name={item.icon} size={25} color={active ? colors.primary : colors.textSecondary} />
                  </View>
                  <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {isOtherEvent ? (
            <View style={styles.customEventPanel}>
              <Text style={styles.customEventLabel}>Custom event type</Text>
              <View style={styles.customEventInputRow}>
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
                <TouchableOpacity
                  style={styles.trailingIconButton}
                  activeOpacity={0.8}
                  onPress={() => setShowFundIconPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose fund icon. Current selection ${selectedFundIcon.label}`}
                  accessibilityHint="Opens the fund icon picker"
                >
                  <Ionicons
                    name={selectedFundIcon.icon ?? 'wallet-outline'}
                    size={22}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <FundIconPickerSheet
            visible={showFundIconPicker}
            selectedId={isOtherFundIcon(selectedFundIcon.id) ? selectedFundIcon.id : null}
            onSelect={item => {
              onSelectFundIcon(item)
              setShowFundIconPicker(false)
            }}
            onClose={() => setShowFundIconPicker(false)}
          />

          <TouchableOpacity
            style={[styles.continueButton, !isStepValid && styles.continueButtonDisabled]}
            activeOpacity={isStepValid ? 0.86 : 1}
            disabled={!isStepValid}
            onPress={onContinue}
          >
            <Text style={styles.continueText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
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
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 22,
      paddingBottom: 44,
    },
    title: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 5,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: 22,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 20,
    },
    typeCard: {
      width: '48%',
      minHeight: 104,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 16,
    },
    typeCardActive: {
      backgroundColor: BRAND_LAVENDER,
      borderColor: BRAND_PURPLE,
    },
    typeIcon: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.background,
    },
    typeIconActive: {
      backgroundColor: colors.surface,
    },
    typeLabel: {
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    typeLabelActive: {
      color: colors.primary,
      fontWeight: '900',
    },
    customEventPanel: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
    },
    customEventLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    customEventInputRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    customEventInput: {
      flex: 1,
      paddingLeft: 16,
      paddingRight: 8,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.textPrimary,
    },
    trailingIconButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      marginRight: 6,
    },
    continueButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: BRAND_PURPLE,
      borderRadius: 28,
      paddingVertical: 17,
      shadowColor: BRAND_PURPLE,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 6,
    },
    continueButtonDisabled: {
      backgroundColor: colors.disabled,
      shadowOpacity: 0,
      elevation: 0,
    },
    continueText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  })
}
