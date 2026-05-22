import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native'
import { useState } from 'react'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../context/AuthContext'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'RegistrationSuccess'>
}

export default function RegistrationSuccessScreen({ navigation }: Props) {
  const { refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)

  async function handleGetStarted() {
    setLoading(true)
    await refreshProfile()
    // AuthContext switches to MainNavigator automatically
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.container}>
        {/* ── Glow rings ─────────────────────────────── */}
        <View style={styles.glowOuter} />
        <View style={styles.glowInner} />

        {/* ── Illustration ───────────────────────────── */}
        <View style={styles.illustration}>
          <Text style={styles.emoji}>🎉</Text>
        </View>

        {/* ── Copy ───────────────────────────────────── */}
        <Text style={styles.heading}>You're all set!</Text>
        <Text style={styles.body}>
          Welcome to Tshelo. Start creating or joining funds with your community.
        </Text>

        {/* ── Actions ────────────────────────────────── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGetStarted}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryButtonText}>Get started</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },

  // ── Glow rings (decorative)
  glowOuter: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.primaryLight,
    opacity: 0.5,
  },
  glowInner: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primaryLight,
    opacity: 0.7,
  },

  // ── Illustration
  illustration: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  emoji: {
    fontSize: 60,
  },

  // ── Copy
  heading: {
    fontSize: 32,
    fontFamily: fonts.display.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 48,
  },

  // ── Actions
  actions: {
    width: '100%',
    gap: 12,
  },
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
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})
