import { View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import { formatWholeAmount, parseAmount } from './format'
import { BRAND_LAVENDER, BRAND_PURPLE, EVENT_BUDGET_PRESETS } from './constants'

type Props = {
  eventBudget: string
  onEventBudgetChange: (text: string) => void
  fundGoalPercent: number
  eventName: string
  isCreating: boolean
  onCreate: (fundGoalAmount: number) => void
  onBack: () => void
}

export default function EventFundBudgetStep({
  eventBudget,
  onEventBudgetChange,
  fundGoalPercent,
  eventName,
  isCreating,
  onCreate,
  onBack,
}: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  const budgetAmount = parseAmount(eventBudget)
  const fundGoalAmount = Math.round(budgetAmount * fundGoalPercent / 100)
  const youPayAmount = Math.max(budgetAmount - fundGoalAmount, 0)
  const canCreateEventFund = budgetAmount > 0 && eventName.trim().length >= 3

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <FlowHeader title="Event + Fund" step="Step 4 of 4" onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.budgetScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.budgetTitle}>Budget &amp; Goal</Text>
          <Text style={styles.budgetSubtitle}>Set the total budget and review the fund target.</Text>

          <View style={styles.budgetSectionTitleRow}>
            <Text style={styles.budgetSectionIcon}>📋</Text>
            <Text style={styles.budgetSectionTitle}>Event Budget</Text>
          </View>
          <Text style={styles.budgetPrompt}>How much will this event cost in total?</Text>

          <View style={styles.eventBudgetInputBox}>
            <Text style={styles.eventBudgetCurrency}>P</Text>
            <TextInput
              style={styles.eventBudgetInput}
              value={eventBudget}
              onChangeText={onEventBudgetChange}
              keyboardType="decimal-pad"
              placeholder="50,000"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.eventBudgetPresetRow}>
            {EVENT_BUDGET_PRESETS.map(preset => {
              const active = eventBudget.replace(/,/g, '') === preset.value.replace(/,/g, '')
              return (
                <TouchableOpacity
                  key={preset.value}
                  style={[styles.eventBudgetPreset, active && styles.eventBudgetPresetActive]}
                  activeOpacity={0.84}
                  onPress={() => onEventBudgetChange(preset.value)}
                >
                  <Text style={[styles.eventBudgetPresetText, active && styles.eventBudgetPresetTextActive]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={styles.fundGoalHeaderRow}>
            <Text style={styles.fundGoalIcon}>💜</Text>
            <Text style={styles.budgetSectionTitle}>Fund Goal</Text>
          </View>
          <Text style={styles.budgetPrompt}>How much do you want to raise?</Text>

          <Text style={styles.percentValue}>{fundGoalPercent}%</Text>
          <Text style={styles.percentCaption}>of budget</Text>

          <View style={styles.percentTrack}>
            <View style={[styles.percentFill, { width: `${fundGoalPercent}%` as any }]} />
            <View style={[styles.percentThumb, { left: `${fundGoalPercent}%` as any }]} />
          </View>
          <View style={styles.percentLabels}>
            <Text style={styles.percentLabel}>0%</Text>
            <Text style={styles.percentLabel}>50%</Text>
            <Text style={styles.percentLabel}>100%</Text>
          </View>

          <View style={styles.fundGoalCard}>
            <Text style={styles.fundGoalCardLabel}>Your fund goal</Text>
            <Text style={styles.fundGoalCardValue}>{formatWholeAmount(fundGoalAmount)}</Text>
          </View>

          <View style={styles.budgetSummaryCard}>
            <View style={styles.budgetSummaryItem}>
              <Text style={styles.budgetSummaryLabel}>BUDGET</Text>
              <Text style={styles.budgetSummaryBudget}>{formatWholeAmount(budgetAmount)}</Text>
            </View>
            <View style={styles.budgetSummaryItem}>
              <Text style={styles.budgetSummaryLabel}>RAISE</Text>
              <Text style={styles.budgetSummaryRaise}>{formatWholeAmount(fundGoalAmount)}</Text>
            </View>
            <View style={styles.budgetSummaryItem}>
              <Text style={styles.budgetSummaryLabel}>YOU PAY</Text>
              <Text style={styles.budgetSummaryPay}>{formatWholeAmount(youPayAmount)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.createEventFundButton, (!canCreateEventFund || isCreating) && styles.eventContinueDisabled]}
            activeOpacity={canCreateEventFund && !isCreating ? 0.86 : 1}
            onPress={() => {
              if (!canCreateEventFund || isCreating) return
              onCreate(fundGoalAmount)
            }}
          >
            <Text style={styles.createEventFundButtonText}>{isCreating ? 'Creating...' : 'Create Event + Fund'}</Text>
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
    budgetScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
    },
    budgetTitle: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    budgetSubtitle: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.textMuted,
      marginBottom: 28,
    },
    budgetSectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    budgetSectionIcon: {
      fontSize: 24,
      width: 34,
      textAlign: 'center',
    },
    budgetSectionTitle: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    budgetPrompt: {
      fontSize: 16,
      lineHeight: 23,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 16,
    },
    eventBudgetInputBox: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      marginBottom: 14,
    },
    eventBudgetCurrency: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.textMuted,
      marginRight: 2,
    },
    eventBudgetInput: {
      flex: 1,
      fontSize: 16,
      fontWeight: '400',
      color: colors.textPrimary,
      paddingVertical: 16,
    },
    eventBudgetPresetRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 32,
    },
    eventBudgetPreset: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
    },
    eventBudgetPresetActive: {
      backgroundColor: BRAND_PURPLE,
    },
    eventBudgetPresetText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textMuted,
    },
    eventBudgetPresetTextActive: {
      color: '#FFFFFF',
    },
    fundGoalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    fundGoalIcon: {
      fontSize: 25,
      width: 34,
      textAlign: 'center',
    },
    percentValue: {
      fontSize: 36,
      lineHeight: 44,
      fontWeight: '900',
      color: BRAND_PURPLE,
      textAlign: 'center',
      marginTop: 2,
    },
    percentCaption: {
      fontSize: 17,
      lineHeight: 23,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 20,
    },
    percentTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
      marginBottom: 12,
      overflow: 'visible',
    },
    percentFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: BRAND_PURPLE,
    },
    percentThumb: {
      position: 'absolute',
      top: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      marginLeft: -10,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    percentLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 26,
    },
    percentLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textMuted,
    },
    fundGoalCard: {
      alignItems: 'center',
      backgroundColor: BRAND_LAVENDER,
      borderRadius: 14,
      paddingVertical: 18,
      marginBottom: 20,
    },
    fundGoalCardLabel: {
      fontSize: 18,
      color: BRAND_PURPLE,
      marginBottom: 8,
    },
    fundGoalCardValue: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '900',
      color: BRAND_PURPLE,
    },
    budgetSummaryCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 18,
      marginBottom: 28,
    },
    budgetSummaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    budgetSummaryLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      marginBottom: 6,
    },
    budgetSummaryBudget: {
      fontSize: 19,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    budgetSummaryRaise: {
      fontSize: 19,
      fontWeight: '900',
      color: BRAND_PURPLE,
    },
    budgetSummaryPay: {
      fontSize: 19,
      fontWeight: '900',
      color: '#EF4444',
    },
    createEventFundButton: {
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
    createEventFundButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '700',
      textAlign: 'center',
    },
    eventContinueDisabled: {
      backgroundColor: colors.disabled,
      shadowOpacity: 0,
      elevation: 0,
    },
  })
}
