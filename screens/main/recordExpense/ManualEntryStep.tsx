import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { makeCommonStyles } from './common'
import CategoryPickerModal from './CategoryPickerModal'
import { CATEGORIES, CategoryOption, categoryColor, MAX_EXPENSE_BWP } from './categories'

export type PayerOption = { id: string; userId: string | null; name: string }

type Props = {
  fundTitle: string
  currencySymbol: string
  isSaving: boolean
  userName: string
  payers: PayerOption[]
  vendor: string
  onVendorChange: (text: string) => void
  category: CategoryOption | null
  onCategoryChange: (category: CategoryOption | null) => void
  location: string
  onLocationChange: (text: string) => void
  description: string
  onDescriptionChange: (text: string) => void
  amountBWP: string
  onAmountChange: (text: string) => void
  parsedAmount: number
  paidBy: string
  onPaidByChange: (id: string) => void
  isValid: boolean
  onSave: () => void
}

export default function ManualEntryStep({
  fundTitle,
  currencySymbol,
  isSaving,
  userName,
  payers,
  vendor,
  onVendorChange,
  category,
  onCategoryChange,
  location,
  onLocationChange,
  description,
  onDescriptionChange,
  amountBWP,
  onAmountChange,
  parsedAmount,
  paidBy,
  onPaidByChange,
  isValid,
  onSave,
}: Props) {
  const { colors } = useTheme()
  const common = makeCommonStyles(colors)
  const styles = makeStyles(colors)

  const [showPayerPicker, setShowPayerPicker] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  const amountValid = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= MAX_EXPENSE_BWP

  return (
    <>
      <View style={common.header}>
        <Text style={common.heading}>Manual Entry</Text>
        <Text style={common.subheading} numberOfLines={1}>{fundTitle}</Text>
      </View>

      <View style={common.field}>
        <Text style={common.label}>Expense Category <Text style={common.optional}>(optional)</Text></Text>
        <TouchableOpacity
          style={styles.dropdownField}
          onPress={() => !isSaving && setShowCategoryPicker(true)}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          {category ? (
            <View style={[
              styles.categoryDot,
              { backgroundColor: categoryColor(CATEGORIES.findIndex(c => c.value === category.value)) },
            ]} />
          ) : null}
          <Text style={styles.dropdownFieldText}>{category ? category.label : 'Select a category'}</Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <CategoryPickerModal
        visible={showCategoryPicker}
        title="Expense Category"
        selected={category}
        onSelect={cat => {
          onCategoryChange(category?.value === cat.value ? null : cat)
          setShowCategoryPicker(false)
        }}
        onClose={() => setShowCategoryPicker(false)}
      />

      <View style={common.field}>
        <Text style={common.label}>Shop / Vendor</Text>
        <TextInput
          style={common.input}
          placeholder="e.g. Mmoloki Funeral Home"
          placeholderTextColor={colors.textMuted}
          value={vendor}
          onChangeText={onVendorChange}
          autoCapitalize="words"
          returnKeyType="next"
          editable={!isSaving}
        />
      </View>

      <View style={common.field}>
        <Text style={common.label}>Location <Text style={common.optional}>(optional)</Text></Text>
        <TextInput
          style={common.input}
          placeholder="e.g. Tlokweng, Gaborone"
          placeholderTextColor={colors.textMuted}
          value={location}
          onChangeText={onLocationChange}
          returnKeyType="next"
          editable={!isSaving}
        />
      </View>

      <View style={common.field}>
        <Text style={common.label}>Description <Text style={common.optional}>(optional)</Text></Text>
        <TextInput
          style={[common.input, common.textArea]}
          placeholder="Any additional context…"
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={onDescriptionChange}
          maxLength={200}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!isSaving}
        />
        <Text style={styles.charCount}>{description.length}/200</Text>
      </View>

      <View style={common.field}>
        <Text style={common.label}>Amount ({currencySymbol})</Text>
        <View style={styles.currencyRow}>
          <View style={styles.currencyPrefix}>
            <Text style={styles.currencySymbol}>{currencySymbol}</Text>
          </View>
          <TextInput
            style={styles.currencyInput}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            value={amountBWP}
            onChangeText={onAmountChange}
            keyboardType="decimal-pad"
            returnKeyType="next"
            editable={!isSaving}
          />
        </View>
        {amountBWP !== '' && !amountValid && (
          <Text style={styles.errorText}>
            {parsedAmount > MAX_EXPENSE_BWP
              ? `Exceeds sandbox cap of P ${MAX_EXPENSE_BWP.toLocaleString()}`
              : 'Enter a valid amount'}
          </Text>
        )}
      </View>

      {payers.length > 0 && (
        <View style={common.field}>
          <Text style={common.label}>Paid By</Text>
          <TouchableOpacity
            style={styles.dropdownField}
            onPress={() => !isSaving && setShowPayerPicker(true)}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            <View style={styles.radioAvatar}>
              <Text style={styles.radioAvatarText}>
                {(paidBy === 'self' ? userName : payers.find(p => p.id === paidBy)?.name ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.dropdownFieldText}>
              {paidBy === 'self' ? 'Me' : payers.find(p => p.id === paidBy)?.name ?? 'Me'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showPayerPicker} transparent animationType="slide" onRequestClose={() => setShowPayerPicker(false)}>
        <TouchableOpacity style={common.modalOverlay} activeOpacity={1} onPress={() => setShowPayerPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={common.modalSheet}>
            <Text style={common.modalTitle}>Paid By</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.radioRow}
                onPress={() => { onPaidByChange('self'); setShowPayerPicker(false) }}
              >
                <View style={styles.radioAvatar}>
                  <Text style={styles.radioAvatarText}>{userName ? userName.charAt(0).toUpperCase() : 'M'}</Text>
                </View>
                <Text style={styles.radioLabel}>Me</Text>
                <View style={[styles.radioCircle, paidBy === 'self' && styles.radioCircleActive]} />
              </TouchableOpacity>
              {payers.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.radioRow}
                  onPress={() => { onPaidByChange(p.id); setShowPayerPicker(false) }}
                >
                  <View style={styles.radioAvatar}>
                    <Text style={styles.radioAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.radioLabel}>{p.name}</Text>
                  <View style={[styles.radioCircle, paidBy === p.id && styles.radioCircleActive]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={styles.auditCard}>
        <Text style={styles.auditText}>
          🔒 This expense will be recorded in the fund's audit log with your name and a timestamp. It cannot be deleted.
        </Text>
      </View>

      <TouchableOpacity
        style={[common.primaryButton, isValid && !isSaving && common.buttonActive]}
        activeOpacity={isValid && !isSaving ? 0.85 : 1}
        onPress={onSave}
        disabled={isSaving || !isValid}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={[common.primaryButtonText, isValid && common.primaryButtonTextActive]}>
            Save Expense
          </Text>
        )}
      </TouchableOpacity>
    </>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    categoryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dropdownField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
    },
    dropdownFieldText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    radioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
    },
    radioAvatar: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioAvatarText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },
    radioLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    radioCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    radioCircleActive: {
      borderWidth: 6,
      borderColor: colors.primary,
    },
    currencyRow: {
      flexDirection: 'row',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    currencyPrefix: {
      paddingHorizontal: 16,
      paddingVertical: 15,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: colors.background,
      justifyContent: 'center',
    },
    currencySymbol: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    currencyInput: {
      flex: 1,
      fontSize: 16,
      color: colors.textPrimary,
      paddingHorizontal: 16,
      paddingVertical: 15,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
    charCount: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'right',
      marginTop: 4,
    },
    auditCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      padding: 14,
      marginBottom: 24,
    },
    auditText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  })
}
