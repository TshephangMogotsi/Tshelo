import { useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ReviewLogin'>
}

function isReviewerAccount(appMetadata: unknown) {
  return typeof appMetadata === 'object'
    && appMetadata !== null
    && (appMetadata as Record<string, unknown>).google_play_reviewer === true
}

export default function ReviewLoginScreen({ navigation }: Props) {
  const { isDark } = useTheme()
  const { refreshProfile } = useAuth()
  const requireOnline = useRequireOnline()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const bg = isDark ? '#1A1C24' : '#F4F2EB'
  const inputBg = isDark ? '#2D2E41' : '#FFFFFF'
  const textCol = isDark ? '#F2F2F7' : colors.textPrimary
  const mutedCol = isDark ? '#8A8A9A' : colors.textMuted
  const borderCol = isDark ? '#3A3A5C' : colors.border

  async function signIn() {
    if (!email.trim() || !password) return
    if (!requireOnline()) return

    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error || !data.user || !isReviewerAccount(data.user.app_metadata)) {
      await supabase.auth.signOut()
      setLoading(false)
      Alert.alert(
        'Review access unavailable',
        'These credentials are not configured for Google Play reviewer access.',
      )
      return
    }

    await refreshProfile()
    setLoading(false)
  }

  const valid = Boolean(email.trim() && password)

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: inputBg, borderColor: borderCol }]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to phone sign in"
          >
            <Ionicons name="arrow-back" size={20} color={textCol} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.heading}>Review access</Text>
            <Text style={[styles.subheading, { color: mutedCol }]}>For Google Play app review only.</Text>
          </View>

          <View style={styles.notice}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <Text style={styles.noticeText}>Use the credentials provided in Play Console. This sample account cannot make purchases or perform real payment actions.</Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: textCol }]}>Review email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: borderCol, color: textCol }]}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              placeholder="reviewer@example.com"
              placeholderTextColor={mutedCol}
              accessibilityLabel="Review email"
            />

            <Text style={[styles.label, { color: textCol }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: borderCol, color: textCol }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoCapitalize="none"
              placeholder="Password"
              placeholderTextColor={mutedCol}
              accessibilityLabel="Review password"
              onSubmitEditing={signIn}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, valid && styles.primaryButtonActive]}
            onPress={signIn}
            disabled={!valid || loading}
            accessibilityRole="button"
            accessibilityLabel="Sign in with review credentials"
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.primaryButtonText, valid && styles.primaryButtonTextActive]}>Sign in</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  backButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 36, borderWidth: 1 },
  header: { marginBottom: 24 },
  heading: { fontSize: 30, fontFamily: fonts.display.bold, color: '#9D86FF', marginBottom: 8 },
  subheading: { fontSize: 15, lineHeight: 22 },
  notice: { flexDirection: 'row', gap: 10, borderRadius: 14, backgroundColor: '#EEE8FF', padding: 14, marginBottom: 28 },
  noticeText: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  form: { gap: 10, marginBottom: 28 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 },
  input: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16 },
  primaryButton: { backgroundColor: '#D4D4D8', borderRadius: 28, paddingVertical: 17, alignItems: 'center' },
  primaryButtonActive: { backgroundColor: colors.primary },
  primaryButtonText: { color: '#676767', fontSize: 16, fontWeight: '700' },
  primaryButtonTextActive: { color: '#FFFFFF' },
})
