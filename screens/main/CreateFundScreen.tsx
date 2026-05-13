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
import { MainStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'CreateFund'>
}

type FundType = 'funeral' | 'wedding' | 'graduation' | 'birthday' | 'party' | 'other'

const FUND_TYPES: { id: FundType; emoji: string; label: string; color: string }[] = [
  { id: 'funeral',    emoji: '🕊️', label: 'Funeral',    color: '#6B7280' },
  { id: 'wedding',    emoji: '💍', label: 'Wedding',    color: '#EC4899' },
  { id: 'graduation', emoji: '🎓', label: 'Graduation', color: '#8B5CF6' },
  { id: 'birthday',   emoji: '🎂', label: 'Birthday',   color: '#F59E0B' },
  { id: 'party',      emoji: '🎉', label: 'Party',      color: '#10B981' },
  { id: 'other',      emoji: '📁', label: 'Other',      color: '#6B7280' },
]

const TOKEN_COST = 1
const MAX_GOAL_BWP = 10000  // sandbox cap

export default function CreateFundScreen({ navigation }: Props) {
  const [fundType, setFundType]     = useState<FundType | null>(null)
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [goalBWP, setGoalBWP]       = useState('')
  const [maxMembers, setMaxMembers] = useState('20')

  const tokenBalance = 3  // replace with auth user token_balance

  const parsedGoal = parseFloat(goalBWP.replace(/,/g, ''))
  const goalValid  = !isNaN(parsedGoal) && parsedGoal > 0 && parsedGoal <= MAX_GOAL_BWP

  const isValid =
    fundType !== null &&
    title.trim().length >= 3 &&
    goalValid &&
    parseInt(maxMembers) >= 2 &&
    tokenBalance >= TOKEN_COST

  function handleGoalChange(text: string) {
    // allow digits and one decimal point only
    const cleaned = text.replace(/[^0-9.]/g, '')
    setGoalBWP(cleaned)
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
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.tokenIndicator}>
              <Text style={styles.tokenEmoji}>🪙</Text>
              <Text style={styles.tokenText}>{tokenBalance} tokens</Text>
            </View>
          </View>

          <View style={styles.header}>
            <Text style={styles.heading}>Create a Fund</Text>
            <Text style={styles.subheading}>
              Each fund costs <Text style={styles.highlight}>1 token</Text> to create.
              You have {tokenBalance} token{tokenBalance !== 1 ? 's' : ''}.
            </Text>
          </View>

          {/* ── Fund Type ──────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Fund Type</Text>
            <View style={styles.typeGrid}>
              {FUND_TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.typeCard,
                    fundType === t.id && { borderColor: t.color, backgroundColor: t.color + '12' },
                  ]}
                  onPress={() => setFundType(t.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.typeEmoji}>{t.emoji}</Text>
                  <Text style={[
                    styles.typeLabel,
                    fundType === t.id && { color: t.color, fontWeight: '700' },
                  ]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Title ──────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Fund Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ntate Moeti's Funeral Fund"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              returnKeyType="next"
            />
            <Text style={styles.charCount}>{title.length}/80</Text>
          </View>

          {/* ── Description ────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Description <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add context for fund members…"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              maxLength={300}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/300</Text>
          </View>

          {/* ── Goal Amount ────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Goal Amount (BWP)</Text>
            <View style={styles.currencyRow}>
              <View style={styles.currencyPrefix}>
                <Text style={styles.currencySymbol}>P</Text>
              </View>
              <TextInput
                style={styles.currencyInput}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={goalBWP}
                onChangeText={handleGoalChange}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            {goalBWP !== '' && !goalValid && (
              <Text style={styles.errorText}>
                {parsedGoal > MAX_GOAL_BWP
                  ? `Sandbox cap is BWP ${MAX_GOAL_BWP.toLocaleString()}`
                  : 'Enter a valid amount'}
              </Text>
            )}
            <Text style={styles.hint}>Maximum BWP 10,000 during sandbox period.</Text>
          </View>

          {/* ── Max Members ────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Max Members</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setMaxMembers(v => String(Math.max(2, parseInt(v) - 1)))}
              >
                <Text style={styles.stepperIcon}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{maxMembers}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setMaxMembers(v => String(Math.min(20, parseInt(v) + 1)))}
              >
                <Text style={styles.stepperIcon}>＋</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Sandbox limit: 20 members per fund.</Text>
          </View>

          {/* ── Cost Summary ───────────────────────── */}
          <View style={styles.costCard}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Fund creation cost</Text>
              <Text style={styles.costValue}>🪙 {TOKEN_COST} token</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Your balance after</Text>
              <Text style={[
                styles.costValue,
                tokenBalance - TOKEN_COST < 0 && { color: colors.error },
              ]}>
                🪙 {tokenBalance - TOKEN_COST} token{tokenBalance - TOKEN_COST !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {tokenBalance < TOKEN_COST && (
            <View style={styles.noTokensBanner}>
              <Text style={styles.noTokensText}>
                ⚠️ You don't have enough tokens. Purchase more to create a fund.
              </Text>
            </View>
          )}

          {/* ── Submit ─────────────────────────────── */}
          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.buttonDisabled]}
            activeOpacity={isValid ? 0.85 : 1}
            onPress={() => {
              if (!isValid) return
              // TODO: Supabase insert + token deduct
              navigation.goBack()
            }}
          >
            <Text style={[styles.primaryButtonText, !isValid && styles.buttonTextDisabled]}>
              Create Fund — 🪙 {TOKEN_COST}
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  tokenIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    gap: 6,
  },
  tokenEmoji: {
    fontSize: 15,
  },
  tokenText: {
    fontSize: 13,
    fontWeight: '700',
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
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  highlight: {
    color: colors.primary,
    fontWeight: '700',
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 6,
  },
  typeEmoji: {
    fontSize: 24,
  },
  typeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
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
    minHeight: 96,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
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
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 52,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  stepperIcon: {
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  costCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  noTokensBanner: {
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  noTokensText: {
    fontSize: 13,
    color: colors.error,
    lineHeight: 19,
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
