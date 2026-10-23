import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import CountryPickerModal from '../../components/CountryPickerModal'
import { findSignupCountry } from '../../lib/countries'
import { internationalPhone, isValidNationalPhone, nationalPhoneDigits, phoneInputConfig } from '../../lib/phoneNumbers'
import { confirmCurrentNumber, confirmPhoneChange, phoneChangeError, requestPhoneChange, sendCurrentNumberCode } from '../../lib/changePhone'
import { api } from '../../lib/api'

type Step = 'current' | 'current-code' | 'new' | 'new-code' | 'synced' | 'done'
type Props = { navigation: NativeStackNavigationProp<MainStackParamList, 'ChangePhone'> }

export default function ChangePhoneScreen({ navigation }: Props) {
  const { colors } = useTheme()
  const { userId, countryCode, refreshProfile } = useAuth()
  const requireOnline = useRequireOnline()
  const [country, setCountry] = useState(() => findSignupCountry(countryCode ?? 'BW') ?? findSignupCountry('BW')!)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [number, setNumber] = useState('')
  const [currentPhone, setCurrentPhone] = useState('')
  const [pendingPhone, setPendingPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>('current')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retryAt, setRetryAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!retryAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [retryAt])
  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000))
  const config = phoneInputConfig(country.code, country.dialCode)
  const validNumber = isValidNationalPhone(number, config)
  const canSubmitCode = /^\d{6,10}$/.test(code)

  async function run(action: () => Promise<void>) {
    if (!userId || inFlight.current || !requireOnline()) return
    inFlight.current = true; setBusy(true); setError('')
    try { await action() } catch (cause) { if (mounted.current) setError(phoneChangeError(cause)) }
    finally { inFlight.current = false; if (mounted.current) setBusy(false) }
  }
  function startCooldown() { const sentAt = Date.now(); setNow(sentAt); setRetryAt(sentAt + 60000) }
  function sendCurrentCode() {
    if (!userId || seconds > 0) return
    void run(async () => { const phone = await sendCurrentNumberCode(userId); if (mounted.current) { setCurrentPhone(phone); setCode(''); setStep('current-code'); startCooldown() } })
  }
  function verifyCurrentCode() {
    if (!userId || !currentPhone || !canSubmitCode) return
    void run(async () => { await confirmCurrentNumber(userId, currentPhone, code); if (mounted.current) { setCode(''); setRetryAt(0); setStep('new') } })
  }
  function sendNewCode() {
    if (!userId || !validNumber || seconds > 0) return
    const target = internationalPhone(country.dialCode, number)
    void run(async () => { await requestPhoneChange(userId, target); if (mounted.current) { setPendingPhone(target); setCode(''); setStep('new-code'); startCooldown() } })
  }
  function verifyNewCode() {
    if (!userId || !pendingPhone || !canSubmitCode) return
    void run(async () => {
      await confirmPhoneChange(userId, pendingPhone, code)
      if (mounted.current) { setCode(''); setStep('synced') }
      const profile = await api.users.me()
      if (profile.id !== userId || nationalPhoneDigits(profile.phone) !== nationalPhoneDigits(pendingPhone)) throw new Error('Your sign-in number changed, but your profile has not refreshed. Contact support before making another change.')
      await refreshProfile()
      if (mounted.current) setStep('done')
    })
  }
  function retrySync() {
    if (!userId || step !== 'synced') return
    void run(async () => {
      const profile = await api.users.me()
      if (profile.id !== userId || nationalPhoneDigits(profile.phone) !== nationalPhoneDigits(pendingPhone)) throw new Error('Your sign-in number changed, but your profile has not refreshed. Contact support before making another change.')
      await refreshProfile(); if (mounted.current) setStep('done')
    })
  }
  const buttonStyle = { ...styles.button, backgroundColor: colors.primary }
  const inputStyle = { ...styles.input, color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }
  const renderCode = (label: string, onSubmit: () => void, submit: string) => <>
    <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
    <TextInput style={inputStyle} accessibilityLabel="Verification code" value={code} editable={!busy} onChangeText={value => setCode(nationalPhoneDigits(value))} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={10} placeholder="SMS code" placeholderTextColor={colors.textMuted} />
    <TouchableOpacity style={[buttonStyle, (busy || !canSubmitCode) && styles.disabled]} accessibilityRole="button" disabled={busy || !canSubmitCode} onPress={onSubmit}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{submit}</Text>}</TouchableOpacity>
  </>
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={styles.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" disabled={busy} onPress={() => navigation.goBack()} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.textPrimary} /></TouchableOpacity><Text style={[styles.title, { color: colors.heading }]}>Change phone number</Text></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {step === 'done' ? <><Ionicons name="checkmark-circle" size={56} color={colors.success} /><Text style={[styles.title, { color: colors.heading }]}>Phone number updated</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>Use {pendingPhone} next time you sign in. A security notification has been added to your Tshelo account. Your data is preserved.</Text><TouchableOpacity style={buttonStyle} accessibilityRole="button" onPress={() => navigation.goBack()}><Text style={styles.buttonText}>Done</Text></TouchableOpacity></> : <>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>For security, first confirm your current number, then confirm the new one. Both SMS codes are required.</Text>
        {step === 'current' ? <><Text style={[styles.label, { color: colors.textPrimary }]}>Current number</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>We’ll send a code to the number currently registered on this account.</Text><TouchableOpacity style={[buttonStyle, (busy || seconds > 0) && styles.disabled]} accessibilityRole="button" disabled={busy || seconds > 0} onPress={sendCurrentCode}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{seconds > 0 ? `Wait ${seconds}s` : 'Send code to current number'}</Text>}</TouchableOpacity></> : null}
        {step === 'current-code' ? <>{renderCode(`Enter the code sent to ${currentPhone}`, verifyCurrentCode, 'Confirm current number')}<TouchableOpacity style={styles.link} accessibilityRole="button" disabled={busy || seconds > 0} onPress={sendCurrentCode}><Text style={{ color: seconds > 0 ? colors.textMuted : colors.primary }}>{seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}</Text></TouchableOpacity></> : null}
        {step === 'new' ? <><Text style={[styles.label, { color: colors.textPrimary }]}>New phone number</Text><View style={styles.phoneRow}><TouchableOpacity style={[inputStyle, styles.country]} accessibilityRole="button" accessibilityLabel="Choose country calling code" disabled={busy} onPress={() => setPickerOpen(true)}><Text style={{ color: colors.textPrimary }}>{country.flag} {country.dialCode} ▾</Text></TouchableOpacity><TextInput style={[inputStyle, styles.number]} accessibilityLabel="New phone number" value={number} editable={!busy} onChangeText={value => setNumber(nationalPhoneDigits(value))} keyboardType="phone-pad" maxLength={config.maxDigits} placeholder={config.placeholder} placeholderTextColor={colors.textMuted} /></View><Text style={[styles.hint, { color: colors.textMuted }]}>Enter the number without the country code or local leading 0.</Text><TouchableOpacity style={[buttonStyle, (!validNumber || busy) && styles.disabled]} accessibilityRole="button" disabled={!validNumber || busy} onPress={sendNewCode}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code to new number</Text>}</TouchableOpacity></> : null}
        {step === 'new-code' ? <>{renderCode(`Enter the code sent to ${pendingPhone}`, verifyNewCode, 'Verify and change number')}<TouchableOpacity style={styles.link} accessibilityRole="button" disabled={busy || seconds > 0} onPress={sendNewCode}><Text style={{ color: seconds > 0 ? colors.textMuted : colors.primary }}>{seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}</Text></TouchableOpacity><Text style={[styles.hint, { color: colors.textMuted }]}>Your number changes only after this code is verified.</Text></> : null}
        {step === 'synced' ? <><Text style={[styles.copy, { color: colors.textSecondary }]}>Your sign-in number was verified. Refreshing your account details…</Text><TouchableOpacity style={buttonStyle} accessibilityRole="button" disabled={busy} onPress={retrySync}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Refresh account</Text>}</TouchableOpacity></> : null}
        {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.copy, { color: colors.error }]}>{error}</Text> : null}
      </>}
    </ScrollView></KeyboardAvoidingView>
    <CountryPickerModal visible={pickerOpen} selectedCode={country.code} onSelect={selected => { setCountry(selected); setNumber(''); setPickerOpen(false) }} onClose={() => setPickerOpen(false)} />
  </SafeAreaView>
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 }, back: { padding: 8 }, title: { fontSize: 21, fontWeight: '700', flexShrink: 1 }, content: { padding: 24, gap: 18, width: '100%', maxWidth: 640, alignSelf: 'center' }, copy: { fontSize: 15, lineHeight: 23 }, label: { fontSize: 14, fontWeight: '600' }, phoneRow: { flexDirection: 'row', gap: 10 }, country: { justifyContent: 'center' }, number: { flex: 1, minWidth: 0 }, input: { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 17 }, hint: { fontSize: 13, lineHeight: 20 }, button: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', padding: 14 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 }, disabled: { opacity: 0.5 }, link: { alignItems: 'center', padding: 12 } })
