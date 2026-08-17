import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { AuthStackParamList } from '../../navigation/types'
import { fonts } from '../../theme/typography'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { openLegalDocument } from '../../lib/legalDocuments'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>
  route:      RouteProp<AuthStackParamList, 'Register'>
}

const PHONE_CONFIG: Record<string, { placeholder: string; digits: number }> = {
  BW: { placeholder: '71 234 567',   digits: 8 },
  ZA: { placeholder: '82 123 4567',  digits: 9 },
  ZW: { placeholder: '77 123 4567',  digits: 9 },
  ZM: { placeholder: '97 123 4567',  digits: 9 },
  KE: { placeholder: '71 234 5678',  digits: 9 },
  GH: { placeholder: '24 123 4567',  digits: 9 },
}

export default function RegisterScreen({ navigation, route }: Props) {
  const countryCode  = route.params?.countryCode  ?? 'BW'
  const countryName  = route.params?.countryName  ?? 'Botswana'
  const currency     = route.params?.currency     ?? 'BWP'
  const dialCode     = route.params?.dialCode     ?? '+267'

  const phoneConfig  = PHONE_CONFIG[countryCode] ?? PHONE_CONFIG['BW']

  const { isDark } = useTheme()
  const requireOnline = useRequireOnline()
  const inputBg   = isDark ? '#2D2E41' : '#FFFFFF'
  const textCol   = isDark ? '#F2F2F7' : '#1A1A2E'
  const mutedCol  = isDark ? '#8A8A9A' : '#9A9A9A'
  const borderCol = isDark ? '#3A3A5C' : '#E5E7EB'
  const bg        = isDark ? '#1A1C24' : '#F4F2EB'

  const [name,         setName]         = useState('')
  const [phone,        setPhone]        = useState('')
  const [consent,      setConsent]      = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [nameFocused,  setNameFocused]  = useState(false)
  const [phoneFocused, setPhoneFocused] = useState(false)

  const phoneRef = useRef<TextInput>(null)

  const cleanPhone = phone.replace(/\D/g, '')

  const isValid =
    name.trim().length >= 2 &&
    cleanPhone.length >= phoneConfig.digits &&
    consent

  async function handleContinue() {
    if (!isValid) return
    if (!requireOnline()) return
    const fullPhone = `${dialCode}${cleanPhone}`
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone })
    setLoading(false)
    if (error) { Alert.alert('Error', error.message); return }
    navigation.navigate('OTP', {
      phone: fullPhone,
      mode: 'register',
      registration: {
        name:     name.trim(),
        provider: 'orange_money',
        bank:     { bankName: '', branchCode: '', accountNumber: '', accountType: 'savings' },
      },
    })
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* ── Title bar ──────────────────────────────── */}
        <View style={styles.titleBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={textCol} />
          </TouchableOpacity>
          <Text style={[styles.titleBarText, { color: textCol }]}>Your Details</Text>
          <View style={styles.titleBarSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Country pill ───────────────────────────── */}
          <TouchableOpacity
            style={styles.countryPill}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <View style={styles.countryBadge}>
              <Text style={styles.countryBadgeText}>{countryCode}</Text>
            </View>
            <Text style={styles.countryPillText}>{countryName} • {currency}</Text>
          </TouchableOpacity>

          {/* ── Full name ──────────────────────────────── */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: mutedCol }]}>Full Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: nameFocused ? '#7439E0' : borderCol, color: textCol }]}
              placeholder="e.g. Kefilwe Moeti"
              placeholderTextColor={mutedCol}
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          </View>

          {/* ── Phone number ───────────────────────────── */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: mutedCol }]}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <View style={[styles.dialBox, { backgroundColor: inputBg, borderColor: borderCol }]}>
                <Text style={[styles.dialText, { color: textCol }]}>{dialCode}</Text>
              </View>
              <TextInput
                ref={phoneRef}
                style={[styles.phoneInput, { backgroundColor: inputBg, borderColor: phoneFocused ? '#7439E0' : borderCol, color: textCol }]}
                placeholder={phoneConfig.placeholder}
                placeholderTextColor={mutedCol}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                maxLength={phoneConfig.digits + 2}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* ── Important notice ───────────────────────── */}
          <View style={styles.importantCard}>
            <Text style={styles.importantText}>
              <Text style={styles.importantBold}>⚠️ Important: </Text>
              This must be YOUR mobile money number. Contributors will send money here.
            </Text>
          </View>

          {/* ── Consent ────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.consentRow, { backgroundColor: inputBg, borderColor: borderCol }]}
            onPress={() => setConsent(v => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, { borderColor: consent ? '#7439E0' : borderCol }, consent && styles.checkboxChecked]}>
              {consent && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={[styles.consentText, { color: mutedCol }]}>
              I agree to Tshelo's{' '}
              <Text
                style={styles.consentLink}
                onPress={event => { event.stopPropagation(); void openLegalDocument('terms') }}
              >Terms of Service</Text>
              {' '}and{' '}
              <Text
                style={styles.consentLink}
                onPress={event => { event.stopPropagation(); void openLegalDocument('privacy') }}
              >Privacy Policy</Text>
              , and consent to processing of my mobile money information.
            </Text>
          </TouchableOpacity>

          {/* ── Continue ───────────────────────────────── */}
          <TouchableOpacity
            style={[styles.primaryButton, isValid && styles.buttonActive]}
            onPress={handleContinue}
            activeOpacity={isValid ? 0.85 : 1}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={[styles.primaryButtonText, isValid && styles.primaryButtonTextActive]}>
                  Continue
                </Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  // ── Title bar ───────────────────────────────────────────────
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBarText: {
    flex: 1,
    fontSize: 20,
    fontFamily: fonts.display.bold,
    fontWeight: '800',
    textAlign: 'center',
  },
  titleBarSpacer: { width: 36 },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
  },

  // ── Country pill ────────────────────────────────────────────
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    borderRadius: 28,
    paddingRight: 16,
    paddingVertical: 4,
    paddingLeft: 4,
    gap: 10,
    marginBottom: 28,
  },
  countryBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#C4B5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5B21B6',
  },
  countryPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7439E0',
  },

  // ── Form fields ─────────────────────────────────────────────
  field:      { marginBottom: 20 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    minHeight: 56,
  },

  // ── Phone ───────────────────────────────────────────────────
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dialBox: {
    width: 80,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  dialText: {
    fontSize: 16,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },

  // ── Important card ──────────────────────────────────────────
  importantCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  importantText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 21,
  },
  importantBold: {
    fontWeight: '700',
  },

  // ── Consent ─────────────────────────────────────────────────
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 28,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#7439E0',
    borderColor: '#7439E0',
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  consentLink: {
    color: '#7439E0',
    fontWeight: '600',
  },

  // ── Button ──────────────────────────────────────────────────
  primaryButton: {
    backgroundColor: '#D4D4D8',
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
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
  primaryButtonTextActive: {
    color: '#FFFFFF',
  },
})
