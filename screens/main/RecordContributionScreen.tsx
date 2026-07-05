import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { supabase } from '../../lib/supabase'
import { hapticSuccess, hapticError } from '../../lib/haptics'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

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

function detectProvider(phone: string): MobileMoneyProvider | null {
  const digits = phone.replace(/\D/g, '').replace(/^267/, '')
  if (digits.length < 2) return null
  const prefix = parseInt(digits.slice(0, 2), 10)
  if ([71, 72, 73, 76].includes(prefix)) return 'orange_money'
  if ([74, 75].includes(prefix))         return 'myzaka'
  if (prefix === 77)                     return 'smega'
  return null
}

type FundMemberOption = { id: string; name: string; phone: string }

export default function RecordContributionScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const requireOnline = useRequireOnline()
  const styles = makeStyles(colors)

  const { fundId, fundTitle, currencyCode } = route.params

  const [source, setSource]                   = useState<ContributionSource>('manual')
  const [contributorName, setContributorName] = useState('')
  const [contributorPhone, setContributorPhone] = useState('')
  const [amountBWP, setAmountBWP]             = useState('')
  const [providerOverride, setProviderOverride] = useState<MobileMoneyProvider | null>(null)
  const [showProviderPicker, setShowProviderPicker] = useState(false)
  const [notes, setNotes]                     = useState('')
  const [smsSnippet, setSmsSnippet]           = useState('')
  const [isSaving, setIsSaving]               = useState(false)
  const [fundMembers, setFundMembers]         = useState<FundMemberOption[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [isNameFocused, setIsNameFocused]     = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    async function loadMembers() {
      const [{ data: memberRows }, { data: profiles }] = await Promise.all([
        supabase.from('fund_members').select('id').eq('fund_id', fundId).eq('status', 'joined'),
        supabase.rpc('get_fund_member_profiles', { p_fund_id: fundId }),
      ])

      if (!active || !memberRows) return

      const profileByRowId = new Map<string, { name: string; phone: string }>(
        (profiles ?? []).map((p: any) => [p.member_row_id, { name: p.name, phone: p.phone }])
      )

      setFundMembers(
        memberRows
          .map(m => {
            const profile = profileByRowId.get(m.id)
            return profile ? { id: m.id, name: profile.name, phone: profile.phone } : null
          })
          .filter((m): m is FundMemberOption => m !== null)
      )
    }
    loadMembers()
    return () => { active = false }
  }, [fundId])

  useEffect(() => {
    return () => { if (blurTimeout.current) clearTimeout(blurTimeout.current) }
  }, [])

  function handlePickMember(member: FundMemberOption) {
    if (blurTimeout.current) clearTimeout(blurTimeout.current)
    setSelectedMemberId(member.id)
    setContributorName(member.name)
    setContributorPhone(member.phone)
    setProviderOverride(null)
    setShowProviderPicker(false)
    setIsNameFocused(false)
  }

  function handleNameChange(text: string) {
    setContributorName(text)
    setSelectedMemberId(null)
  }

  function handleNameFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current)
    setIsNameFocused(true)
  }

  function handleNameBlur() {
    blurTimeout.current = setTimeout(() => setIsNameFocused(false), 150)
  }

  const nameSuggestions = selectedMemberId
    ? []
    : fundMembers.filter(m =>
        contributorName.trim().length > 0 &&
        m.name.toLowerCase().includes(contributorName.trim().toLowerCase())
      )
  const showSuggestions = isNameFocused && nameSuggestions.length > 0

  const detectedProvider = detectProvider(contributorPhone)
  const provider = providerOverride ?? detectedProvider

  const parsedAmount = parseFloat(amountBWP.replace(/,/g, ''))
  const amountValid  = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= MAX_CONTRIBUTION_BWP

  const isValid =
    contributorName.trim().length >= 2 &&
    contributorPhone.trim().length >= 7 &&
    amountValid &&
    provider !== null &&
    (source === 'manual' || smsSnippet.trim().length > 0)

  function handleAmountChange(text: string) {
    setAmountBWP(text.replace(/[^0-9.]/g, ''))
  }

  function handlePhoneChange(text: string) {
    setContributorPhone(text)
    setProviderOverride(null)
    setShowProviderPicker(false)
    setSelectedMemberId(null)
  }

  async function handleSave() {
    if (!isValid || isSaving || !userId) return
    if (!requireOnline()) return
    setIsSaving(true)

    try {
      const now = new Date().toISOString()

      const { error } = await supabase.from('contributions').insert({
        fund_id:            fundId,
        contributor_name:   contributorName.trim(),
        contributor_phone:  contributorPhone.trim(),
        tagged_by:          userId,
        amount:             parsedAmount,
        currency_code:      currencyCode,
        payment_method:     provider,
        detected_via:       source === 'sms_detected' ? 'sms' : 'manual',
        status:             'confirmed',
        confirmed_by:       userId,
        confirmed_at:       now,
        notes:              source === 'sms_detected'
          ? [smsSnippet.trim(), notes.trim()].filter(Boolean).join('\n')
          : (notes.trim() || null),
      })

      if (error) {
        hapticError()
        Alert.alert('Could not save contribution', error.message)
        return
      }

      hapticSuccess()
      navigation.goBack()
    } catch (e) {
      hapticError()
      Alert.alert('Could not save contribution', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

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
          <View style={[styles.field, styles.nameFieldWrap]}>
            <Text style={styles.label}>Contributor Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mpho Dube"
              placeholderTextColor={colors.textMuted}
              value={contributorName}
              onChangeText={handleNameChange}
              onFocus={handleNameFocus}
              onBlur={handleNameBlur}
              autoCapitalize="words"
              returnKeyType="next"
              editable={!isSaving}
            />
            {selectedMemberId && (
              <Text style={styles.hint}>✓ Matched to fund member — phone filled in below.</Text>
            )}
            {showSuggestions && (
              <View style={styles.suggestDropdown}>
                <ScrollView keyboardShouldPersistTaps="handled" style={styles.suggestScroll} nestedScrollEnabled>
                  {nameSuggestions.map(member => (
                    <TouchableOpacity
                      key={member.id}
                      style={styles.suggestRow}
                      onPress={() => handlePickMember(member)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.quickPickAvatar}>
                        <Text style={styles.quickPickAvatarText}>
                          {member.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.suggestBody}>
                        <Text style={styles.suggestName} numberOfLines={1}>{member.name}</Text>
                        <Text style={styles.suggestPhone} numberOfLines={1}>{member.phone}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* ── Contributor phone ──────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Contributor Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 71234567"
              placeholderTextColor={colors.textMuted}
              value={contributorPhone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              returnKeyType="next"
              editable={!isSaving}
            />
            {contributorPhone.trim().length >= 2 && (
              detectedProvider ? (
                <View style={styles.detectedRow}>
                  <Text style={[styles.hint, { color: PROVIDERS.find(p => p.id === detectedProvider)!.color, fontWeight: '700' }]}>
                    ✓ {PROVIDERS.find(p => p.id === detectedProvider)!.label} detected
                  </Text>
                  {!showProviderPicker && (
                    <TouchableOpacity onPress={() => setShowProviderPicker(true)} disabled={isSaving}>
                      <Text style={styles.changeProviderText}>Not correct?</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text style={styles.hint}>Could not detect a provider from this number — select one below.</Text>
              )
            )}
          </View>

          {/* ── Amount ─────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Amount (P)</Text>
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
                editable={!isSaving}
              />
            </View>
            {amountBWP !== '' && !amountValid && (
              <Text style={styles.errorText}>
                {parsedAmount > MAX_CONTRIBUTION_BWP
                  ? `Exceeds sandbox cap of P ${MAX_CONTRIBUTION_BWP.toLocaleString()}`
                  : 'Enter a valid amount'}
              </Text>
            )}
          </View>

          {/* ── Provider (only shown when auto-detect needs help) ── */}
          {(!detectedProvider || showProviderPicker) && (
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
                    onPress={() => !isSaving && setProviderOverride(p.id)}
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
          )}

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
              editable={!isSaving}
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
            style={[styles.primaryButton, isValid && !isSaving && styles.buttonActive]}
            activeOpacity={isValid && !isSaving ? 0.85 : 1}
            onPress={handleSave}
            disabled={isSaving || !isValid}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.primaryButtonText, isValid && styles.primaryButtonTextActive]}>
                Save Contribution
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
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
      fontSize: 30,
      fontFamily: fonts.display.bold,
      color: colors.heading,
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
    quickPickAvatar: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickPickAvatarText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },
    nameFieldWrap: {
      position: 'relative',
      zIndex: 30,
    },
    suggestDropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: 4,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 8,
      zIndex: 30,
      overflow: 'hidden',
    },
    suggestScroll: {
      maxHeight: 220,
    },
    suggestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestBody: {
      flex: 1,
    },
    suggestName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    suggestPhone: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
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
    },
    textArea: {
      minHeight: 88,
      paddingTop: 14,
    },
    currencyRow: {
      flexDirection: 'row',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
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
    detectedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
    },
    changeProviderText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      textDecorationLine: 'underline',
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
      backgroundColor: colors.disabled,
      borderRadius: 28,
      paddingVertical: 17,
      alignItems: 'center',
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
      color: colors.disabledText,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    primaryButtonTextActive: {
      color: '#FFFFFF',
    },
  })
}
