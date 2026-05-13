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
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { MainStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'JoinFund'>
}

export default function JoinFundScreen({ navigation }: Props) {
  const [code, setCode] = useState('')

  const cleanedCode = code.trim().toLowerCase()
  const isValid = cleanedCode.length === 16  // invite_code = 8 random bytes → 16 hex chars

  function handleCodeChange(text: string) {
    // allow hex characters only, auto-uppercase for display
    const cleaned = text.replace(/[^a-fA-F0-9]/g, '').slice(0, 16)
    setCode(cleaned.toUpperCase())
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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

          <View style={styles.field}>
            <Text style={styles.label}>Invite Code</Text>
            <TextInput
              style={[styles.codeInput, isValid && styles.codeInputValid]}
              placeholder="e.g. A3F9B1C2D4E56789"
              placeholderTextColor={colors.textMuted}
              value={code}
              onChangeText={handleCodeChange}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              maxLength={16}
            />
            <Text style={styles.hint}>
              Invite codes are 16 characters long and case-insensitive.
            </Text>
          </View>

          {/* ── Code segments display ──────────────── */}
          {code.length > 0 && (
            <View style={styles.segmentRow}>
              <Text style={styles.segmentText}>
                {code.slice(0, 4) || '____'}
              </Text>
              <Text style={styles.segmentDash}>—</Text>
              <Text style={styles.segmentText}>
                {code.slice(4, 8) || '____'}
              </Text>
              <Text style={styles.segmentDash}>—</Text>
              <Text style={styles.segmentText}>
                {code.slice(8, 12) || '____'}
              </Text>
              <Text style={styles.segmentDash}>—</Text>
              <Text style={styles.segmentText}>
                {code.slice(12, 16) || '____'}
              </Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              ℹ️  Joining a fund does not cost any tokens. You'll be able to view contributions,
              expenses, and the fund summary once admitted.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.buttonDisabled]}
            activeOpacity={isValid ? 0.85 : 1}
            onPress={() => {
              if (!isValid) return
              // TODO: Supabase lookup by invite_code + insert fund_member
            }}
          >
            <Text style={[styles.primaryButtonText, !isValid && styles.buttonTextDisabled]}>
              Join Fund
            </Text>
          </TouchableOpacity>
        </View>
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
  icon: {
    fontSize: 32,
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
    borderRadius: 14,
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
