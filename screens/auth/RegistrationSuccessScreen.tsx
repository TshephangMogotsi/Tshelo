import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'RegistrationSuccess'>
}

const FEATURES = [
  'SMS payment detection',
  'Full transparency for members',
  'Receipt scanning',
  'Export PDF reports',
]

export default function RegistrationSuccessScreen({ navigation }: Props) {
  const { refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)

  async function handleGetStarted() {
    setLoading(true)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setLoading(false)
      Alert.alert('Session expired', 'Please log in again.')
      return
    }

    const { error } = await supabase.from('users').update({
      profile_completed: true,
      onboarding_completed: true,
    }).eq('id', user.id)

    if (error) {
      setLoading(false)
      Alert.alert('Error', error.message)
      return
    }

    await refreshProfile()
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.container}>
        <View style={styles.celebrationWrap}>
          <Text style={styles.confetti}>🎉</Text>
          <View style={styles.celebrationCircle}>
            <Ionicons name="checkmark" size={42} color="#16A34A" />
          </View>
          <Text style={styles.sparkle}>✨</Text>
        </View>

        <Text style={styles.heading}>You're all set!</Text>
        <Text style={styles.body}>
          Your account is ready. Let's create your first fund or event.
        </Text>

        <View style={styles.freeCard}>
          <Text style={styles.freeTitle}>Your first fund is FREE</Text>
          <View style={styles.featureList}>
            {FEATURES.map(feature => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons name="checkmark" size={17} color="#22C55E" />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleGetStarted}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryButtonText}>Let's Go!</Text>
          }
        </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 48,
    alignItems: 'center',
  },
  celebrationWrap: {
    width: 140,
    height: 124,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  celebrationCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#D2F8E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confetti: {
    position: 'absolute',
    left: 8,
    top: 8,
    fontSize: 22,
    zIndex: 1,
  },
  sparkle: {
    position: 'absolute',
    right: 2,
    top: 38,
    fontSize: 22,
    zIndex: 1,
  },
  heading: {
    fontSize: 28,
    lineHeight: 35,
    fontFamily: fonts.display.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 32,
    maxWidth: 300,
  },
  freeCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    marginBottom: 32,
  },
  freeTitle: {
    fontSize: 17,
    lineHeight: 23,
    color: colors.textPrimary,
    fontWeight: '800',
    marginBottom: 22,
  },
  featureList: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureText: {
    flex: 1,
    color: '#737373',
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 28,
    paddingVertical: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
