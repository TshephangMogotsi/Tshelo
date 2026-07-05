import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { AuthStackParamList, BankAccount, MobileMoneyNumber } from '../../navigation/types'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../context/ThemeContext'
import ProviderLogo from '../../components/ProviderLogo'
import { PROVIDER_LABELS, detectProviderOrUnknown as detectProvider } from '../../lib/providers'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'BankDetails'>
  route:      RouteProp<AuthStackParamList, 'BankDetails'>
}

type Bank = { name: string; branchCode: string }
const BANKS: Bank[] = [
  { name: 'First National Bank',   branchCode: '282267' },
  { name: 'Standard Chartered',    branchCode: '662167' },
  { name: 'Stanbic Bank',          branchCode: '060144' },
  { name: 'ABSA',                  branchCode: '290099' },
  { name: 'Access Bank',           branchCode: '061067' },
  { name: 'BBS',                   branchCode: '340099' },
  { name: 'Other',                 branchCode: ''       },
]

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^267/, '')
  return digits.length === 8 ? `+267 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}` : phone
}

function maskAccount(accountNumber: string) {
  const digits = accountNumber.replace(/\D/g, '')
  return `****${digits.slice(-4)}`
}

export default function BankDetailsScreen({ navigation, route }: Props) {
  const { isDark } = useTheme()
  const bg        = isDark ? '#1A1C24' : '#F4F2EB'
  const inputBg   = isDark ? '#2D2E41' : '#FFFFFF'
  const textCol   = isDark ? '#F2F2F7' : '#1A1A2E'
  const mutedCol  = isDark ? '#8A8A9A' : '#9A9A9A'
  const borderCol = isDark ? '#3A3A5C' : '#E5E7EB'

  const [selectedBank,    setSelectedBank]    = useState<Bank | null>(null)
  const [accountNumber,   setAccountNumber]   = useState('')
  const [branchCode,      setBranchCode]      = useState('')
  const [bankAccounts,    setBankAccounts]    = useState<BankAccount[]>([])
  const [showBankPicker,  setShowBankPicker]  = useState(false)
  const [mobileNumber,    setMobileNumber]    = useState('')
  const [mobileMoneyNumbers, setMobileMoneyNumbers] = useState<MobileMoneyNumber[]>([])
  const registeredPhone = route.params?.registeredPhone

  const hasBankDetails =
    selectedBank !== null &&
    accountNumber.replace(/\D/g, '').length >= 8

  useEffect(() => {
    if (route.params?.bankName) {
      const bank = BANKS.find(b => b.name === route.params?.bankName) ?? { name: route.params.bankName, branchCode: route.params.branchCode ?? '' }
      setSelectedBank(bank)
    }
    if (route.params?.branchCode !== undefined) setBranchCode(route.params.branchCode)
    if (route.params?.accountNumber !== undefined) setAccountNumber(route.params.accountNumber)
    if (route.params?.bankAccounts) setBankAccounts(route.params.bankAccounts)
    if (route.params?.mobileMoneyNumbers) {
      setMobileMoneyNumbers(route.params.mobileMoneyNumbers)
      setMobileNumber('')
    }
  }, [route.params])

  function selectBank(bank: Bank) {
    setSelectedBank(bank)
    if (bank.branchCode) setBranchCode(bank.branchCode)
    setShowBankPicker(false)
  }

  function handleSave() {
    const finalBankAccounts = hasBankDetails
      ? [
          ...bankAccounts,
          {
            id: `${Date.now()}`,
            bankName: selectedBank?.name ?? '',
            branchCode,
            accountNumber,
          },
        ]
      : bankAccounts

    navigation.navigate('ReceiveMoney', {
      name: route.params?.name,
      registeredPhone,
      bankName: finalBankAccounts[0]?.bankName,
      accountNumber: finalBankAccounts[0]?.accountNumber,
      bankAccounts: finalBankAccounts,
      mobileMoneyNumbers,
    })
  }

  function handleSkip() {
    navigation.navigate('ReceiveMoney', {
      name: route.params?.name,
      registeredPhone,
      bankAccounts,
      mobileMoneyNumbers,
    })
  }

  function handleAddBankAccount() {
    if (!hasBankDetails) return
    setBankAccounts(accounts => [
      ...accounts,
      {
        id: `${Date.now()}`,
        bankName: selectedBank?.name ?? '',
        branchCode,
        accountNumber,
      },
    ])
    setSelectedBank(null)
    setAccountNumber('')
    setBranchCode('')
  }

  function handleAddMobileMoney() {
    const digits = mobileNumber.replace(/\D/g, '').replace(/^267/, '')
    if (digits.length < 8) return
    const phone = `+267${digits.slice(-8)}`
    const pendingNumber: MobileMoneyNumber = {
      id: `${Date.now()}`,
      phone,
      provider: detectProvider(phone),
    }
    navigation.navigate('OTP', {
      phone,
      mode: 'mobile_money',
      mobileMoneyReturn: {
        name: route.params?.name,
        registeredPhone,
        bankName: hasBankDetails ? selectedBank?.name ?? '' : '',
        branchCode,
        accountNumber: hasBankDetails ? accountNumber : '',
        bankAccounts,
        mobileMoneyNumbers,
        pendingNumber,
      },
    })
  }

  const canAddMobileMoney = mobileNumber.replace(/\D/g, '').replace(/^267/, '').length >= 8

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Heading ─────────────────────────────── */}
          <Text style={[styles.heading, { color: textCol }]}>Add Bank Details</Text>
          <Text style={[styles.subheading, { color: mutedCol }]}>
            For receiving contributions via bank transfer
          </Text>

          {/* ── Bank selector ────────────────────────── */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: mutedCol }]}>Bank</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectorRow, { backgroundColor: inputBg, borderColor: borderCol }]}
              onPress={() => setShowBankPicker(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.selectorText, { color: selectedBank ? textCol : mutedCol }]}>
                {selectedBank ? selectedBank.name : 'Select your bank'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={mutedCol} />
            </TouchableOpacity>
          </View>

          {/* ── Account number ───────────────────────── */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: mutedCol }]}>Account Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: borderCol, color: textCol }]}
              placeholder="e.g. 62012345678"
              placeholderTextColor={mutedCol}
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
              returnKeyType="next"
            />
          </View>

          {/* ── Branch code ──────────────────────────── */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: mutedCol }]}>Branch Code</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: borderCol, color: textCol }]}
              placeholder="e.g. 282267"
              placeholderTextColor={mutedCol}
              value={branchCode}
              onChangeText={setBranchCode}
              keyboardType="number-pad"
              returnKeyType="done"
            />
          </View>

          <View style={[styles.accountsCard, { backgroundColor: inputBg, borderColor: borderCol }]}>
            <View style={styles.cardTitleRow}>
              <View>
                <Text style={[styles.cardTitle, { color: textCol }]}>Bank Accounts</Text>
                <Text style={[styles.cardSubtitle, { color: mutedCol }]}>Add multiple accounts for bank transfers</Text>
              </View>
              <Ionicons name="card-outline" size={20} color="#7439E0" />
            </View>

            {bankAccounts.map(item => (
              <View key={item.id} style={[styles.savedItem, { borderColor: borderCol }]}>
                <View>
                  <Text style={[styles.savedItemTitle, { color: textCol }]}>{item.bankName}</Text>
                  <Text style={[styles.savedItemMeta, { color: mutedCol }]}>{maskAccount(item.accountNumber)}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.addMobileButton, hasBankDetails && styles.addMobileButtonActive]}
              onPress={handleAddBankAccount}
              activeOpacity={hasBankDetails ? 0.85 : 1}
            >
              <Ionicons name="add" size={18} color={hasBankDetails ? '#FFFFFF' : mutedCol} />
              <Text style={[styles.addMobileButtonText, { color: hasBankDetails ? '#FFFFFF' : mutedCol }]}>
                Add Bank Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Mobile money numbers ─────────────────── */}
          <View style={[styles.mobileMoneyCard, { backgroundColor: inputBg, borderColor: borderCol }]}>
            <View style={styles.cardTitleRow}>
              <View>
                <Text style={[styles.cardTitle, { color: textCol }]}>Mobile Money Numbers</Text>
                <Text style={[styles.cardSubtitle, { color: mutedCol }]}>Add other numbers for receiving payments</Text>
              </View>
              <Ionicons name="phone-portrait-outline" size={20} color="#7439E0" />
            </View>

            {mobileMoneyNumbers.map(item => (
              <View key={item.id} style={[styles.savedItem, { borderColor: borderCol }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ProviderLogo provider={item.provider} size={32} />
                  <View>
                    <Text style={[styles.savedItemTitle, { color: textCol }]}>{formatPhone(item.phone)}</Text>
                    <Text style={[styles.savedItemMeta, { color: mutedCol }]}>{PROVIDER_LABELS[item.provider]}</Text>
                  </View>
                </View>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              </View>
            ))}

            <View style={styles.mobileInputRow}>
              <View style={[styles.dialBox, { borderColor: borderCol }]}>
                <Text style={[styles.dialText, { color: textCol }]}>+267</Text>
              </View>
              <TextInput
                style={[styles.mobileInput, { color: textCol, borderColor: borderCol }]}
                placeholder="71 234 567"
                placeholderTextColor={mutedCol}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                keyboardType="phone-pad"
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              style={[styles.addMobileButton, canAddMobileMoney && styles.addMobileButtonActive]}
              onPress={handleAddMobileMoney}
              activeOpacity={canAddMobileMoney ? 0.85 : 1}
            >
              <Ionicons name="add" size={18} color={canAddMobileMoney ? '#FFFFFF' : mutedCol} />
              <Text style={[styles.addMobileButtonText, { color: canAddMobileMoney ? '#FFFFFF' : mutedCol }]}>
                Add Mobile Money Number
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Save & Continue ──────────────────────── */}
          <TouchableOpacity
            style={[styles.primaryButton, styles.buttonActive]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, styles.primaryButtonTextActive]}>
              Save &amp; Continue
            </Text>
          </TouchableOpacity>

          {/* ── Skip ────────────────────────────────── */}
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Bank picker modal ────────────────────── */}
      <Modal visible={showBankPicker} transparent animationType="slide" onRequestClose={() => setShowBankPicker(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowBankPicker(false)}>
          <View style={[styles.modalSheet, { backgroundColor: inputBg }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: textCol }]}>Select Bank</Text>
            {BANKS.map(bank => (
              <TouchableOpacity
                key={bank.name}
                style={[
                  styles.bankOption,
                  { borderBottomColor: borderCol },
                  selectedBank?.name === bank.name && { backgroundColor: '#EDE9FE' },
                ]}
                onPress={() => selectBank(bank)}
                activeOpacity={0.75}
              >
                <Text style={[styles.bankOptionText, { color: textCol }, selectedBank?.name === bank.name && { color: '#7439E0', fontWeight: '700' }]}>
                  {bank.name}
                </Text>
                {selectedBank?.name === bank.name && (
                  <Ionicons name="checkmark" size={16} color="#7439E0" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 48,
  },

  heading: {
    fontSize: 28,
    fontFamily: fonts.display.bold,
    fontWeight: '800',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 36,
  },

  field:   { marginBottom: 20 },
  label:   { fontSize: 13, fontWeight: '500', marginBottom: 8 },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: { fontSize: 16 },

  accountsCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  mobileMoneyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  savedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
  },
  savedItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  savedItemMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  mobileInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  dialBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    justifyContent: 'center',
  },
  dialText: {
    fontSize: 15,
    fontWeight: '700',
  },
  mobileInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  addMobileButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addMobileButtonActive: {
    backgroundColor: '#7439E0',
  },
  addMobileButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },

  primaryButton: {
    backgroundColor: '#D4D4D8',
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  buttonActive: {
    backgroundColor: '#7439E0',
    shadowColor: '#7439E0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#9A9A9A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  primaryButtonTextActive: { color: '#FFFFFF' },

  skipBtn: { alignItems: 'center', paddingVertical: 4 },
  skipText: { fontSize: 14, fontWeight: '600', color: '#7439E0' },

  // ── Bank picker modal ──────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  bankOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  bankOptionText: { fontSize: 15 },
})
