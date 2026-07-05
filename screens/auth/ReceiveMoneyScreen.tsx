import { useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { AuthStackParamList, BankAccount, MobileMoneyNumber } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../context/ThemeContext'
import ProviderLogo from '../../components/ProviderLogo'
import { PROVIDER_LABELS, detectProviderOrUnknown as detectProvider } from '../../lib/providers'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ReceiveMoney'>
  route:      RouteProp<AuthStackParamList, 'ReceiveMoney'>
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^267/, '')
  return digits.length === 8 ? `+267 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}` : phone
}

function maskAccount(accountNumber?: string) {
  const digits = accountNumber?.replace(/\D/g, '') ?? ''
  if (!digits) return ''
  return `****${digits.slice(-4)}`
}

function makeBankAccounts(params: Props['route']['params']): BankAccount[] {
  if (params.bankAccounts?.length) return params.bankAccounts
  if (params.bankName && params.accountNumber) {
    return [{
      id: 'primary-bank',
      bankName: params.bankName,
      branchCode: '',
      accountNumber: params.accountNumber,
    }]
  }
  return []
}

export default function ReceiveMoneyScreen({ navigation, route }: Props) {
  const { isDark } = useTheme()
  const [confirmed, setConfirmed] = useState(false)
  const bg       = isDark ? '#1A1C24' : colors.background
  const textCol  = isDark ? '#F2F2F7' : '#141414'
  const mutedCol = isDark ? '#A1A1AA' : colors.textMuted

  const mobileMoneyNumbers = useMemo(() => {
    const numbers = [...route.params.mobileMoneyNumbers]
    if (route.params.registeredPhone && !numbers.some(n => n.phone === route.params.registeredPhone)) {
      numbers.unshift({
        id: 'registered',
        phone: route.params.registeredPhone,
        provider: detectProvider(route.params.registeredPhone),
      })
    }
    return numbers
  }, [route.params.mobileMoneyNumbers, route.params.registeredPhone])

  const hasMobileMoney = mobileMoneyNumbers.length > 0
  const bankAccounts = useMemo(() => makeBankAccounts(route.params), [route.params])
  const hasBank = bankAccounts.length > 0

  function handleContinue() {
    if (!confirmed) return
    navigation.navigate('RegistrationSuccess')
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: textCol }]}>How you'll receive money</Text>
        <Text style={[styles.subheading, { color: mutedCol }]}>Contributors can send to:</Text>

        {hasMobileMoney && (
          <View style={[styles.optionCard, styles.mobileCard]}>
            <View style={styles.optionHeader}>
              <View style={[styles.optionIcon, styles.mobileIcon]}>
                <Ionicons name="phone-portrait-outline" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.mobileTitle}>Mobile{'\n'}Money</Text>
                <Text style={styles.mobileStatus}>Verified ✓</Text>
              </View>
            </View>
            <View style={styles.detailBox}>
              {mobileMoneyNumbers.map((item, index) => (
                <View
                  key={item.id}
                  style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, index > 0 && styles.detailDivider]}
                >
                  <ProviderLogo provider={item.provider} size={30} />
                  <View>
                    <Text style={styles.detailLabel}>{PROVIDER_LABELS[item.provider]}</Text>
                    <Text style={styles.detailValue}>{formatPhone(item.phone)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {hasBank && (
          <View style={[styles.optionCard, styles.bankCard]}>
            <View style={styles.optionHeader}>
              <View style={[styles.optionIcon, styles.bankIcon]}>
                <Ionicons name="card-outline" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.bankTitle}>Bank{'\n'}Transfer</Text>
                <Text style={styles.bankStatus}>Added ✓</Text>
              </View>
            </View>
            <View style={styles.detailBox}>
              {bankAccounts.map((account, index) => (
                <View key={account.id} style={index > 0 && styles.detailDivider}>
                  <Text style={styles.detailLabel}>{account.bankName}</Text>
                  <Text style={styles.detailValue}>{maskAccount(account.accountNumber)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.confirmRow} onPress={() => setConfirmed(v => !v)} activeOpacity={0.8}>
          <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
            {confirmed && <Ionicons name="checkmark" size={17} color="#FFFFFF" />}
          </View>
          <Text style={[styles.confirmText, { color: textCol }]}>
            I confirm these are MY accounts and I will receive contributions here.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, !confirmed && styles.primaryButtonDisabled]}
          onPress={handleContinue}
          activeOpacity={confirmed ? 0.85 : 1}
        >
          <Text style={styles.primaryButtonText}>Confirm &amp; Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 28,
    lineHeight: 35,
    fontFamily: fonts.display.bold,
    fontWeight: '800',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  mobileCard: {
    backgroundColor: '#D7F8E4',
    borderColor: '#7DEC9F',
  },
  bankCard: {
    backgroundColor: '#D9E8FF',
    borderColor: '#8AC5FF',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileIcon: { backgroundColor: '#16A34A' },
  bankIcon:   { backgroundColor: '#2255D9' },
  mobileTitle: {
    color: '#14763C',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  mobileStatus: {
    color: '#21A650',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  bankTitle: {
    color: '#2453C7',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  bankStatus: {
    color: '#2453C7',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  detailBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailLabel: {
    color: '#8E8E93',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  detailValue: {
    color: '#18181B',
    fontSize: 18,
    fontWeight: '800',
  },
  detailDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 10,
    paddingTop: 10,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#7B52F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6F4DE8',
  },
  confirmText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  primaryButton: {
    borderRadius: 28,
    backgroundColor: colors.primary,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})
