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
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>
  route: RouteProp<AuthStackParamList, 'Register'>
}

type MobileMoneyProvider = 'orange_money' | 'myzaka' | 'smega'

const PROVIDERS: { id: MobileMoneyProvider; label: string; color: string; description: string }[] = [
  {
    id: 'orange_money',
    label: 'Orange Money',
    color: '#FF6B00',
    description: 'Send via your Orange number',
  },
  {
    id: 'myzaka',
    label: 'MyZaka',
    color: '#009FE3',
    description: 'Mascom mobile money',
  },
  {
    id: 'smega',
    label: 'Smega',
    color: '#8B2FC9',
    description: 'BTC Botswana mobile money',
  },
]

function ProviderInitial({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.providerIcon, { backgroundColor: color + '1A' }]}>
      <Text style={[styles.providerIconText, { color }]}>
        {label.charAt(0)}
      </Text>
    </View>
  )
}

export default function RegisterScreen({ navigation }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [provider, setProvider] = useState<MobileMoneyProvider | null>(null)
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)

  const cleanedPhone = phone.replace(/\D/g, '')
  const cleanedMobileMoneyNumber = mobileMoneyNumber.replace(/\D/g, '')

  const isValid =
    displayName.trim().length >= 2 &&
    cleanedPhone.length === 8 &&
    provider !== null &&
    cleanedMobileMoneyNumber.length === 8 &&
    consentGiven

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
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.heading}>Create account</Text>
            <Text style={styles.subheading}>
              Set up your Tshelo profile to start managing community funds.
            </Text>
          </View>

          {/* ── Display Name ─────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Kefilwe Moeti"
              placeholderTextColor={colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* ── Phone Number ─────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryFlag}>🇧🇼</Text>
                <Text style={styles.countryCodeText}>+267</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="71 234 567"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={9}
                returnKeyType="next"
              />
            </View>
            <Text style={styles.hint}>This becomes your login number.</Text>
          </View>

          {/* ── Mobile Money Provider ────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Mobile Money Provider</Text>
            <Text style={styles.fieldSubtext}>
              Used to record contributions to your funds.
            </Text>
            <View style={styles.providerList}>
              {PROVIDERS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.providerCard,
                    provider === p.id && styles.providerCardSelected,
                  ]}
                  onPress={() => setProvider(p.id)}
                  activeOpacity={0.8}
                >
                  <ProviderInitial label={p.label} color={p.color} />
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerLabel}>{p.label}</Text>
                    <Text style={styles.providerDescription}>{p.description}</Text>
                  </View>
                  <View style={[
                    styles.radioOuter,
                    provider === p.id && styles.radioOuterSelected,
                  ]}>
                    {provider === p.id && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Mobile Money Number ──────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Mobile Money Number</Text>
            <Text style={styles.fieldSubtext}>
              May differ from your phone number.
            </Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryFlag}>🇧🇼</Text>
                <Text style={styles.countryCodeText}>+267</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="71 234 567"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={mobileMoneyNumber}
                onChangeText={setMobileMoneyNumber}
                maxLength={9}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* ── Consent ──────────────────────────────── */}
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setConsentGiven(v => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, consentGiven && styles.checkboxChecked]}>
              {consentGiven && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              I consent to Tshelo processing my personal data and mobile money information
              in accordance with the{' '}
              <Text style={styles.consentLink}>Privacy Policy</Text>
              {' '}and{' '}
              <Text style={styles.consentLink}>Terms of Service</Text>.
            </Text>
          </TouchableOpacity>

          {/* ── Submit ───────────────────────────────── */}
          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.buttonDisabled]}
            onPress={() =>
              isValid &&
              navigation.navigate('OTP', {
                phone: `+267${cleanedPhone}`,
                mode: 'register',
              })
            }
            activeOpacity={isValid ? 0.85 : 1}
          >
            <Text style={[styles.primaryButtonText, !isValid && styles.buttonTextDisabled]}>
              Continue
            </Text>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={styles.loginLink}>Log in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  header: {
    marginBottom: 28,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 10,
    marginTop: -2,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.textPrimary,
  },
  phoneRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    gap: 6,
    backgroundColor: colors.background,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  providerList: {
    gap: 10,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  providerCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  providerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerIconText: {
    fontSize: 18,
    fontWeight: '800',
  },
  providerInfo: {
    flex: 1,
  },
  providerLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  providerDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
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
  checkmark: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '800',
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  consentLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
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
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
})
