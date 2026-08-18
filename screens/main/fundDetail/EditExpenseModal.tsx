import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { api } from '../../../lib/api'
import { hapticSuccess, hapticError } from '../../../lib/haptics'
import { makeCommonStyles } from '../recordExpense/common'
import { CATEGORIES, CategoryOption, MAX_EXPENSE_BWP } from '../recordExpense/categories'
import CategoryPickerModal from '../recordExpense/CategoryPickerModal'
import type { Expense } from './types'

type Props = {
  expense: Expense | null
  currencySymbol: string
  onClose: () => void
  onSaved: (updated: Expense) => void
}

export default function EditExpenseModal({ expense, currencySymbol, onClose, onSaved }: Props) {
  const { colors } = useTheme()
  const common = makeCommonStyles(colors)
  const styles = makeStyles(colors)

  const [name, setName]         = useState('')
  const [vendor, setVendor]     = useState('')
  const [amount, setAmount]     = useState('')
  const [category, setCategory] = useState<CategoryOption | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  useEffect(() => {
    if (!expense) return
    setName(expense.description)
    setVendor(expense.vendor_name ?? '')
    setAmount(String(expense.amount))
    setCategory(CATEGORIES.find(c => c.value === expense.category) ?? null)
  }, [expense?.id])

  const parsedAmount = parseFloat(amount)
  const isValid =
    name.trim().length > 0 &&
    !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= MAX_EXPENSE_BWP

  async function handleSave() {
    if (!expense || !isValid || isSaving) return
    setIsSaving(true)

    try {
      const updated = await api.expenses.update(expense.id, {
        description: name.trim(),
        item_name:   name.trim(),
        vendor_name: vendor.trim() || null,
        amount:      String(parsedAmount),
        category:    category?.value ?? null,
      })
      hapticSuccess()
      onSaved({
        ...expense,
        description: updated.description,
        vendor_name: updated.vendor_name,
        amount: Number(updated.amount),
        category: updated.category,
      })
    } catch (error) {
      hapticError()
      Alert.alert(
        'Could not save changes',
        error instanceof Error ? error.message : 'You need organiser permissions to edit expenses.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal visible={expense !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={common.modalOverlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={common.modalSheet}>
            <Text style={common.modalTitle}>Edit Expense</Text>

            <Text style={styles.fieldLabel}>Item</Text>
            <TextInput
              style={[common.input, styles.inputSpacing]}
              placeholder="e.g. PNP Brown Bread 600g"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              editable={!isSaving}
            />

            <Text style={styles.fieldLabel}>Vendor</Text>
            <TextInput
              style={[common.input, styles.inputSpacing]}
              placeholder="e.g. Choppies Gaborone Mall"
              placeholderTextColor={colors.textMuted}
              value={vendor}
              onChangeText={setVendor}
              autoCapitalize="words"
              editable={!isSaving}
            />

            <View style={styles.splitRow}>
              <View style={styles.splitCol}>
                <Text style={styles.fieldLabel}>Amount ({currencySymbol})</Text>
                <TextInput
                  style={common.input}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={amount}
                  onChangeText={text => setAmount(text.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  editable={!isSaving}
                />
              </View>
              <View style={styles.splitCol}>
                <Text style={styles.fieldLabel}>Category</Text>
                <TouchableOpacity
                  style={[common.input, styles.categoryInput]}
                  onPress={() => setShowCategoryPicker(true)}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  <Text style={category ? styles.categoryValue : styles.categoryPlaceholder} numberOfLines={1}>
                    {category?.label ?? 'Select'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[common.primaryButton, styles.saveButton, isValid && !isSaving && common.buttonActive]}
              onPress={handleSave}
              disabled={isSaving || !isValid}
              activeOpacity={isValid && !isSaving ? 0.85 : 1}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[common.primaryButtonText, isValid && common.primaryButtonTextActive]}>
                  Save Changes
                </Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      <CategoryPickerModal
        visible={showCategoryPicker}
        title="Select Category"
        selected={category}
        onSelect={cat => {
          setCategory(cat)
          setShowCategoryPicker(false)
        }}
        onClose={() => setShowCategoryPicker(false)}
      />
    </Modal>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputSpacing: {
      marginBottom: 18,
    },
    splitRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    splitCol: {
      flex: 1,
    },
    categoryInput: {
      justifyContent: 'center',
    },
    categoryValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    categoryPlaceholder: {
      fontSize: 15,
      color: colors.textMuted,
    },
    saveButton: {
      marginBottom: 8,
    },
  })
}
