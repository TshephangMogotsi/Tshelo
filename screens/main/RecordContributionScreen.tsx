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
import { MainStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'RecordContribution'>
  route: RouteProp<MainStackParamList, 'RecordContribution'>
}

type MobileMoneyProvider = 'orange_money' | 'myzaka' | 'smega'
type ContributionSource  = 'sms_detected' | 'manual'

const PROVIDERS: { id: MobileMoneyProvider; label: string; color: string }[] = [
  { id: 'orange_money', label: 'Orange Money', color: '#FF6B00' },
  { id: 'myzaka',       label: 'MyZaka',       color: '#009FE3' },
  { id: 'smega',        label: 'Smega',        color: '#8B2FC9' },
]

const MAX_CONTRIBUTION_BWP = 10000

export default function RecordContributionScreen({ navigation, route }: Props) {
  const { fundId, fundTitle } = route.params

  const [source, setSource]               = useState<ContributionSource>('manual')
  const [contributorName, setContributorName] = useState('')
  const [amountBWP, setAmountBWP]         = useState('')
  const [provider, setProvider]           = useState<MobileMoneyProvider | null>(null)
  const [notes, setNotes]                 = useState('')
  const [smsSnippet, setSmsSnippet]       = useState('')

  const parsedAmount = parseFloat(amountBWP.replace(/,/g, ''))
  const amountValid  = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= MAX_CONTRIBUTION_BWP

  const isValid =
    contributorName.trim().length >= 2 &&
    amountValid &&
    provider !== null &&
    (source === 'manual' || smsSnippet.trim().length > 0)

  function handleAmountChange(text: string) {
    setAmountBWP(text.replace(/[^0-9.]/g, ''))
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
          {/* ── Header ─────────────────────────────── */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.heading}>Record Contribution</Text>
            <Text style={styles.subheading} numberOfLines={1}>
              {fundTitle}
            </Text>
          </View>

          {/* ── Source toggle ──────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>How was this received?</Text>
            <View style={styles.sourceToggle}>
              <TouchableOpacity
                style={[styles.sourceOption, source === 'manual' && styles.sourceOptionActive]}
                onPress={() => setSource('manual')}
                activeOpacity={0.8}
              >
                <Text style={styles.sourceOptionEmoji}>✍️</Text>
                <Text style={[
                  styles.sourceOptionText,
                  source === 'manual' && styles.sourceOptionTextActive,
                ]}>
                  Manual Entry
                </Text>
                <Text style={[
                  styles.sourceOptionHint,
                  source === 'manual' && { color: colors.primary },
                ]}>
                  Cash or undetected
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sourceOption, source === 'sms_detected' && styles.sourceOptionActive]}
                onPress={() => setSource('sms_detected')}
                activeOpacity={0.8}
              >
                <Text style={styles.sourceOptionEmoji}>📱</Text>
                <Text style={[
                  styles.sourceOptionText,
                  source === 'sms_detected' && styles.sourceOptionTextActive,
                ]}>
                  SMS Detected
                </Text>
                <Text style={[
                  styles.sourceOptionHint,
                  source === 'sms_detected' && { color: colors.primary },
                ]}>
                  From mobile money SMS
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── SMS snippet (conditional) ──────────── */}
          {source === 'sms_detected' && (
            <View style={styles.field}>
              <Text style={styles.label}>SMS Text</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Paste the mobile money SMS here…"
                placeholderTextColor={colors.textMuted}
                value={smsSnippet}
                onChangeText={setSmsSnippet}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>
                This is stored for audit purposes.
              </Text>
            </View>
          )}

          {/* ── Contributor name ───────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Contributor Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mpho Dube"
              placeholderTextColor={colors.textMuted}
              value={contributorName}
              onChangeText={setContributorName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* ── Amount ─────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Amount (BWP)</Text>
            <View style={styles.currencyRow}>
              <View style={styles.currencyPrefix}>
                <Text style={styles.currencySymbol}>P</Text>
              </View>
              <TextInput
                style={styles.currencyInput}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={amountBWP}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            {amountBWP !== '' && !amountValid && (
              <Text style={styles.errorText}>
                {parsedAmount > MAX_CONTRIBUTION_BWP
                  ? `Exceeds sandbox cap of BWP ${MAX_CONTRIBUTION_BWP.toLocaleString()}`
                  : 'Enter a valid amount'}
              </Text>
            )}
          </View>

          {/* ── Provider ───────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Mobile Money Provider</Text>
            <View style={styles.providerRow}>
              {PROVIDERS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.providerChip,
                    provider === p.id && { borderColor: p.color, backgroundColor: p.color + '14' },
                  ]}
                  onPress={() => setProvider(p.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.providerDot, { backgroundColor: p.color + '22' }]}>
                    <Text style={[styles.providerDotText, { color: p.color }]}>
                      {p.label.charAt(0)}
                    </Text>
                  </View>
                  <Text style={[
                    styles.providerChipLabel,
                    provider === p.id && { color: p.color, fontWeight: '700' },
                  ]}>
                    {p.label}
                  </Text>
                  {provider === p.id && (
                    <Text style={[styles.providerCheck, { color: p.color }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Notes ──────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any additional context…"
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              maxLength={200}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{notes.length}/200</Text>
          </View>

          {/* ── Audit note ─────────────────────────── */}
          <View style={styles.auditCard}>
            <Text style={styles.auditText}>
              🔒 This contribution will be recorded in the fund's audit log with your name and a timestamp. It cannot be deleted.
            </Text>
          </View>

          {/* ── Submit ─────────────────────────────── */}
          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.buttonDisabled]}
            activeOpacity={isValid ? 0.85 : 1}
            onPress={() => {
              if (!isValid) return
              // TODO: Supabase insert into contributions
              navigation.goBack()
            }}
          >
            <Text style={[styles.primaryButtonText, !isValid && styles.buttonTextDisabled]}>
              Save Contribution
            </Text>
          </TouchableOpacity>
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
    marginBottom: 28,
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
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  field: {
    marginBottom: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optional: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'none',
    fontWeight: '400',
    letterSpacing: 0,
  },
  sourceToggle: {
    flexDirection: 'row',
    gap: 10,
  },
  sourceOption: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
    gap: 4,
  },
  sourceOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sourceOptionEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  sourceOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sourceOptionTextActive: {
    color: colors.primary,
  },
  sourceOptionHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
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
  textArea: {
    minHeight: 88,
    paddingTop: 14,
  },
  currencyRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  currencyPrefix: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  currencyInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  providerRow: {
    gap: 10,
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
    gap: 10,
  },
  providerDot: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerDotText: {
    fontSize: 15,
    fontWeight: '800',
  },
  providerChipLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  providerCheck: {
    fontSize: 16,
    fontWeight: '800',
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  auditCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  auditText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
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
})
