import { View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import {
  BRAND_LAVENDER,
  BRAND_PURPLE,
  BRAND_PURPLE_DARK,
  EVENT_TYPES,
  EventTypeOption,
} from './constants'

type Props = {
  eventType: EventTypeOption
  onSelectType: (type: EventTypeOption) => void
  isOtherEvent: boolean
  customEventType: string
  onCustomEventTypeChange: (text: string) => void
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

        <View style={styles.eventGrid} accessibilityRole="radiogroup" accessibilityLabel="Event type">
          {EVENT_TYPES.map(item => {
            const active = eventType.id === item.id
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.eventTypeCard, active && styles.eventTypeCardActive]}
                activeOpacity={0.84}
                onPress={() => onSelectType(item)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${item.label} event type`}
              >
                <View style={[styles.eventTypeIcon, active && styles.eventTypeIconActive]}>
                  <Ionicons name={item.icon} size={25} color={active ? colors.primary : colors.textSecondary} />
                </View>
                <Text style={[styles.eventTypeLabel, active && styles.eventTypeLabelActive]}>
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
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.eventContinueButton, !isStepValid && styles.eventContinueDisabled]}
          activeOpacity={isStepValid ? 0.86 : 1}
          disabled={!isStepValid}
          onPress={onContinue}
        >
          <Text style={styles.eventContinueText}>Continue</Text>
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
    eventScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 22,
      paddingBottom: 44,
    },
    eventQuestion: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 22,
    },
    eventGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 20,
    },
    eventTypeCard: {
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
    eventTypeCardActive: {
      backgroundColor: BRAND_LAVENDER,
      borderColor: BRAND_PURPLE,
    },
    eventTypeIcon: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.background,
    },
    eventTypeIconActive: {
      backgroundColor: colors.surface,
    },
    eventTypeLabel: {
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    eventTypeLabelActive: {
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
    customEventInput: {
      minHeight: 54,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.textPrimary,
    },
    eventContinueButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
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
