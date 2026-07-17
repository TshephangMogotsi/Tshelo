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
import { useAuth } from '../../../context/AuthContext'
import type { AppColors } from '../../../theme/themes'
import { supabase } from '../../../lib/supabase'
import { hapticError, hapticSuccess } from '../../../lib/haptics'
import { makeCommonStyles } from '../recordExpense/common'
import type { Contribution } from './types'

type Props = {
  contribution: Contribution | null
  currencySymbol: string
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

export default function EditContributionModal({ contribution, currencySymbol, onClose, onSaved }: Props) {
  const { colors } = useTheme()
  const { userId } = useAuth()
  const common = makeCommonStyles(colors)
  const styles = makeStyles(colors)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [reference, setReference] = useState('')
  const [status, setStatus] = useState<string>('pending')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!contribution) return
    setName(contribution.contributor_name)
    setAmount(String(contribution.amount))
    setPaymentMethod(contribution.payment_method ?? 'cash')
    setReference(contribution.reference_number ?? '')
    setStatus(contribution.is_refunded ? 'refunded' : contribution.status)
  }, [contribution?.id])

  const parsedAmount = Number(amount)
  const isValid = name.trim().length >= 2 && Number.isFinite(parsedAmount) && parsedAmount > 0

  async function handleSave() {
    if (!contribution || !isValid || isSaving) return
    setIsSaving(true)
    const now = new Date().toISOString()
    const isConfirmed = status === 'confirmed'
    const isRefunded = status === 'refunded'

    const { data, error } = await supabase
      .from('contributions')
      .update({
        contributor_name: name.trim(),
        amount: parsedAmount,
        payment_method: paymentMethod,
        reference_number: reference.trim() || null,
        status,
        is_refunded: isRefunded,
        refunded_at: isRefunded ? now : null,
        confirmed_by: isConfirmed ? userId : null,
        confirmed_at: isConfirmed ? (contribution.confirmed_at ?? now) : null,
        updated_at: now,
      })
      .eq('id', contribution.id)
      .select('id')

    setIsSaving(false)
    if (error || !data?.length) {
      hapticError()
      Alert.alert('Could not save changes', error?.message ?? 'You need organiser permissions to edit contributions.')
      return
    }

    hapticSuccess()
    onSaved({
      ...contribution,
      contributor_name: name.trim(),
      amount: parsedAmount,
      payment_method: paymentMethod,
      reference_number: reference.trim() || null,
      status,
      is_refunded: isRefunded,
      confirmed_at: isConfirmed ? (contribution.confirmed_at ?? now) : null,
    })
  }

  return (
    <Modal visible={contribution !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={common.modalOverlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={[common.modalSheet, styles.sheet]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={common.modalTitle}>Edit Contribution</Text>

              <Text style={styles.label}>Contributor</Text>
              <TextInput
                style={[common.input, styles.inputSpacing]}
                value={name}
                onChangeText={setName}
                placeholder="Contributor name"
                placeholderTextColor={colors.textMuted}
                editable={!isSaving}
              />

              <Text style={styles.label}>Amount ({currencySymbol})</Text>
              <TextInput
                style={[common.input, styles.inputSpacing]}
                value={amount}
                onChangeText={text => setAmount(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                editable={!isSaving}
              />

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

              <Text style={styles.label}>Status</Text>
              <View style={styles.chipRow}>
                {STATUSES.map(([value, label]) => (
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
