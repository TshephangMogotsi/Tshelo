import { useState, useRef, useEffect } from 'react'
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
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OTP'>
  route: RouteProp<AuthStackParamList, 'OTP'>
}

const OTP_LENGTH = 6
const RESEND_COUNTDOWN = 60

const modeLabels: Record<string, string> = {
  login:    'Welcome back',
  register: 'Verify your number',
}

export default function OTPScreen({ navigation, route }: Props) {
  const { phone, mode, registration } = route.params
  const { refreshProfile } = useAuth()
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN)
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef<Array<TextInput | null>>([])

  const otp = digits.join('')
  const isComplete = otp.length === OTP_LENGTH && digits.every(d => d !== '')

  useEffect(() => {
    if (countdown === 0) return
    const t = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [countdown])

  function handleDigit(value: string, index: number) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits]
      next[index - 1] = ''
      setDigits(next)
      inputRefs.current[index - 1]?.focus()
    }
  }

  async function handleResend() {
    const { error } = await supabase.auth.signInWithOtp({ phone })
    if (error) { Alert.alert('Error', error.message); return }
    setCountdown(RESEND_COUNTDOWN)
    setDigits(Array(OTP_LENGTH).fill(''))
    inputRefs.current[0]?.focus()
  }

  async function handleVerify() {
    if (!isComplete) return
    setLoading(true)

    const { data, error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })

    if (error) {
      setLoading(false)
      Alert.alert('Invalid code', 'The code is incorrect or has expired. Try again.')
      return
    }

    const userId = data.user?.id
    if (!userId) { setLoading(false); return }

    if (registration) {
      // New registration: save profile data collected upfront, then show success screen
      const now = new Date().toISOString()
      await supabase.from('users').update({
        name: registration.name,
        mobile_money_provider: registration.provider,
        bank_name:         registration.bank.bankName,
        bank_branch_code:  registration.bank.branchCode,
        bank_account_number: registration.bank.accountNumber,
        bank_account_type: registration.bank.accountType,
        profile_completed: true,
        onboarding_completed: true,
        terms_accepted_at: now,
        terms_version: '1.0',
        privacy_accepted_at: now,
        privacy_version: '1.0',
        data_processing_consent: true,
        data_processing_consent_at: now,
      }).eq('id', userId)
      setLoading(false)
      navigation.navigate('RegistrationSuccess')
      return
    }

    // Login / recover: check if profile is complete
    const { data: profile } = await supabase
      .from('users')
      .select('profile_completed')
      .eq('id', userId)
      .single()

    setLoading(false)

    if (!profile?.profile_completed) {
      navigation.navigate('ProfileSetup')
    }
    // If profile complete, AuthContext detects session and switches to MainNavigator
  }

  const maskedPhone = phone.replace(/(\+267)(\d{2})(\d+)(\d{2})/, '$1 $2**** $4')

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.heading}>{modeLabels[mode]}</Text>
            <Text style={styles.subheading}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
            </Text>
          </View>

          {/* OTP boxes */}
          <View style={styles.otpRow}>
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={ref => { inputRefs.current[i] = ref }}
                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                value={digit}
                onChangeText={v => handleDigit(v, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={1}
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Resend */}
          <View style={styles.resendRow}>
            {countdown > 0 ? (
              <Text style={styles.resendCountdown}>
                Resend in{' '}
                <Text style={styles.resendTimer}>
                  {String(Math.floor(countdown / 60)).padStart(2, '0')}:
                  {String(countdown % 60).padStart(2, '0')}
                </Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend}>
                <Text style={styles.resendLink}>Resend code</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !isComplete && styles.buttonDisabled]}
            onPress={handleVerify}
            activeOpacity={isComplete ? 0.85 : 1}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryButtonText}>Verify</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.changeLink} onPress={() => navigation.goBack()}>
            <Text style={styles.changeLinkText}>Use a different number</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.background },
  flex:      { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
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
  header: { marginBottom: 40 },
  heading: {
    fontSize: 30,
    fontFamily: fonts.display.bold,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  otpBox: {
    width: 48,
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    color: colors.primary,
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: 36,
  },
  resendCountdown: {
    fontSize: 13,
    color: colors.textMuted,
  },
  resendTimer: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryMid,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  changeLink: { alignItems: 'center' },
  changeLinkText: {
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
})
