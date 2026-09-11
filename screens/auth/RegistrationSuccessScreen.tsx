import { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo, ActivityIndicator, Alert, Animated, Easing, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'
import { supabase } from '../../lib/supabase'
import { api } from '../../lib/api'
import { toApiUiError } from '../../lib/apiScreen'
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
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined
    let mounted = true

    function updateAnimation(reduceMotion: boolean) {
      animation?.stop()
      pulse.setValue(0)
      if (reduceMotion || !mounted) return

      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(250),
        ]),
      )
      animation.start()
    }

    void AccessibilityInfo.isReduceMotionEnabled().then(updateAnimation)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', updateAnimation)

    return () => {
      mounted = false
      animation?.stop()
      subscription.remove()
    }
  }, [pulse])

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] })
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0] })
  const circleScale = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] })

  async function handleGetStarted() {
    setLoading(true)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setLoading(false)
      Alert.alert('Session expired', 'Please log in again.')
      return
    }

    try {
      await api.users.updateMe({
        profile_completed: true,
        onboarding_completed: true,
      })
    } catch (profileError) {
      setLoading(false)
      Alert.alert('Could not finish setup', toApiUiError(profileError).message)
      return
    }

    await refreshProfile()
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.container}>
        <View style={styles.celebrationWrap}>
          <Animated.View
            testID="success-pulse"
            style={[
              styles.pulseHalo,
              { opacity: haloOpacity, transform: [{ scale: haloScale }] },
            ]}
          />
          <Animated.View style={[styles.celebrationCircle, { transform: [{ scale: circleScale }] }]}>
            <Ionicons name="checkmark" size={42} color="#16A34A" />
          </Animated.View>
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
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  pulseHalo: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#86EFAC',
  },
  celebrationCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#D2F8E4',
    alignItems: 'center',
    justifyContent: 'center',
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
