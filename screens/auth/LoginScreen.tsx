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
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'
import { supabase } from '../../lib/supabase'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>
}

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('')
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)

  const cleanedPhone = phone.replace(/\D/g, '')
  const isValid = cleanedPhone.length === 8

  async function handleSendOTP() {
    if (!isValid) return
    const fullPhone = `+267${cleanedPhone}`
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone })
    setLoading(false)
    if (error) { Alert.alert('Error', error.message); return }
    navigation.navigate('OTP', { phone: fullPhone, mode: 'login' })
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
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>
              Enter your Botswana number to continue.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={[styles.phoneRow, focused && styles.phoneRowFocused]}>
              <View style={styles.countryCode}>
                <Text style={styles.countryFlag}>🇧🇼</Text>
                <Text style={styles.countryCodeText}>+267</Text>
              </View>
              <View style={styles.divider} />
              <TextInput
                style={styles.phoneInput}
                placeholder="71 234 567"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                maxLength={9}
                returnKeyType="done"
                onSubmitEditing={handleSendOTP}
              />
            </View>
            <Text style={styles.hint}>
              We'll send a one-time code to verify it's you.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isValid && styles.buttonActive]}
            onPress={handleSendOTP}
            activeOpacity={isValid ? 0.85 : 1}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={[styles.primaryButtonText, isValid && styles.primaryButtonTextActive]}>Send Code</Text>
            }
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Register')}>
              <Text style={styles.footerLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.recoverLink}
          onPress={() => navigation.navigate('Support')}
        >
          <Text style={styles.recoverText}>Can't access your number? Get help</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: '#F4F2EB' },
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
  header: { marginBottom: 36 },
  heading: {
    fontSize: 30,
    fontFamily: fonts.display.bold,
    color: '#7439E0',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  form: { marginBottom: 28 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  phoneRowFocused: {
    borderColor: colors.borderFocus,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 6,
  },
  countryFlag: { fontSize: 18 },
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
  hint: {
    fontSize: 12,
    color: '#4A4A4A',
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#D4D4D8',
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#676767',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  primaryButtonTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 14,
  },
  footerText: { fontSize: 14, color: colors.textSecondary },
  footerLink: { fontSize: 14, fontWeight: '700', color: colors.primaryMid },
  recoverLink: { alignItems: 'center', paddingVertical: 16 },
  recoverText: {
    fontSize: 14,
    color: '#4A4A4A',
    textDecorationLine: 'underline',
  },
})
