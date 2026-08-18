import { useCallback, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { api } from '../../lib/api'
import { runApiRead, toApiUiError } from '../../lib/apiScreen'
import { isFundReadOnly } from './fundDetail/finance'
import LoadingOverlay from '../../components/LoadingOverlay'

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
  const [hasLinkedFund, setHasLinkedFund] = useState(false)
  const [linkedFundReadOnly, setLinkedFundReadOnly] = useState(false)
  const [canManageBudget, setCanManageBudget] = useState<boolean | null>(null)
  const permissionAlerted = useRef(false)

  useFocusEffect(useCallback(() => {
    let active = true
    const controller = new AbortController()
    permissionAlerted.current = false
    setCanManageBudget(null)
    setHasLinkedFund(false)
    setLinkedFundReadOnly(false)
    runApiRead(call => api.events.workspace(route.params.eventId, call), { signal: controller.signal })
      .then(workspace => {
        if (!active || controller.signal.aborted) return
        const linked = Boolean(workspace.event.linked_fund_id)
        setHasLinkedFund(linked)
        if (!linked) {
          setCanManageBudget(false)
          Alert.alert(
            'Budget unavailable',
            'Event-only records track invitations and RSVPs. Create an Event + Fund when you need financial tracking.',
            [{ text: 'Back', onPress: () => navigation.goBack() }],
          )
          return
        }
        const allowed = workspace.capabilities.is_creator
          || workspace.capabilities.is_organiser
          || workspace.capabilities.linked_fund_permissions.includes('manage_event_budget')
        setCanManageBudget(allowed)
        if (!allowed && !permissionAlerted.current) {
          permissionAlerted.current = true
          Alert.alert(
            'Budget access required',
            'You do not have permission to change this event budget.',
            [{ text: 'Go back', onPress: () => navigation.goBack() }],
          )
        }
        const readOnly = Boolean(workspace.linked_fund && isFundReadOnly(workspace.linked_fund.fund.status))
        setLinkedFundReadOnly(readOnly)
        if (readOnly) {
          Alert.alert(
            'Fund is closed',
            'The event budget is read-only because its linked fund is closed.',
            [{ text: 'Back', onPress: () => navigation.goBack() }],
          )
        }
        const code = workspace.budget?.currency_code ?? workspace.event.currency_code ?? 'BWP'
        setCurrency(code)
        setBudget(workspace.budget
          ? Number(workspace.budget.total_budget).toLocaleString('en-BW')
          : '0')
      }).catch(error => {
        if (!active || controller.signal.aborted) return
        setCanManageBudget(false)
        Alert.alert('Budget unavailable', toApiUiError(error, controller.signal).message, [
          { text: 'Go back', onPress: () => navigation.goBack() },
        ])
      })
    return () => { active = false; controller.abort() }
  }, [navigation, route.params.eventId]))

  function handleBudgetChange(text: string) {
    const cleaned = text.replace(/[^0-9,]/g, '')
    setBudget(cleaned || '0')
  }

  async function saveBudget() {
    if (!canManageBudget) return
    const amount = Number(budget.replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0 || isSaving) {
      Alert.alert('Enter a budget', 'The budget must be greater than zero.')
      return
    }
    if (linkedFundReadOnly) {
      Alert.alert('Fund is closed', 'The event budget cannot be changed after its linked fund is closed.')
      return
    }
    setIsSaving(true)
    try {
      await api.events.updateBudget(route.params.eventId, {
        total_budget: String(amount),
        currency_code: currency,
      })
      Alert.alert('Budget saved', 'Your event budget is up to date.')
    } catch (error) {
      Alert.alert('Could not save budget', toApiUiError(error).message)
    } finally {
      setIsSaving(false)
    }
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
              editable={canManageBudget === true && !isSaving}
            />
          </View>

          <Text style={styles.quickLabel}>Quick amounts</Text>
          <View style={styles.presetsRow}>
            {PRESETS.map(value => (
              <TouchableOpacity
                key={value}
                style={[styles.presetChip, budget === value && styles.presetChipActive]}
                onPress={() => setBudget(value)}
                disabled={canManageBudget !== true || isSaving}
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
            <Text style={styles.linkFundEyebrow}>{hasLinkedFund ? 'LINKED FUND' : 'CONTRIBUTIONS'}</Text>
            <Text style={styles.linkFundTitle}>{hasLinkedFund ? 'Contribution fund' : 'Fund this event'}</Text>
            <Text style={styles.linkFundText}>{hasLinkedFund ? 'Track contributions and spending' : 'Create Event + Fund to collect contributions'}</Text>
          </View>
          <TouchableOpacity
            style={styles.linkFundButton}
            activeOpacity={0.86}
            onPress={() => {
              if (hasLinkedFund) navigation.navigate('EventDetail', { eventId: route.params.eventId, workspace: 'fund' })
              else Alert.alert('No linked fund', 'Create an Event + Fund from the creation menu to track contributions with a budget.')
            }}
          >
            <Ionicons name={hasLinkedFund ? 'chevron-forward' : 'information-circle-outline'} size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.setBudgetButton}
          activeOpacity={0.86}
          onPress={saveBudget}
          disabled={canManageBudget !== true || isSaving}
        >
          <Text style={styles.setBudgetButtonText}>{isSaving ? 'Saving...' : 'Save budget'}</Text>
        </TouchableOpacity>
      </ScrollView>
      {canManageBudget === null ? <LoadingOverlay /> : null}
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
