import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { supabase } from '../../lib/supabase'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'EventBudget'>
  route: RouteProp<MainStackParamList, 'EventBudget'>
}

const PRESETS = ['5,000', '10,000', '15,000', '25,000']

export default function EventBudgetScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const [budget, setBudget] = useState('0')
  const [currency, setCurrency] = useState('BWP')
  const [isSaving, setIsSaving] = useState(false)
  const [linkedFundId, setLinkedFundId] = useState<string | null>(null)

  useFocusEffect(useCallback(() => {
    let active = true
    Promise.all([
      supabase.from('events').select('currency_code, linked_fund_id').eq('id', route.params.eventId).single(),
      supabase.from('event_budgets').select('total_budget, currency_code').eq('event_id', route.params.eventId).maybeSingle(),
    ]).then(([eventResult, budgetResult]) => {
      if (!active) return
      const code = budgetResult.data?.currency_code ?? eventResult.data?.currency_code ?? 'BWP'
      setCurrency(code)
      setLinkedFundId(eventResult.data?.linked_fund_id ?? null)
      if (budgetResult.data) setBudget(Number(budgetResult.data.total_budget).toLocaleString('en-BW'))
    })
    return () => { active = false }
  }, [route.params.eventId]))

  function handleBudgetChange(text: string) {
    const cleaned = text.replace(/[^0-9,]/g, '')
    setBudget(cleaned || '0')
  }

  async function saveBudget() {
    const amount = Number(budget.replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0 || isSaving) {
      Alert.alert('Enter a budget', 'The budget must be greater than zero.')
      return
    }
    setIsSaving(true)
    const { error } = await supabase.from('event_budgets').upsert({
      event_id: route.params.eventId,
      total_budget: amount,
      currency_code: currency,
    }, { onConflict: 'event_id' })
    setIsSaving(false)
    Alert.alert(error ? 'Could not save budget' : 'Budget saved', error?.message ?? 'Your event budget is up to date.')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event budget</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Plan your spending</Text>
        <Text style={styles.pageSubtitle}>Set the total amount available for this event.</Text>

        <View style={styles.budgetCard}>
          <Text style={styles.cardLabel}>TOTAL BUDGET</Text>

          <View style={styles.amountRow}>
            <Text style={styles.currency}>{currency === 'BWP' ? 'P' : currency}</Text>
            <TextInput
              style={styles.amountInput}
              value={budget}
              onChangeText={handleBudgetChange}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={styles.quickLabel}>Quick amounts</Text>
          <View style={styles.presetsRow}>
            {PRESETS.map(value => (
              <TouchableOpacity
                key={value}
                style={[styles.presetChip, budget === value && styles.presetChipActive]}
                onPress={() => setBudget(value)}
                activeOpacity={0.82}
              >
                <Text style={[styles.presetText, budget === value && styles.presetTextActive]}>{Number(value.replace(',', '')).toLocaleString('en-BW', { notation: 'compact' })}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.linkFundCard}>
          <View style={styles.linkFundIcon}>
            <Ionicons name="wallet-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.linkFundCopy}>
            <Text style={styles.linkFundEyebrow}>{linkedFundId ? 'LINKED FUND' : 'CONTRIBUTIONS'}</Text>
            <Text style={styles.linkFundTitle}>{linkedFundId ? 'Contribution fund' : 'Fund this event'}</Text>
            <Text style={styles.linkFundText}>{linkedFundId ? 'Track contributions and spending' : 'Create Event + Fund to collect contributions'}</Text>
          </View>
          <TouchableOpacity
            style={styles.linkFundButton}
            activeOpacity={0.86}
            onPress={() => {
              if (linkedFundId) navigation.navigate('FundDetail', { fundId: linkedFundId })
              else Alert.alert('No linked fund', 'Create an Event + Fund from the creation menu to track contributions with a budget.')
            }}
          >
            <Ionicons name={linkedFundId ? 'chevron-forward' : 'information-circle-outline'} size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.setBudgetButton}
          activeOpacity={0.86}
          onPress={saveBudget}
          disabled={isSaving}
        >
          <Text style={styles.setBudgetButtonText}>{isSaving ? 'Saving...' : 'Save budget'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 4,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    headerSpacer: { width: 36 },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 44,
    },
    pageTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    pageSubtitle: { fontSize: 13, lineHeight: 19, color: colors.textMuted, marginBottom: 18 },
    budgetCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
    },
    cardLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.textMuted, marginBottom: 10 },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 58,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 14,
    },
    currency: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textMuted,
    },
    amountInput: {
      flex: 1,
      fontSize: 34,
      lineHeight: 42,
      fontWeight: '800',
      color: colors.textPrimary,
      paddingVertical: 0,
    },
    quickLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 8 },
    presetsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    presetChip: {
      flex: 1,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
    },
    presetChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    presetText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    presetTextActive: { color: colors.primary },
    linkFundCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary + '40',
      borderRadius: 14,
      padding: 12,
      marginBottom: 18,
    },
    linkFundIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    linkFundCopy: { flex: 1 },
    linkFundEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: colors.primary, marginBottom: 2 },
    linkFundTitle: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    linkFundText: {
      fontSize: 11,
      lineHeight: 15,
      color: colors.textMuted,
    },
    linkFundButton: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
    },
    setBudgetButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 13,
    },
    setBudgetButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  })
}
