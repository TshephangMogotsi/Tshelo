import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { api } from '../../../lib/api'
import { hapticError, hapticSuccess } from '../../../lib/haptics'
import { makeCommonStyles } from '../recordExpense/common'
import type { Contribution } from './types'
import type { PaymentMethod } from '@shared/contracts'

type Props = {
  contribution: Contribution | null
  currencySymbol: string
  canRefund: boolean
  onClose: () => void
  onSaved: (updated: Contribution) => void
}

const PAYMENT_METHODS = [
  ['orange_money', 'Orange Money'],
  ['myzaka', 'MyZaka'],
  ['smega', 'Smega'],
  ['bank_transfer', 'Bank'],
  ['cash', 'Cash'],
  ['other', 'Other'],
] as const

const STATUSES = [
  ['pledged', 'Pledged'],
  ['pending', 'Pending'],
  ['confirmed', 'Confirmed'],
  ['refunded', 'Refunded'],
  ['disputed', 'Disputed'],
] as const

export default function EditContributionModal({ contribution, currencySymbol, canRefund, onClose, onSaved }: Props) {
  const { colors } = useTheme()
  const common = makeCommonStyles(colors)
  const styles = makeStyles(colors)

  const [amount, setAmount] = useState('')
  const [pledgedAmount, setPledgedAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [status, setStatus] = useState<string>('pending')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!contribution) return
    setAmount(String(contribution.amount))
    setPledgedAmount(contribution.pledged_amount == null ? '' : String(contribution.pledged_amount))
    setPaymentMethod(PAYMENT_METHODS.some(([value]) => value === contribution.payment_method)
      ? contribution.payment_method as PaymentMethod
      : 'other')
    setReference(contribution.reference_number ?? '')
    setStatus(contribution.is_refunded ? 'refunded' : contribution.status)
  }, [contribution?.id])

  const parsedAmount = Number(amount)
  const parsedPledgedAmount = pledgedAmount.trim() === '' ? null : Number(pledgedAmount)
  const pledgeValid = parsedPledgedAmount === null || (Number.isFinite(parsedPledgedAmount) && parsedPledgedAmount > 0)
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0 && pledgeValid

  async function handleSave() {
    if (!contribution || !isValid || isSaving) return
    setIsSaving(true)
    const isRefunded = status === 'refunded'
    const nextPledgedAmount = status === 'pledged' ? parsedAmount : parsedPledgedAmount
    try {
      let updated = await api.contributions.update(contribution.id, {
        amount: String(parsedAmount),
        pledged_amount: nextPledgedAmount === null ? null : String(nextPledgedAmount),
        payment_method: status === 'pledged' ? null : paymentMethod,
        reference_number: reference.trim() || null,
        ...(isRefunded ? {} : { status: status as 'pledged' | 'pending' | 'confirmed' | 'disputed' }),
      })
      if (isRefunded && !contribution.is_refunded) {
        updated = await api.contributions.refund(contribution.id)
      }
      hapticSuccess()
      onSaved({
        ...contribution,
        amount: Number(updated.amount),
        pledged_amount: updated.pledged_amount === null ? null : Number(updated.pledged_amount),
        payment_method: updated.payment_method,
        reference_number: updated.reference_number,
        status: updated.status,
        is_refunded: updated.is_refunded,
        confirmed_at: updated.confirmed_at,
      })
    } catch (error) {
      hapticError()
      Alert.alert('Could not save changes', error instanceof Error ? error.message : 'You need organiser permissions to edit contributions.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal visible={contribution !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={common.modalOverlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={[common.modalSheet, styles.sheet]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={common.modalTitle}>Edit Contribution</Text>

              <Text style={styles.label}>Contributor</Text>
              <View style={styles.identityCard}>
                <Text style={styles.identityName}>{contribution?.contributor_name}</Text>
                <Text style={styles.identityHint}>
                  Contributor identity is kept separate from transaction corrections.
                </Text>
              </View>

              <Text style={styles.label}>{status === 'pledged' ? 'Pledged amount' : 'Amount received'} ({currencySymbol})</Text>
              <TextInput
                style={[common.input, styles.inputSpacing]}
                value={amount}
                onChangeText={text => setAmount(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                editable={!isSaving}
              />

              {status !== 'pledged' && (
                <>
                  <Text style={styles.label}>Original pledge ({currencySymbol}) <Text style={styles.optional}>(optional)</Text></Text>
                  <TextInput
                    style={[common.input, styles.inputSpacing]}
                    value={pledgedAmount}
                    onChangeText={text => setPledgedAmount(text.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="No prior pledge"
                    placeholderTextColor={colors.textMuted}
                    editable={!isSaving}
                  />
                </>
              )}

              {status !== 'pledged' && <>
                <Text style={styles.label}>Payment method</Text>
                <View style={styles.chipRow}>
                {PAYMENT_METHODS.map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.chip, paymentMethod === value && styles.chipActive]}
                    onPress={() => setPaymentMethod(value)}
                    disabled={isSaving}
                  >
                    <Text style={[styles.chipText, paymentMethod === value && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
                </View>

                <Text style={styles.label}>Reference</Text>
                <TextInput
                  style={[common.input, styles.inputSpacing]}
                  value={reference}
                  onChangeText={setReference}
                  placeholder="Transaction or receipt reference"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  maxLength={100}
                  editable={!isSaving}
                />
              </>}

              <Text style={styles.label}>Status</Text>
              <View style={styles.chipRow}>
                {STATUSES.filter(([value]) => value !== 'refunded' || canRefund).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.chip, status === value && styles.chipActive]}
                    onPress={() => setStatus(value)}
                    disabled={isSaving}
                  >
                    <Text style={[styles.chipText, status === value && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[common.primaryButton, styles.saveButton, isValid && !isSaving && common.buttonActive]}
                onPress={handleSave}
                disabled={!isValid || isSaving}
                activeOpacity={isValid && !isSaving ? 0.85 : 1}
              >
                {isSaving ? <ActivityIndicator color="#FFFFFF" /> : (
                  <Text style={[common.primaryButtonText, isValid && common.primaryButtonTextActive]}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    sheet: { maxHeight: '88%' },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    optional: {
      fontSize: 10,
      fontWeight: '500',
      color: colors.textMuted,
      textTransform: 'none',
      letterSpacing: 0,
    },
    identityCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.background,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 18,
    },
    identityName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    identityHint: {
      marginTop: 4,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textMuted,
    },
    inputSpacing: { marginBottom: 18 },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 11,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    chipTextActive: { color: '#FFFFFF' },
    saveButton: { marginTop: 4, marginBottom: 8 },
  })
}
