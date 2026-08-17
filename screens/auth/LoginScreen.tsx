import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'
import { useRequireOnline } from '../../context/ConnectivityContext'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>
}

export default function LoginScreen({ navigation }: Props) {
  const { isDark } = useTheme()
  const requireOnline = useRequireOnline()
  const bg       = isDark ? '#1A1C24' : '#F4F2EB'
  const inputBg  = isDark ? '#2D2E41' : '#FFFFFF'
  const textCol  = isDark ? '#F2F2F7' : colors.textPrimary
  const mutedCol = isDark ? '#8A8A9A' : colors.textMuted
  const borderCol = isDark ? '#3A3A5C' : colors.border

  const [phone, setPhone] = useState('')
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)

  const cleanedPhone = phone.replace(/\D/g, '')
  const isValid = cleanedPhone.length === 8

  async function handleSendOTP() {
    if (!isValid) return
    if (!requireOnline()) return
    const fullPhone = `+267${cleanedPhone}`
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
      options: { shouldCreateUser: false },
    })
    setLoading(false)
    if (error) {
      Alert.alert('Code not sent', 'Check the number or create a Tshelo account first, then try again.')
      return
    }
    navigation.navigate('OTP', { phone: fullPhone, mode: 'login' })
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={[styles.backButton, { backgroundColor: inputBg, borderColor: borderCol }]} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={textCol} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={[styles.subheading, { color: mutedCol }]}>
              Enter your phone number to continue
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: textCol }]}>Phone Number</Text>
            <View style={[styles.phoneRow, { backgroundColor: inputBg, borderColor: focused ? colors.primary : borderCol }]}>
              <View style={styles.countryCode}>
                <Text style={styles.countryFlag}>🇧🇼</Text>
                <Text style={[styles.countryCodeText, { color: textCol }]}>+267</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: borderCol }]} />
              <TextInput
                style={[styles.phoneInput, { color: textCol }]}
                placeholder="71 000 000"
                placeholderTextColor={mutedCol}
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
            <Text style={[styles.hint, { color: mutedCol }]}>
              We'll send a one time code to verify its you
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
            <Text style={[styles.footerText, { color: textCol }]}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Register')}>
              <Text style={styles.footerLink}>Create One</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.recoverLink}
          onPress={() => navigation.navigate('Support')}
        >
          <Text style={[styles.recoverText, { color: mutedCol }]}>Can't access your number? Get help</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:  { flex: 1 },
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    borderWidth: 1,
  },
  header: { marginBottom: 36 },
  heading: {
    fontSize: 30,
    fontFamily: fonts.display.bold,
    color: '#9D86FF',
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
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
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
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
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
