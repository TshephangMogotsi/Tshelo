import { useState, useRef } from 'react'
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
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'
import { supabase } from '../../lib/supabase'
import BankPicker, { BankFormValue } from '../../components/BankPicker'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>
}

type MobileMoneyProvider = 'orange_money' | 'myzaka' | 'smega'

type ProviderInfo = { id: MobileMoneyProvider; label: string; color: string; network: string }

const PROVIDER_META: Record<MobileMoneyProvider, Omit<ProviderInfo, 'id'>> = {
  orange_money: { label: 'Orange Money', color: '#EA6C0A', network: 'Orange Botswana' },
  myzaka:       { label: 'MyZaka',       color: '#0070C0', network: 'Mascom' },
  smega:        { label: 'Smega',        color: '#7C3AED', network: 'BTC Botswana' },
}

// Detect mobile money provider from the first two digits of an 8-digit BW number
function detectProvider(digits: string): MobileMoneyProvider | null {
  if (digits.length < 2) return null
  const prefix = parseInt(digits.slice(0, 2), 10)
  if ([71, 72, 73, 76].includes(prefix)) return 'orange_money'
  if ([74, 75].includes(prefix))         return 'myzaka'
  if (prefix === 77)                     return 'smega'
  return null
}

export default function RegisterScreen({ navigation }: Props) {
  const [name, setName]               = useState('')
  const [phone, setPhone]             = useState('')
  const [bank, setBank]               = useState<BankFormValue>({
    bankName: '', branchCode: '', accountNumber: '', accountType: 'savings',
  })
  const [consent, setConsent]         = useState(false)
  const [loading, setLoading]         = useState(false)
  const [nameFocused, setNameFocused] = useState(false)
  const [phoneFocused, setPhoneFocused] = useState(false)

  const phoneRef = useRef<TextInput>(null)

  const cleanPhone = phone.replace(/\D/g, '')
  const provider   = detectProvider(cleanPhone)

  const isValid =
    name.trim().length >= 2 &&
    cleanPhone.length === 8 &&
    provider !== null &&
    bank.bankName.length > 0 &&
    bank.accountNumber.length >= 8 &&
    consent

  async function handleSendOTP() {
    if (!isValid) return
    const fullPhone = `+267${cleanPhone}`
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone })
    setLoading(false)
    if (error) { Alert.alert('Error', error.message); return }
    navigation.navigate('OTP', {
      phone: fullPhone,
      mode: 'register',
      registration: {
        name:     name.trim(),
        provider: provider!,
        bank,
      },
    })
  }

  const detectedMeta = provider ? PROVIDER_META[provider] : null

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
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.subheading}>
              Tell us about yourself — we'll verify your number after.
            </Text>
          </View>

          {/* ── Full name ─────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, nameFocused && styles.inputFocused]}
              placeholder="e.g. Kefilwe Moeti"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          </View>

          {/* ── Phone number ──────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <Text style={styles.fieldSub}>
              Your mobile money provider will be detected automatically.
            </Text>
            <View style={[styles.phoneRow, phoneFocused && styles.rowFocused]}>
              <View style={styles.countryCode}>
                <Text style={styles.flag}>🇧🇼</Text>
                <Text style={styles.countryCodeText}>+267</Text>
              </View>
              <View style={styles.divider} />
              <TextInput
                ref={phoneRef}
                style={styles.phoneInput}
                placeholder="71 234 567"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                maxLength={9}
                returnKeyType="next"
                onSubmitEditing={() => bankRef.current?.focus()}
              />
            </View>

            {/* Provider pill — auto-detected */}
            {detectedMeta ? (
              <View style={[styles.providerPill, { backgroundColor: detectedMeta.color + '18' }]}>
                <View style={[styles.providerDot, { backgroundColor: detectedMeta.color }]} />
                <Text style={[styles.providerPillText, { color: detectedMeta.color }]}>
                  {detectedMeta.label} · {detectedMeta.network}
                </Text>
                <Ionicons name="checkmark-circle" size={15} color={detectedMeta.color} />
              </View>
            ) : cleanPhone.length >= 2 ? (
              <View style={styles.providerUnknown}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.textMuted} />
                <Text style={styles.providerUnknownText}>
                  Number not recognised — mobile money may not be available
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── Bank details ──────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.sectionLabel}>Bank Details</Text>
          </View>
          <BankPicker value={bank} onChange={setBank} />

          {/* ── Consent ───────────────────────────────── */}
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setConsent(v => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
              {consent && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={styles.consentText}>
              I agree to Tshelo's{' '}
              <Text style={styles.consentLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.consentLink}>Privacy Policy</Text>
              , and consent to processing of my mobile money information.
            </Text>
          </TouchableOpacity>

          {/* ── Submit ────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.buttonDisabled]}
            onPress={handleSendOTP}
            activeOpacity={isValid ? 0.85 : 1}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryButtonText}>Send OTP</Text>
            }
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={styles.footerLink}>Log in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.background },
  flex:  { flex: 1 },
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
    marginBottom: 36,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { marginBottom: 32 },
  heading: {
    fontSize: 30,
    fontFamily: fonts.display.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  field: { marginBottom: 24 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  fieldSub: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 10,
    marginTop: -2,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputFocused: {
    borderColor: colors.borderFocus,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  rowFocused: {
    borderColor: colors.borderFocus,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 6,
  },
  flag: { fontSize: 18 },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  providerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  providerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  providerPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  providerUnknown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  providerUnknownText: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 28,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  consentLink: { color: colors.primaryMid, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: { backgroundColor: colors.disabled },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: { fontSize: 14, color: colors.textSecondary },
  footerLink: { fontSize: 14, fontWeight: '700', color: colors.primaryMid },
})
