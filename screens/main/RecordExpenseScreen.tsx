import { useEffect, useState } from 'react'
import {
  Text, StyleSheet, TouchableOpacity, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { supabase } from '../../lib/supabase'
import { hapticSuccess, hapticError } from '../../lib/haptics'
import type { AppColors } from '../../theme/themes'
import { CategoryOption, MAX_EXPENSE_BWP } from './recordExpense/categories'
import { pickFromLibrary, takePhoto, uploadReceipt } from './recordExpense/receipt'
import ChooseMethodStep from './recordExpense/ChooseMethodStep'
import ManualEntryStep, { PayerOption } from './recordExpense/ManualEntryStep'
import ReviewStep, { ReviewItem } from './recordExpense/ReviewStep'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'RecordExpense'>
  route:      RouteProp<MainStackParamList, 'RecordExpense'>
}

type Step = 'choose' | 'manual' | 'review'

export default function RecordExpenseScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const { userId, userName } = useAuth()
  const requireOnline = useRequireOnline()
  const styles = makeStyles(colors)

  const { fundId, fundTitle, currencyCode } = route.params
  const currencySymbol = currencyCode === 'BWP' ? 'P' : currencyCode

  const [step, setStep]               = useState<Step>('choose')
  const [receiptUri, setReceiptUri]   = useState<string | null>(null)
  const [isSaving, setIsSaving]       = useState(false)
  const [payers, setPayers]           = useState<PayerOption[]>([])

  // ── Manual entry state ──────────────────────────────────
  const [vendor, setVendor]           = useState('')
  const [category, setCategory]       = useState<CategoryOption | null>(null)
  const [location, setLocation]       = useState('')
  const [description, setDescription] = useState('')
  const [amountBWP, setAmountBWP]     = useState('')
  const [paidBy, setPaidBy]           = useState('self')

  useEffect(() => {
    let active = true
    async function loadPayers() {
      const [{ data: memberRows }, { data: profiles }] = await Promise.all([
        supabase.from('fund_members').select('user_id').eq('fund_id', fundId).eq('status', 'joined'),
        supabase.rpc('get_fund_member_profiles', { p_fund_id: fundId }),
      ])

      if (!active || !memberRows) return

      const nameByUserId = new Map<string, string>(
        (profiles ?? []).map((p: any) => [p.user_id, p.name])
      )

      const others = memberRows
        .filter(m => m.user_id && m.user_id !== userId)
        .map(m => ({
          id:     m.user_id as string,
          userId: m.user_id as string,
          name:   nameByUserId.get(m.user_id as string) ?? 'Member',
        }))

      setPayers(others)
    }
    loadPayers()
    return () => { active = false }
  }, [fundId, userId])

  const parsedAmount = parseFloat(amountBWP.replace(/,/g, ''))
  const amountValid  = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= MAX_EXPENSE_BWP
  const isManualValid = vendor.trim().length >= 2 && amountValid

  async function handleScanReceipt() {
    const uri = await takePhoto()
    if (!uri) return
    setReceiptUri(uri)
    setStep('review')
  }

  async function handleUploadReceipt() {
    const uri = await pickFromLibrary()
    if (!uri) return
    setReceiptUri(uri)
    setStep('review')
  }

  function handleBack() {
    if (step === 'choose') {
      navigation.goBack()
      return
    }
    setStep('choose')
    setReceiptUri(null)
  }

  async function handleSaveManual() {
    if (!isManualValid || isSaving || !userId) return
    if (!requireOnline()) return
    setIsSaving(true)

    try {
      let receiptUrl: string | null = null
      if (receiptUri) {
        receiptUrl = await uploadReceipt(fundId, userId, receiptUri)
      }

      const baseDescription = description.trim() || vendor.trim()
      const finalDescription = location.trim()
        ? `${baseDescription} · ${location.trim()}`
        : baseDescription

      const payer = paidBy !== 'self' ? payers.find(p => p.id === paidBy) : null

      const { error } = await supabase.from('expenses').insert({
        fund_id:       fundId,
        added_by:      userId,
        description:   finalDescription,
        vendor_name:   vendor.trim(),
        amount:        parsedAmount,
        currency_code: currencyCode,
        ...(category   ? { category: category.value } : {}),
        ...(receiptUrl ? { receipt_url: receiptUrl }  : {}),
        ...(payer      ? { is_sponsored: true, sponsored_by_user_id: payer.userId, sponsored_by_name: payer.name } : {}),
      })

      if (error) {
        hapticError()
        Alert.alert('Could not save expense', error.message)
        return
      }

      hapticSuccess()
      navigation.goBack()
    } catch (e) {
      hapticError()
      Alert.alert('Could not save expense', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveReview(shopName: string, includedItems: ReviewItem[]) {
    if (isSaving || !userId) return
    setIsSaving(true)

    try {
      let receiptUrl: string | null = null
      if (receiptUri) {
        receiptUrl = await uploadReceipt(fundId, userId, receiptUri)
      }

      const rows = includedItems.map(item => ({
        fund_id:       fundId,
        added_by:      userId,
        description:   item.name.trim(),
        item_name:     item.name.trim(),
        vendor_name:   shopName.trim(),
        amount:        parseFloat(item.amount),
        quantity:      1,
        unit_price:    parseFloat(item.amount),
        currency_code: currencyCode,
        ...(item.category ? { category: item.category.value } : {}),
        ...(receiptUrl    ? { receipt_url: receiptUrl }        : {}),
      }))

      const { error } = await supabase.from('expenses').insert(rows)

      if (error) {
        hapticError()
        Alert.alert('Could not save expense', error.message)
        return
      }

      hapticSuccess()
      navigation.goBack()
    } catch (e) {
      hapticError()
      Alert.alert('Could not save expense', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={isSaving}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          {step === 'choose' && (
            <ChooseMethodStep
              fundTitle={fundTitle}
              onScan={handleScanReceipt}
              onUpload={handleUploadReceipt}
              onManual={() => setStep('manual')}
            />
          )}

          {step === 'manual' && (
            <ManualEntryStep
              fundTitle={fundTitle}
              currencySymbol={currencySymbol}
              isSaving={isSaving}
              userName={userName}
              payers={payers}
              vendor={vendor}
              onVendorChange={setVendor}
              category={category}
              onCategoryChange={setCategory}
              location={location}
              onLocationChange={setLocation}
              description={description}
              onDescriptionChange={setDescription}
              amountBWP={amountBWP}
              onAmountChange={text => setAmountBWP(text.replace(/[^0-9.]/g, ''))}
              parsedAmount={parsedAmount}
              paidBy={paidBy}
              onPaidByChange={setPaidBy}
              receiptUri={receiptUri}
              onReceiptChange={setReceiptUri}
              isValid={isManualValid}
              onSave={handleSaveManual}
            />
          )}

          {step === 'review' && (
            <ReviewStep
              fundTitle={fundTitle}
              receiptUri={receiptUri}
              currencySymbol={currencySymbol}
              isSaving={isSaving}
              onSave={handleSaveReview}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
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
  })
}
