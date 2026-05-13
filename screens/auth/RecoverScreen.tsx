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
import { AuthStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Recover'>
}

export default function RecoverScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('')

  const cleanedPhone = phone.replace(/\D/g, '')
  const isValid = cleanedPhone.length === 8

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
        >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🔑</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.heading}>Recover your account</Text>
            <Text style={styles.subheading}>
              Enter the phone number linked to your Tshelo account.
              We'll send a verification code to confirm it's you.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryFlag}>🇧🇼</Text>
                <Text style={styles.countryCodeText}>+267</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="71 234 567"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={9}
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              Account recovery only works if your phone number is registered.
              If you no longer have access to it, contact{' '}
              <Text style={styles.infoLink}>support@tshelo.co.bw</Text>.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.buttonDisabled]}
            onPress={() =>
              isValid &&
              navigation.navigate('OTP', {
                phone: `+267${cleanedPhone}`,
                mode: 'recover',
              })
            }
            activeOpacity={isValid ? 0.85 : 1}
          >
            <Text style={[styles.primaryButtonText, !isValid && styles.buttonTextDisabled]}>
              Send Recovery Code
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginRow}
            onPress={() => navigation.replace('Login')}
          >
            <Text style={styles.loginText}>Back to </Text>
            <Text style={styles.loginLink}>Log In</Text>
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
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
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
    backgroundColor: colors.accentLight,
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
    marginBottom: 10,
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    gap: 6,
    backgroundColor: colors.background,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.accentLight,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginBottom: 32,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
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
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
})
