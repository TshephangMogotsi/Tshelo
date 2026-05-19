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
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { supabase } from '../../lib/supabase'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OTP'>
  route: RouteProp<AuthStackParamList, 'OTP'>
}

const OTP_LENGTH = 6
const RESEND_COUNTDOWN = 60

const modeLabels: Record<string, string> = {
  login: 'Log in to your account',
  register: 'Verify your number',
  recover: 'Recover your account',
}

export default function OTPScreen({ navigation, route }: Props) {
  const { phone, mode } = route.params
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
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
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
    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    setCountdown(RESEND_COUNTDOWN)
    setDigits(Array(OTP_LENGTH).fill(''))
    inputRefs.current[0]?.focus()
  }

  async function handleVerify() {
    if (!isComplete) return
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    })
    setLoading(false)
    if (error) {
      Alert.alert('Invalid code', 'The code is incorrect or has expired. Try again.')
      return
    }
    if (mode === 'register') {
      navigation.navigate('Register', { phone })
    }
    // For login/recover: AuthContext listener detects the new session
    // and automatically switches to MainNavigator — no extra navigation needed
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
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.heading}>{modeLabels[mode]}</Text>
            <Text style={styles.subheading}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
            </Text>
          </View>

          <View style={styles.otpRow}>
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={ref => { inputRefs.current[i] = ref }}
                style={[
                  styles.otpBox,
                  digit ? styles.otpBoxFilled : null,
                ]}
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

          <View style={styles.resendRow}>
            {countdown > 0 ? (
              <Text style={styles.resendCountdown}>
                Resend code in{' '}
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
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={[styles.primaryButtonText, !isComplete && styles.buttonTextDisabled]}>
                Verify
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.changeNumberLink}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.changeNumberText}>Use a different number</Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  header: {
    marginBottom: 40,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
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
    marginBottom: 24,
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
    color: colors.primary,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
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
  changeNumberLink: {
    alignItems: 'center',
  },
  changeNumberText: {
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
})
