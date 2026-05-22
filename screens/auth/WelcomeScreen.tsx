import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>
}

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} translucent />

      {/* ── Hero ───────────────────────────────────── */}
      <View style={styles.hero}>
        <Text style={styles.appName}>TSHELO</Text>
      </View>

      {/* ── Card ───────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.heading}>
          Community Savings{'\n'}Made Simple
        </Text>
        <Text style={styles.body}>
          Track contributions for funerals, weddings, graduations and more,
          transparently and securely.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>LOGIN</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Create an Account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  // ── Hero
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  appName: {
    fontSize: 42,
    fontFamily: fonts.display.bold,
    color: '#FFFFFF',
    letterSpacing: 6,
  },

  // ── Card
  card: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 34,
    fontFamily: fonts.display.bold,
    color: colors.textPrimary,
    lineHeight: 42,
    marginBottom: 14,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  secondaryButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})
