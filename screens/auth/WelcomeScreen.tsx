import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { useAuth } from '../../context/AuthContext'

const { height } = Dimensions.get('window')

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>
}

export default function WelcomeScreen({ navigation }: Props) {
  const { signIn } = useAuth()

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoLetter}>T</Text>
        </View>
        <Text style={styles.appName}>Tshelo</Text>
        <Text style={styles.tagline}>
          Community savings,{'\n'}made simple.
        </Text>
      </View>

      <View style={styles.cardContainer}>
        <Text style={styles.cardHeading}>Manage funds together</Text>
        <Text style={styles.cardBody}>
          Track contributions for funerals, weddings, graduations and more —
          transparently and securely.
        </Text>

        <View style={styles.pillRow}>
          <View style={styles.pill}><Text style={styles.pillText}>Funeral</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>Wedding</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>Graduation</Text></View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Log In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Create an Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.devSkipButton}
          onPress={signIn}
          activeOpacity={0.8}
        >
          <Text style={styles.devSkipText}>⚡ Dev: Skip to App</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing you agree to our{' '}
          <Text style={styles.legalLink}>Terms of Service</Text> and{' '}
          <Text style={styles.legalLink}>Privacy Policy</Text>.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 32,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  logoLetter: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.surface,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 24,
  },
  cardContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    minHeight: height * 0.48,
  },
  cardHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 20,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  pill: {
    backgroundColor: colors.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  devSkipButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  devSkipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  legal: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: colors.primary,
    fontWeight: '600',
  },
})
