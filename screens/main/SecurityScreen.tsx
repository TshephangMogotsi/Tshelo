import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../context/ThemeContext'
import { useAuth, type SecuritySessionDetails } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { api } from '../../lib/api'
import type { MainStackParamList } from '../../navigation/types'
import type { AccountClosureRequest } from '../../shared/contracts/users'
import { fonts } from '../../theme/typography'
import type { AppColors } from '../../theme/themes'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'Security'>
}

const DEVICE_LABEL = Platform.select({
  ios: 'iOS device',
  android: 'Android device',
  default: 'Current device',
}) ?? 'Current device'

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('267')) {
    const local = digits.slice(3)
    return `+267 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`
  }
  return phone
}

function formatDateTime(value: string | null) {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return date.toLocaleString('en-BW', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SecurityScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme()
  const { loadSecuritySession, signOutOtherSessions } = useAuth()
  const requireOnline = useRequireOnline()
  const styles = makeStyles(colors)
  const [details, setDetails] = useState<SecuritySessionDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false)
  const [closureRequest, setClosureRequest] = useState<AccountClosureRequest | null>(null)
  const [isClosureLoading, setIsClosureLoading] = useState(true)
  const [isRequestingClosure, setIsRequestingClosure] = useState(false)

  useFocusEffect(useCallback(() => {
    let active = true
    setIsLoading(true)
    setLoadError(false)
    setIsClosureLoading(true)

    void loadSecuritySession().then(session => {
      if (!active) return
      setDetails(session)
      setIsLoading(false)
    }).catch(() => {
      if (!active) return
      setDetails(null)
      setLoadError(true)
      setIsLoading(false)
    })

    void api.users.getAccountClosureRequest().then(request => {
      if (!active) return
      setClosureRequest(request)
      setIsClosureLoading(false)
    }).catch(() => {
      if (!active) return
      setClosureRequest(null)
      setIsClosureLoading(false)
    })

    return () => { active = false }
  }, [loadSecuritySession, refreshKey]))

  async function signOutOtherDevices() {
    if (!requireOnline()) return
    setIsSigningOutOthers(true)
    try {
      await signOutOtherSessions()
    } catch {
      Alert.alert('Could not sign out other devices', 'Please try again.')
      return
    } finally {
      setIsSigningOutOthers(false)
    }

    Alert.alert(
      'Other devices signed out',
      'This device remains signed in. Other devices may take a short time to lose access.',
    )
  }

  function confirmSignOutOtherDevices() {
    Alert.alert(
      'Sign out other devices?',
      'Every other Tshelo session will be ended. You will stay signed in on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => { void signOutOtherDevices() },
        },
      ],
    )
  }

  async function submitAccountClosureRequest() {
    if (!requireOnline()) return
    setIsRequestingClosure(true)
    try {
      const request = await api.users.requestAccountClosure()
      setClosureRequest(request)
      Alert.alert(
        'Request received',
        `Your account remains active while Tshelo reviews request ${request.ticket_number}.`,
      )
    } catch {
      Alert.alert('Could not send request', 'Please try again. Your account has not been changed.')
    } finally {
      setIsRequestingClosure(false)
    }
  }

  function confirmAccountClosureRequest() {
    Alert.alert(
      'Request account closure?',
      'This asks Tshelo to close your account and delete personal data we are not legally required to keep. Your account will remain active while support confirms ownership and reviews any shared fund or event responsibilities.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          style: 'destructive',
          onPress: () => { void submitAccountClosureRequest() },
        },
      ],
    )
  }

  const isPhoneVerified = Boolean(details?.phone && details.phoneConfirmedAt)

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={23} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Checking account security…</Text>
        </View>
      ) : loadError || !details ? (
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
          </View>
          <Text style={styles.errorTitle}>Security details unavailable</Text>
          <Text style={styles.centerText}>Check your session and try again.</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => setRefreshKey(key => key + 1)}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>SIGN-IN PROTECTION</Text>
          <View style={styles.card}>
            <View style={styles.protectionHeader}>
              <View style={styles.protectionIcon}>
                <Ionicons name="shield-checkmark" size={25} color={colors.success} />
              </View>
              <View style={styles.protectionCopy}>
                <Text style={styles.cardTitle}>Phone OTP protection</Text>
                <Text style={styles.cardText}>A one-time code is required whenever you sign in.</Text>
              </View>
              <View style={[styles.statusBadge, !isPhoneVerified && styles.statusBadgeWarning]}>
                <Text style={[styles.statusBadgeText, !isPhoneVerified && styles.statusBadgeTextWarning]}>
                  {isPhoneVerified ? 'Verified' : 'Check needed'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Verified login number</Text>
              <Text style={styles.phoneValue} selectable>{details.phone ? formatPhone(details.phone) : 'Unavailable'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Verified on</Text>
              <Text style={styles.detailValue}>{formatDateTime(details.phoneConfirmedAt)}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>SESSIONS &amp; DEVICES</Text>
          <View style={styles.card}>
            <View style={styles.sessionHeader}>
              <View style={styles.deviceIcon}>
                <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.sessionCopy}>
                <Text style={styles.cardTitle}>This device</Text>
                <Text style={styles.cardText}>{DEVICE_LABEL} · Tshelo app</Text>
              </View>
              <View style={styles.activeBadge}>
                <View style={styles.activeDot} />
                <Text style={styles.activeBadgeText}>Active now</Text>
              </View>
            </View>

            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account last sign-in</Text>
              <Text style={styles.detailValue}>{formatDateTime(details.lastSignInAt)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.signOutOthersButton, isSigningOutOthers && styles.buttonDisabled]}
              onPress={confirmSignOutOtherDevices}
              disabled={isSigningOutOthers}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Sign out other devices"
            >
              {isSigningOutOthers ? (
                <ActivityIndicator color={colors.error} />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={18} color={colors.error} />
                  <Text style={styles.signOutOthersText}>Sign out other devices</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.noteText}>
              Individual device names are not available yet. Use this action if you signed in on a device you no longer control.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>ACCOUNT CLOSURE</Text>
          <View style={styles.card}>
            <View style={styles.closureHeader}>
              <View style={styles.closureIcon}>
                <Ionicons name="person-remove-outline" size={23} color={colors.error} />
              </View>
              <View style={styles.protectionCopy}>
                <Text style={styles.cardTitle}>Request account closure</Text>
                <Text style={styles.cardText}>
                  Ask Tshelo to close your account and delete personal data that we are not legally required to retain.
                </Text>
              </View>
            </View>

            {isClosureLoading ? (
              <View style={styles.closureLoading} accessibilityLabel="Checking account closure request">
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={styles.cardText}>Checking request status…</Text>
              </View>
            ) : closureRequest ? (
              <View style={styles.closureStatus}>
                <View style={styles.closureStatusTitle}>
                  <Ionicons name="checkmark-circle" size={19} color={colors.success} />
                  <Text style={styles.closureStatusText}>Request received</Text>
                </View>
                <Text style={styles.closureTicket} selectable>{closureRequest.ticket_number}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.closureButton, isRequestingClosure && styles.buttonDisabled]}
                onPress={confirmAccountClosureRequest}
                disabled={isRequestingClosure}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Request account closure"
              >
                {isRequestingClosure ? (
                  <ActivityIndicator color={colors.error} />
                ) : (
                  <Text style={styles.closureButtonText}>Request account closure</Text>
                )}
              </TouchableOpacity>
            )}

            <Text style={styles.closureNote}>
              Shared transaction, audit, or compliance records may be retained where required by law.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    backButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: fonts.display.bold,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    headerSpacer: { width: 42 },
    scroll: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 48 },
    sectionLabel: {
      marginTop: 10,
      marginBottom: 9,
      paddingHorizontal: 4,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '800',
      letterSpacing: 1.4,
      color: colors.textMuted,
    },
    card: {
      marginBottom: 20,
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    protectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    protectionIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.successLight,
    },
    protectionCopy: { flex: 1, minWidth: 0 },
    cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: colors.textPrimary },
    cardText: { marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.textMuted },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: colors.successLight,
    },
    statusBadgeWarning: { backgroundColor: colors.accentLight },
    statusBadgeText: { fontSize: 10, fontWeight: '800', color: colors.success },
    statusBadgeTextWarning: { color: colors.accent },
    divider: { height: 1, marginVertical: 16, backgroundColor: colors.border },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      paddingVertical: 5,
    },
    detailLabel: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textMuted },
    detailValue: { flexShrink: 1, fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.textSecondary, textAlign: 'right' },
    phoneValue: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '800', color: colors.textPrimary, textAlign: 'right' },
    sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    deviceIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    sessionCopy: { flex: 1, minWidth: 0 },
    activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
    activeBadgeText: { fontSize: 10, fontWeight: '800', color: colors.success },
    signOutOthersButton: {
      minHeight: 50,
      marginTop: 16,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.errorLight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    signOutOthersText: { fontSize: 14, fontWeight: '800', color: colors.error },
    buttonDisabled: { opacity: 0.55 },
    note: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingHorizontal: 5, marginBottom: 14 },
    noteText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    closureHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    closureIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.errorLight,
    },
    closureLoading: {
      minHeight: 48,
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
    },
    closureStatus: {
      minHeight: 54,
      marginTop: 16,
      paddingHorizontal: 14,
      borderRadius: 15,
      backgroundColor: colors.successLight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    closureStatusTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    closureStatusText: { fontSize: 13, fontWeight: '800', color: colors.success },
    closureTicket: { flexShrink: 1, fontSize: 12, fontWeight: '800', color: colors.textSecondary },
    closureButton: {
      minHeight: 50,
      marginTop: 16,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.errorLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closureButtonText: { fontSize: 14, fontWeight: '800', color: colors.error },
    closureNote: { marginTop: 12, fontSize: 11, lineHeight: 17, color: colors.textMuted },
    center: {
      flex: 1,
      paddingHorizontal: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerText: { marginTop: 10, fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
    errorIcon: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    errorTitle: { marginTop: 16, fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    retryButton: {
      minHeight: 44,
      marginTop: 18,
      paddingHorizontal: 24,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    retryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  })
}
