import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import FlowHeader from './FlowHeader'
import { parseAmount } from './format'
import { BRAND_PURPLE, EVENT_BUDGET_PRESETS } from './constants'

type Props = {
  eventBudget: string
  onEventBudgetChange: (text: string) => void
  fundGoalPercent: number
  onFundGoalPercentChange: (value: number) => void
  eventName: string
  currencySymbol: string
  isCreating: boolean
  onCreate: (fundGoalAmount: number) => void
  onBack: () => void
}

export default function EventFundBudgetStep({
  eventBudget,
  onEventBudgetChange,
  fundGoalPercent,
  onFundGoalPercentChange,
  eventName,
  currencySymbol,
  isCreating,
  onCreate,
  onBack,
}: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const [goalTrackWidth, setGoalTrackWidth] = useState(0)
  const [percentInput, setPercentInput] = useState(String(fundGoalPercent))

  const budgetAmount = parseAmount(eventBudget)
  const fundGoalAmount = Math.round(budgetAmount * fundGoalPercent / 100)
  const organiserAmount = Math.max(budgetAmount - fundGoalAmount, 0)
  const canCreateEventFund = budgetAmount > 0 && eventName.trim().length >= 3

  useEffect(() => {
    setPercentInput(String(fundGoalPercent))
  }, [fundGoalPercent])

  function formatAmount(amount: number) {
    return `${currencySymbol}${amount.toLocaleString('en-BW', { maximumFractionDigits: 0 })}`
  }

  function updateGoalFromTouch(event: GestureResponderEvent) {
    if (goalTrackWidth <= 0) return
    const raw = Math.round((event.nativeEvent.locationX / goalTrackWidth) * 100 / 5) * 5
    updateGoalPercent(Math.min(100, Math.max(5, raw)))
  }

  function updateGoalPercent(value: number) {
    const normalized = Math.min(100, Math.max(5, Math.round(value)))
    setPercentInput(String(normalized))
    onFundGoalPercentChange(normalized)
  }

  function changePercentInput(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 3)
    const parsed = Number(digits)
    if (parsed > 100) {
      updateGoalPercent(100)
      return
    }
    setPercentInput(digits)
    if (digits && parsed >= 5 && parsed <= 100) {
      onFundGoalPercentChange(parsed)
    }
  }

  function commitPercentInput() {
    if (!percentInput) {
      setPercentInput(String(fundGoalPercent))
      return
    }
    updateGoalPercent(Number(percentInput))
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <FlowHeader title="Event + Fund" step="Step 4 of 4" onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Budget &amp; goal</Text>
          <Text style={styles.pageSubtitle}>Set the event budget and choose how much the fund should raise.</Text>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="calculator-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.cardHeading}>
                <Text style={styles.cardEyebrow}>TOTAL EVENT BUDGET</Text>
                <Text style={styles.cardDescription}>The estimated cost of the whole event</Text>
              </View>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.currency}>{currencySymbol}</Text>
              <TextInput
                style={styles.amountInput}
                value={eventBudget}
                onChangeText={onEventBudgetChange}
                keyboardType="decimal-pad"
                placeholder="50,000"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Total event budget"
              />
            </View>

            <Text style={styles.quickLabel}>Quick amounts</Text>
            <View style={styles.presetRow}>
              {EVENT_BUDGET_PRESETS.map(preset => {
                const active = eventBudget.replace(/,/g, '') === preset.value.replace(/,/g, '')
                return (
                  <TouchableOpacity
                    key={preset.value}
                    style={[styles.preset, active && styles.presetActive]}
                    activeOpacity={0.82}
                    onPress={() => onEventBudgetChange(preset.value)}
                  >
                    <Text style={[styles.presetText, active && styles.presetTextActive]}>
                      {currencySymbol}{preset.label.replace(/^P/, '')}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="wallet-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.cardHeading}>
                <Text style={styles.cardEyebrow}>FUNDRAISING TARGET</Text>
                <Text style={styles.cardDescription}>Choose the share your members will raise</Text>
              </View>
            </View>

            <View style={styles.goalValues}>
              <View>
                <View style={styles.goalPercentInputRow}>
                  <TextInput
                    style={styles.goalPercentInput}
                    value={percentInput}
                    onChangeText={changePercentInput}
                    onBlur={commitPercentInput}
                    onSubmitEditing={commitPercentInput}
                    keyboardType="number-pad"
                    maxLength={3}
                    accessibilityLabel="Fund goal percentage input"
                  />
                  <Text style={styles.goalPercentSuffix}>%</Text>
                </View>
                <Text style={styles.goalCaption}>of total budget</Text>
              </View>
              <View style={styles.goalAmountWrap}>
                <Text style={styles.goalAmountLabel}>FUND GOAL</Text>
                <Text style={styles.goalAmount}>{formatAmount(fundGoalAmount)}</Text>
              </View>
            </View>

            <View
              style={styles.sliderTouchArea}
              onLayout={event => setGoalTrackWidth(event.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={updateGoalFromTouch}
              onResponderMove={updateGoalFromTouch}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Fund goal percentage"
              accessibilityValue={{ min: 5, max: 100, now: fundGoalPercent, text: `${fundGoalPercent}%` }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={event => {
                const change = event.nativeEvent.actionName === 'increment' ? 5 : -5
                updateGoalPercent(fundGoalPercent + change)
              }}
            >
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${fundGoalPercent}%` as any }]} />
              </View>
              <View style={[styles.sliderThumb, { left: `${fundGoalPercent}%` as any }]} />
            </View>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>5%</Text>
              <Text style={styles.sliderLabel}>50%</Text>
              <Text style={styles.sliderLabel}>100%</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>BUDGET</Text>
              <Text style={styles.summaryValue}>{formatAmount(budgetAmount)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>FUND RAISES</Text>
              <Text style={[styles.summaryValue, styles.summaryGoal]}>{formatAmount(fundGoalAmount)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>REMAINDER</Text>
              <Text style={styles.summaryValue}>{formatAmount(organiserAmount)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.createButton, (!canCreateEventFund || isCreating) && styles.createButtonDisabled]}
            activeOpacity={canCreateEventFund && !isCreating ? 0.86 : 1}
            disabled={!canCreateEventFund || isCreating}
            onPress={() => onCreate(fundGoalAmount)}
          >
            <Text style={styles.createButtonText}>{isCreating ? 'Creating…' : 'Create Event + Fund'}</Text>
            {!isCreating ? <Ionicons name="arrow-forward" size={18} color="#FFFFFF" /> : null}
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
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 44,
    },
    pageTitle: {
      fontSize: 22,
      lineHeight: 28,
      fontFamily: fonts.inter.extraBold,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    pageSubtitle: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
      marginBottom: 18,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    cardIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    cardHeading: { flex: 1 },
    cardEyebrow: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.9,
      color: colors.textPrimary,
      marginBottom: 3,
    },
    cardDescription: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
    amountRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 14,
    },
    currency: { fontSize: 18, fontWeight: '800', color: colors.textMuted },
    amountInput: {
      flex: 1,
      paddingVertical: 0,
      fontSize: 34,
      lineHeight: 42,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    quickLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 8 },
    presetRow: { flexDirection: 'row', gap: 8 },
    preset: {
      flex: 1,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
    },
    presetActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    presetText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    presetTextActive: { color: colors.primary, fontWeight: '900' },
    goalValues: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
    goalPercentInputRow: { flexDirection: 'row', alignItems: 'center' },
    goalPercentInput: {
      width: 58,
      paddingHorizontal: 0,
      paddingVertical: 0,
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '900',
      color: BRAND_PURPLE,
    },
    goalPercentSuffix: { fontSize: 32, lineHeight: 38, fontWeight: '900', color: BRAND_PURPLE },
    goalCaption: { fontSize: 11, color: colors.textMuted },
    goalAmountWrap: { alignItems: 'flex-end', paddingBottom: 2 },
    goalAmountLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, color: colors.textMuted, marginBottom: 3 },
    goalAmount: { fontSize: 20, lineHeight: 25, fontWeight: '900', color: colors.textPrimary },
    sliderTouchArea: { height: 34, justifyContent: 'center', marginHorizontal: 1 },
    sliderTrack: { height: 7, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
    sliderFill: { height: '100%', borderRadius: 4, backgroundColor: BRAND_PURPLE },
    sliderThumb: {
      position: 'absolute',
      top: 7,
      width: 20,
      height: 20,
      marginLeft: -10,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 3,
      borderColor: BRAND_PURPLE,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 2,
      elevation: 2,
    },
    sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -1 },
    sliderLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      paddingVertical: 15,
      paddingHorizontal: 8,
      marginBottom: 18,
    },
    summaryItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
    summaryDivider: { width: 1, backgroundColor: colors.border },
    summaryLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5, color: colors.textMuted, marginBottom: 5 },
    summaryValue: { fontSize: 14, fontWeight: '900', color: colors.textPrimary },
    summaryGoal: { color: colors.primary },
    createButton: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 17,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 5,
    },
    createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
    createButtonDisabled: { backgroundColor: colors.disabled, shadowOpacity: 0, elevation: 0 },
  })
}
