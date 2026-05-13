import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'RecordExpense'>
  route: RouteProp<MainStackParamList, 'RecordExpense'>
}

const CATEGORIES = [
  'Funeral Services',
  'Catering',
  'Transport',
  'Venue',
  'Clothing',
  'Flowers & Décor',
  'Printing',
  'Other',
]

const MAX_EXPENSE_BWP = 10000

export default function RecordExpenseScreen({ navigation, route }: Props) {
  const { fundId, fundTitle } = route.params

  const [vendor, setVendor]           = useState('')
  const [category, setCategory]       = useState<string | null>(null)
  const [amountBWP, setAmountBWP]     = useState('')
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split('T')[0]  // default today YYYY-MM-DD
  )
  const [notes, setNotes]             = useState('')
  const [receiptUri, setReceiptUri]   = useState<string | null>(null)

  const parsedAmount = parseFloat(amountBWP.replace(/,/g, ''))
  const amountValid  = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= MAX_EXPENSE_BWP

  const isValid = vendor.trim().length >= 2 && amountValid

  function handleAmountChange(text: string) {
    setAmountBWP(text.replace(/[^0-9.]/g, ''))
  }

  function handleDateChange(text: string) {
    // Allow digits and dashes only, auto-insert dashes
    const digits = text.replace(/\D/g, '').slice(0, 8)
    let formatted = digits
    if (digits.length > 4) formatted = digits.slice(0, 4) + '-' + digits.slice(4)
    if (digits.length > 6) formatted = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6)
    setExpenseDate(formatted)
  }

  async function handlePickReceipt() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach a receipt.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (!result.canceled && result.assets.length > 0) {
      setReceiptUri(result.assets[0].uri)
    }
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to photograph a receipt.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    })
    if (!result.canceled && result.assets.length > 0) {
      setReceiptUri(result.assets[0].uri)
    }
  }

  function handleReceiptOptions() {
    Alert.alert('Attach Receipt', 'Choose a source', [
      { text: 'Take Photo',       onPress: handleTakePhoto },
      { text: 'Choose from Library', onPress: handlePickReceipt },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ─────────────────────────────── */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.heading}>Record Expense</Text>
            <Text style={styles.subheading} numberOfLines={1}>{fundTitle}</Text>
          </View>

          {/* ── Vendor ─────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Vendor / Payee</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mmoloki Funeral Home"
              placeholderTextColor={colors.textMuted}
              value={vendor}
              onChangeText={setVendor}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* ── Category ───────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Category <Text style={styles.optional}>(optional)</Text></Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryPill,
                    category === cat && styles.categoryPillActive,
                  ]}
                  onPress={() => setCategory(category === cat ? null : cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.categoryPillText,
                    category === cat && styles.categoryPillTextActive,
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── Amount ─────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Amount (BWP)</Text>
            <View style={styles.currencyRow}>
              <View style={styles.currencyPrefix}>
                <Text style={styles.currencySymbol}>P</Text>
              </View>
              <TextInput
                style={styles.currencyInput}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={amountBWP}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            {amountBWP !== '' && !amountValid && (
              <Text style={styles.errorText}>
                {parsedAmount > MAX_EXPENSE_BWP
                  ? `Exceeds sandbox cap of BWP ${MAX_EXPENSE_BWP.toLocaleString()}`
                  : 'Enter a valid amount'}
              </Text>
            )}
          </View>

          {/* ── Expense date ───────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Date of Expense</Text>
            <View style={styles.dateRow}>
              <Text style={styles.dateIcon}>📅</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={expenseDate}
                onChangeText={handleDateChange}
                keyboardType="number-pad"
                maxLength={10}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* ── Receipt ────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Receipt <Text style={styles.optional}>(optional)</Text></Text>

            {receiptUri ? (
              <View style={styles.receiptPreview}>
                <Image source={{ uri: receiptUri }} style={styles.receiptImage} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeReceiptBtn}
                  onPress={() => setReceiptUri(null)}
                >
                  <Text style={styles.removeReceiptText}>✕ Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.receiptUploadBox}
                onPress={handleReceiptOptions}
                activeOpacity={0.8}
              >
                <Text style={styles.receiptUploadEmoji}>📷</Text>
                <Text style={styles.receiptUploadTitle}>Attach Receipt</Text>
                <Text style={styles.receiptUploadHint}>Photo or from library</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Notes ──────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any additional context…"
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              maxLength={200}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{notes.length}/200</Text>
          </View>

          {/* ── Audit note ─────────────────────────── */}
          <View style={styles.auditCard}>
            <Text style={styles.auditText}>
              🔒 This expense will be recorded in the fund's audit log with your name and a timestamp. It cannot be deleted.
            </Text>
          </View>

          {/* ── Submit ─────────────────────────────── */}
          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.buttonDisabled]}
            activeOpacity={isValid ? 0.85 : 1}
            onPress={() => {
              if (!isValid) return
              // TODO: upload receipt to Supabase storage, then insert into expenses
              navigation.goBack()
            }}
          >
            <Text style={[styles.primaryButtonText, !isValid && styles.buttonTextDisabled]}>
              Save Expense
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  header: {
    marginBottom: 28,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  field: {
    marginBottom: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optional: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'none',
    fontWeight: '400',
    letterSpacing: 0,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 88,
    paddingTop: 14,
  },
  categoryScroll: {
    gap: 8,
    paddingRight: 8,
  },
  categoryPill: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  categoryPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryPillTextActive: {
    color: colors.primary,
  },
  currencyRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  dateIcon: {
    fontSize: 18,
  },
  dateInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 15,
  },
  receiptUploadBox: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: colors.surface,
    gap: 6,
  },
  receiptUploadEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  receiptUploadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  receiptUploadHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  receiptPreview: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  receiptImage: {
    width: '100%',
    height: 200,
  },
  removeReceiptBtn: {
    backgroundColor: colors.errorLight,
    padding: 12,
    alignItems: 'center',
  },
  removeReceiptText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.error,
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
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextDisabled: {
    color: colors.disabledText,
  },
})
