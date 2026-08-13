import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import BankPicker, { BankFormValue } from '../../components/BankPicker'
import ProviderLogo from '../../components/ProviderLogo'
import { detectProvider, type MobileMoneyProvider } from '../../lib/providers'
import { openLegalDocument } from '../../lib/legalDocuments'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ProfileSetup'>
}

const PROVIDER_META: Record<MobileMoneyProvider, { label: string; color: string; network: string }> = {
  orange_money: { label: 'Orange Money', color: '#EA6C0A', network: 'Orange Botswana' },
  myzaka:       { label: 'MyZaka',       color: '#0070C0', network: 'Mascom' },
  smega:        { label: 'Smega',        color: '#7C3AED', network: 'BTC Botswana' },
}

export default function ProfileSetupScreen({ navigation }: Props) {
  const { refreshProfile } = useAuth()
  const requireOnline = useRequireOnline()
  const [displayName, setDisplayName] = useState('')
  const [bank, setBank] = useState<BankFormValue>({
    bankName: '', branchCode: '', accountNumber: '', accountType: 'savings',
  })
  const [consentGiven, setConsentGiven] = useState(false)
  const [nameFocused, setNameFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userPhone, setUserPhone] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.phone) setUserPhone(user.phone)
    })
  }, [])

  const provider = detectProvider(userPhone)
  const isValid =
    displayName.trim().length >= 2 &&
    bank.bankName.length > 0 &&
    bank.accountNumber.length >= 8 &&
    consentGiven

  async function handleSave() {
    if (!isValid) return
    if (!requireOnline()) return
    setLoading(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setLoading(false)
      Alert.alert('Error', 'Session expired. Please log in again.')
      navigation.replace('Welcome')
      return
    }

    const now = new Date().toISOString()
    const { error } = await supabase.from('users').update({
      name: displayName.trim(),
      mobile_money_provider: provider,
      bank_name:           bank.bankName,
      bank_branch_code:    bank.branchCode,
      bank_account_number: bank.accountNumber,
      profile_completed: true,
      onboarding_completed: true,
      terms_accepted_at: now,
      terms_version: '1.0',
      privacy_accepted_at: now,
      privacy_version: '1.0',
      data_processing_consent: true,
      data_processing_consent_at: now,
    }).eq('id', user.id)

    setLoading(false)
    if (error) { Alert.alert('Error', error.message); return }
    await refreshProfile()
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
          <View style={styles.header}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepText}>Almost there</Text>
            </View>
            <Text style={styles.heading}>Set up your profile</Text>
            <Text style={styles.subheading}>
              This helps other members identify you and record contributions correctly.
            </Text>
          </View>

          {/* Full Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, nameFocused && styles.inputFocused]}
              placeholder="e.g. Kefilwe Moeti"
              placeholderTextColor={colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* Mobile Money — auto-detected */}
          {detectedMeta && (
            <View style={styles.field}>
              <Text style={styles.label}>Mobile Money</Text>
              <Text style={styles.fieldSubtext}>Detected from your phone number.</Text>
              <View style={[styles.providerPill, { backgroundColor: detectedMeta.color + '18' }]}>
                <ProviderLogo provider={provider} size={20} />
                <Text style={[styles.providerPillText, { color: detectedMeta.color }]}>
                  {detectedMeta.label} · {detectedMeta.network}
                </Text>
                <Ionicons name="checkmark-circle" size={15} color={detectedMeta.color} />
              </View>
            </View>
          )}

          {/* Bank Details */}
          <View style={styles.field}>
            <Text style={styles.sectionLabel}>Bank Details</Text>
          </View>
          <BankPicker value={bank} onChange={setBank} />

          {/* Consent */}
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setConsentGiven(v => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, consentGiven && styles.checkboxChecked]}>
              {consentGiven && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={styles.consentText}>
              I consent to Tshelo processing my personal data and mobile money information
              per the{' '}
              <Text
                style={styles.consentLink}
                onPress={event => { event.stopPropagation(); void openLegalDocument('privacy') }}
              >Privacy Policy</Text>
              {' '}and{' '}
              <Text
                style={styles.consentLink}
                onPress={event => { event.stopPropagation(); void openLegalDocument('terms') }}
              >Terms of Service</Text>.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.buttonDisabled]}
            onPress={handleSave}
            activeOpacity={isValid ? 0.85 : 1}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryButtonText}>Complete setup</Text>
            }
          </TouchableOpacity>
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
    paddingTop: 24,
    paddingBottom: 48,
  },
  header: { marginBottom: 32 },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0.3,
  },
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
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  fieldSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 10,
    marginTop: -4,
    lineHeight: 18,
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
  providerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
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
})
