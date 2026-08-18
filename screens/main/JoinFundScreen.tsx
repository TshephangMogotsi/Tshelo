import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { useHardwareBack } from '../../lib/useHardwareBack'
import { api } from '../../lib/api'
import { runApiRead, toApiUiError } from '../../lib/apiScreen'
import { hapticSuccess, hapticError } from '../../lib/haptics'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'JoinFund'>
  route:      RouteProp<MainStackParamList, 'JoinFund'>
}

type Phase = 'input' | 'searching' | 'preview' | 'joining' | 'requested'

type FundPreview = {
  id:            string
  title:         string
  organiserName: string
  goalAmount:    number
  currencyCode:  string
  memberCount:   number
  isPrivate:     boolean
}

export default function JoinFundScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const requireOnline = useRequireOnline()
  const styles = makeStyles(colors)

  const initialCode = (route?.params as { code?: string } | undefined)?.code?.toUpperCase() ?? ''
  const [code, setCode]       = useState(initialCode)
  const [phase, setPhase]     = useState<Phase>('input')
  const [preview, setPreview] = useState<FundPreview | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const cleanedCode = code.trim().toUpperCase()
  const isValid     = cleanedCode.length >= 8

  useHardwareBack(() => {
    // From the fund preview, back returns to code entry rather than
    // popping the screen
    if (phase === 'preview') {
      setPhase('input')
      return true
    }
    return false
  })

  function handleCodeChange(text: string) {
    const cleaned = text.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
    setCode(cleaned)
    setError(null)
    setPreview(null)
    setPhase('input')
  }

  async function handleFind() {
    if (!isValid || !userId) return
    if (!requireOnline()) return
    setPhase('searching')
    setError(null)

    let fund
    try {
      fund = await runApiRead(call => api.funds.previewInvite(cleanedCode, call))
    } catch (findError) {
      setError('No fund found with that code. Double-check with the organiser.')
      setPhase('input')
      return
    }

    if (fund.status !== 'active') {
      setError('This fund is closed and no longer accepting new members.')
      setPhase('input')
      return
    }

    if (fund.existing_membership_status && !['left', 'removed', 'declined'].includes(fund.existing_membership_status)) {
      setError("You're already a member of this fund.")
      setPhase('input')
      return
    }

    setPreview({
      id:            fund.fund_id,
      title:         fund.title,
      organiserName: fund.organiser_name ?? 'Unknown',
      goalAmount:    Number(fund.goal_amount),
      currencyCode:  fund.currency_code,
      memberCount:   fund.member_count,
      isPrivate:     fund.is_private,
    })
    setPhase('preview')
  }

  async function handleJoin() {
    if (!preview || !userId) return
    if (!requireOnline()) return
    setPhase('joining')

    let membership
    try {
      membership = await api.funds.join({ code: cleanedCode })
    } catch (joinError) {
      hapticError()
      Alert.alert('Error', toApiUiError(joinError).message)
      setPhase('preview')
      return
    }

    hapticSuccess()
    if (membership?.membership_status === 'pending') {
      setPhase('requested')
      return
    }

    navigation.replace('FundDetail', { fundId: membership?.fund_id ?? preview.id })
  }

  const isBusy = phase === 'searching' || phase === 'joining'

  function formatMoney(amount: number, currencyCode: string) {
    const symbol = currencyCode === 'BWP' ? 'P' : currencyCode
    return `${symbol} ${amount.toLocaleString('en-BW', { maximumFractionDigits: 0 })}`
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {phase === 'requested' ? (
        <View style={styles.container}>
          <View style={[styles.iconWrap, styles.requestedIconWrap]}>
            <Text style={styles.icon}>⏳</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.heading}>Request Sent</Text>
            <Text style={styles.subheading}>
              {preview?.title ?? 'This fund'} is private. The organiser needs to approve your
              request before you can view or contribute.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              ℹ️  You'll see this fund on your Home screen once you're admitted. No action needed
              from you in the meantime.
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryButton, styles.buttonActive]}
              activeOpacity={0.85}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.primaryButtonText, styles.primaryButtonTextActive]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
        ) : (
        <View style={styles.container}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🔗</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.heading}>Join a Fund</Text>
            <Text style={styles.subheading}>
              Ask the fund organiser for their invite code and enter it below.
            </Text>
          </View>

          {/* ── Code input ─────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Invite Code</Text>
            <TextInput
              style={[
                styles.codeInput,
                isValid && styles.codeInputValid,
                phase === 'preview' && styles.codeInputLocked,
              ]}
              placeholder="e.g. FND-A1B2C3D4E5F678901234"
              placeholderTextColor={colors.textMuted}
              value={code}
              onChangeText={handleCodeChange}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              maxLength={32}
              editable={!isBusy && phase !== 'preview'}
            />
            <Text style={styles.hint}>
              Invite codes are case-insensitive. Paste the complete code shown by the organiser.
            </Text>
          </View>


          {/* ── Error ──────────────────────────────── */}
          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Fund preview ───────────────────────── */}
          {preview && phase === 'preview' && (
            <View style={styles.previewCard}>
              <View style={styles.previewTitleRow}>
                <Text style={styles.previewTitle}>{preview.title}</Text>
                {preview.isPrivate && (
                  <View style={styles.privateBadge}>
                    <Text style={styles.privateBadgeText}>🔒 Private</Text>
                  </View>
                )}
              </View>
              {preview.isPrivate && (
                <Text style={styles.privateHint}>
                  Your join request will need approval from the organiser before you can view this fund.
                </Text>
              )}
              <View style={styles.previewRows}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewRowLabel}>Organiser</Text>
                  <Text style={styles.previewRowValue}>{preview.organiserName}</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewRow}>
                  <Text style={styles.previewRowLabel}>Goal</Text>
                  <Text style={styles.previewRowValue}>
                    {formatMoney(preview.goalAmount, preview.currencyCode)}
                  </Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewRow}>
                  <Text style={styles.previewRowLabel}>Members</Text>
                  <Text style={styles.previewRowValue}>{preview.memberCount}</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Info card (input phase only) ───────── */}
          {phase === 'input' && !error && (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                ℹ️  Joining a fund does not cost any tokens. You'll be able to view contributions,
                expenses, and the fund summary once admitted.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            {/* Try different code link in preview phase */}
            {phase === 'preview' && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => {
                  setCode('')
                  setPreview(null)
                  setPhase('input')
                }}
              >
                <Text style={styles.resetButtonText}>Try a different code</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, (isValid || phase === 'preview') && !isBusy && styles.buttonActive]}
              activeOpacity={(isValid || phase === 'preview') && !isBusy ? 0.85 : 1}
              onPress={phase === 'preview' ? handleJoin : handleFind}
              disabled={isBusy || (!isValid && phase !== 'preview')}
            >
              {isBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[
                  styles.primaryButtonText,
                  (isValid || phase === 'preview') && styles.primaryButtonTextActive,
                ]}>
                  {phase === 'preview' ? (preview?.isPrivate ? 'Request to Join' : 'Join Fund') : 'Find Fund'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        )}
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
      marginBottom: 28,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backIcon: {
      fontSize: 20,
      color: colors.textPrimary,
    },
    iconWrap: {
      width: 68,
      height: 68,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    requestedIconWrap: {
      backgroundColor: colors.accentLight,
    },
    icon: {
      fontSize: 32,
    },
    header: {
      marginBottom: 28,
    },
    heading: {
      fontSize: 30,
      fontFamily: fonts.display.bold,
      color: colors.heading,
      marginBottom: 8,
    },
    subheading: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    field: {
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    codeInput: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 15,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 2,
    },
    codeInputValid: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    codeInputLocked: {
      opacity: 0.5,
    },
    hint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 6,
    },
    segmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 24,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentText: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 2,
      minWidth: 52,
      textAlign: 'center',
    },
    segmentDash: {
      fontSize: 14,
      color: colors.textMuted,
    },
    errorCard: {
      backgroundColor: colors.errorLight,
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
    },
    errorText: {
      fontSize: 13,
      color: colors.error,
      lineHeight: 20,
    },
    previewCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 8,
    },
    previewTitle: {
      fontSize: 18,
      fontFamily: fonts.display.bold,
      color: colors.heading,
      flex: 1,
    },
    privateBadge: {
      backgroundColor: colors.accentLight,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    privateBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.accent,
    },
    privateHint: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
      marginBottom: 16,
    },
    previewRows: {
      gap: 0,
    },
    previewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
    },
    previewDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    previewRowLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    previewRowValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    infoCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: 14,
      padding: 16,
      marginBottom: 32,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    actions: {
      marginTop: 'auto',
      gap: 12,
    },
    resetButton: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    resetButtonText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
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
