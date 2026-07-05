import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator } from 'react-native'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { makeCommonStyles } from './common'
import CategoryPickerModal from './CategoryPickerModal'
import { CategoryOption, CATEGORIES } from './categories'
import type { ParsedReceipt } from './receipt'

export type ReviewItem = {
  id:       string
  name:     string
  category: CategoryOption | null
  amount:   string
  included: boolean
}

function newReviewItem(): ReviewItem {
  return { id: `${Date.now()}-${Math.random()}`, name: '', category: null, amount: '', included: true }
}

type Props = {
  fundTitle: string
  receiptUri: string | null
  currencySymbol: string
  isSaving: boolean
  isParsing?: boolean
  prefill?: ParsedReceipt | null
  onSave: (shopName: string, includedItems: ReviewItem[]) => void
}

export default function ReviewStep({ fundTitle, receiptUri, currencySymbol, isSaving, isParsing = false, prefill = null, onSave }: Props) {
  const { colors } = useTheme()
  const common = makeCommonStyles(colors)
  const styles = makeStyles(colors)

  const [shopName, setShopName] = useState('')
  const [items, setItems]       = useState<ReviewItem[]>([newReviewItem()])
  const [categoryModalItemId, setCategoryModalItemId] = useState<string | null>(null)
  const [wasPrefilled, setWasPrefilled] = useState(false)

  // Prefill from the scanned receipt, but never overwrite what the user
  // has already typed while the parse was in flight
  useEffect(() => {
    if (!prefill) return
    if (prefill.vendor) {
      setShopName(prev => (prev.trim() ? prev : prefill.vendor!))
    }
    if (prefill.items.length > 0) {
      setItems(prev => {
        const untouched = prev.length === 1 && !prev[0].name.trim() && !prev[0].amount
        if (!untouched) return prev
        setWasPrefilled(true)
        return prefill.items.map(item => ({
          id:       `${Date.now()}-${Math.random()}`,
          name:     item.name,
          category: CATEGORIES.find(c => c.value === item.category) ?? null,
          amount:   item.amount > 0 ? String(item.amount) : '',
          included: true,
        }))
      })
    }
  }, [prefill])

  const includedItems = items.filter(i => i.included)
  const reviewTotal   = includedItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const isReviewValid =
    shopName.trim().length >= 2 &&
    includedItems.length > 0 &&
    includedItems.every(i => i.name.trim().length > 0 && !isNaN(parseFloat(i.amount)) && parseFloat(i.amount) > 0)

  function updateItem(id: string, patch: Partial<ReviewItem>) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <>
      <View style={common.header}>
        <Text style={common.heading}>Review Receipt</Text>
        <Text style={common.subheading} numberOfLines={1}>{fundTitle}</Text>
      </View>

      {receiptUri ? (
        <Image source={{ uri: receiptUri }} style={styles.receiptThumb} resizeMode="cover" />
      ) : null}

      {isParsing ? (
        <View style={[styles.bannerCard, styles.bannerCardParsing]}>
          <View style={styles.bannerParsingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.bannerTitle, { color: colors.primary }]}>Reading your receipt…</Text>
          </View>
          <Text style={styles.bannerHint}>You can start typing — we'll only fill in what's still empty</Text>
        </View>
      ) : wasPrefilled ? (
        <View style={styles.bannerCard}>
          <Text style={styles.bannerTitle}>✓ Receipt read</Text>
          <Text style={styles.bannerHint}>Check the items and amounts below before saving</Text>
        </View>
      ) : (
        <View style={styles.bannerCard}>
          <Text style={styles.bannerTitle}>✓ Receipt captured</Text>
          <Text style={styles.bannerHint}>Add the shop and items below</Text>
        </View>
      )}

      <View style={common.field}>
        <Text style={common.label}>Shop / Vendor</Text>
        <TextInput
          style={common.input}
          placeholder="e.g. Choppies Gaborone Mall"
          placeholderTextColor={colors.textMuted}
          value={shopName}
          onChangeText={setShopName}
          autoCapitalize="words"
          editable={!isSaving}
        />
      </View>

      <View style={styles.itemsHeaderRow}>
        <Text style={common.label}>Items ({items.length})</Text>
        <TouchableOpacity onPress={() => setItems(prev => [...prev, newReviewItem()])} disabled={isSaving}>
          <Text style={styles.addItemText}>+ Add item</Text>
        </TouchableOpacity>
      </View>

      {items.map(item => (
        <View key={item.id} style={styles.itemRow}>
          <TouchableOpacity
            style={[styles.itemCheckbox, item.included && styles.itemCheckboxActive]}
            onPress={() => updateItem(item.id, { included: !item.included })}
            disabled={isSaving}
          >
            {item.included && <Text style={styles.itemCheckboxMark}>✓</Text>}
          </TouchableOpacity>

          <View style={styles.itemBody}>
            <View style={styles.itemTopRow}>
              <TextInput
                style={styles.itemNameInput}
                placeholder="Item name"
                placeholderTextColor={colors.textMuted}
                value={item.name}
                onChangeText={text => updateItem(item.id, { name: text })}
                editable={!isSaving}
              />
              <TextInput
                style={styles.itemAmountInput}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={item.amount}
                onChangeText={text => updateItem(item.id, { amount: text.replace(/[^0-9.]/g, '') })}
                keyboardType="decimal-pad"
                editable={!isSaving}
              />
            </View>
            <View style={styles.itemBottomRow}>
              <TouchableOpacity
                style={[styles.categoryChip, item.category && { borderColor: colors.primary }]}
                onPress={() => setCategoryModalItemId(item.id)}
                disabled={isSaving}
              >
                <Text style={styles.categoryChipText}>{item.category?.label ?? 'Category'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeItem(item.id)} disabled={isSaving}>
                <Text style={styles.removeItemText}>✕ Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      <View style={styles.totalStrip}>
        <Text style={styles.totalLabel}>Counts against fund</Text>
        <Text style={styles.totalValue}>{currencySymbol} {reviewTotal.toLocaleString('en-BW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
      </View>

      <TouchableOpacity
        style={[common.primaryButton, isReviewValid && !isSaving && common.buttonActive]}
        activeOpacity={isReviewValid && !isSaving ? 0.85 : 1}
        onPress={() => onSave(shopName, includedItems)}
        disabled={isSaving || !isReviewValid}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={[common.primaryButtonText, isReviewValid && common.primaryButtonTextActive]}>
            Save Expense
          </Text>
        )}
      </TouchableOpacity>

      <CategoryPickerModal
        visible={categoryModalItemId !== null}
        title="Select Category"
        selected={items.find(i => i.id === categoryModalItemId)?.category ?? null}
        onSelect={cat => {
          if (categoryModalItemId) updateItem(categoryModalItemId, { category: cat })
          setCategoryModalItemId(null)
        }}
        onClose={() => setCategoryModalItemId(null)}
      />
    </>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    receiptThumb: {
      width: '100%',
      height: 160,
      borderRadius: 16,
      marginBottom: 16,
    },
    bannerCard: {
      backgroundColor: colors.successLight,
      borderRadius: 12,
      padding: 14,
      marginBottom: 20,
    },
    bannerCardParsing: {
      backgroundColor: colors.primaryLight,
    },
    bannerParsingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    bannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.success,
      marginBottom: 2,
    },
    bannerHint: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    itemsHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    addItemText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 10,
    },
    itemCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    itemCheckboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    itemCheckboxMark: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
    itemBody: {
      flex: 1,
    },
    itemTopRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    itemNameInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 4,
    },
    itemAmountInput: {
      width: 80,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'right',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 4,
    },
    itemBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    categoryChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    categoryChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    removeItemText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.error,
    },
    totalStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
    },
    totalLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    totalValue: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.primary,
    },
  })
}
