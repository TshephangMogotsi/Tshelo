import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from '../../shared/contracts/users'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { useTheme } from '../../context/ThemeContext'
import { api } from '../../lib/api'
import { toApiUiError } from '../../lib/apiScreen'
import type { MainStackParamList } from '../../navigation/types'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'NotificationSettings'>
}

type Setting = {
  key: NotificationPreferenceKey
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description: string
}

const SETTINGS: Setting[] = [
  { key: 'fund_invites', icon: 'person-add-outline', title: 'Fund invites', description: 'Join requests and invitation updates.' },
  { key: 'contributions', icon: 'cash-outline', title: 'Contributions recorded', description: 'Money recorded in funds you belong to.' },
  { key: 'expenses', icon: 'receipt-outline', title: 'Expenses added', description: 'New expenses in shared funds.' },
  { key: 'deadlines', icon: 'time-outline', title: 'Upcoming deadlines', description: 'Contribution and pledge reminders.' },
  { key: 'event_reminders', icon: 'calendar-outline', title: 'Event reminders', description: 'Event dates, RSVP reminders, and event updates.' },
]

type PreferenceProfile = {
  notifications_enabled: boolean
  notification_preferences: NotificationPreferences | null
}

function preferencesFrom(user: PreferenceProfile): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...user.notification_preferences }
}

export default function NotificationSettingsScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme()
  const { refreshProfile, userId } = useAuth()
  const requireOnline = useRequireOnline()
  const styles = makeStyles(colors)
  const [user, setUser] = useState<PreferenceProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useFocusEffect(useCallback(() => {
    if (!userId) return
    let active = true
    setLoading(true)
    async function loadSettings() {
      try {
        const profile = await api.users.me()
        if (active) setUser(profile)
      } catch (error) {
        if (active) Alert.alert('Could not load notification settings', toApiUiError(error).message)
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadSettings()
    return () => { active = false }
  }, [userId]))

  async function save(nextEnabled: boolean, nextPreferences: NotificationPreferences, savingKey: string) {
    if (!requireOnline() || !user || !userId || saving) return
    const previous = user
    setSaving(savingKey)
    setUser({
      notifications_enabled: nextEnabled,
      notification_preferences: nextPreferences,
    })
    try {
      const updated = await api.users.updateMe({
        notifications_enabled: nextEnabled,
        notification_preferences: nextPreferences,
      })
      setUser(updated)
      await refreshProfile().catch(() => undefined)
    } catch (error) {
      setUser(previous)
      Alert.alert('Could not save notification settings', toApiUiError(error).message)
    } finally {
      setSaving(null)
    }
  }

  function setMaster(enabled: boolean) {
    if (!user) return
    void save(enabled, preferencesFrom(user), 'master')
  }

  function setPreference(key: NotificationPreferenceKey, enabled: boolean) {
    if (!user) return
    const preferences = { ...preferencesFrom(user), [key]: enabled }
    void save(user.notifications_enabled, preferences, key)
  }

  const enabled = user?.notifications_enabled ?? true
  const preferences = user ? preferencesFrom(user) : DEFAULT_NOTIFICATION_PREFERENCES

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={23} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : user ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>Choose which routine updates can alert you on this device.</Text>

          <Text style={styles.sectionLabel}>PUSH ALERTS</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.iconWrap}><Ionicons name="notifications-outline" size={21} color={colors.primary} /></View>
              <View style={styles.copy}><Text style={styles.title}>Push notifications</Text><Text style={styles.description}>Show Tshelo alerts on this device.</Text></View>
              {saving === 'master' ? <ActivityIndicator color={colors.primary} /> : <Switch disabled={Boolean(saving)} value={enabled} onValueChange={setMaster} trackColor={{ false: colors.border, true: colors.primaryMid }} thumbColor={enabled ? colors.primary : colors.textMuted} />}
            </View>
          </View>

          <Text style={styles.sectionLabel}>ALERT TYPES</Text>
          <View style={[styles.card, !enabled && styles.cardDisabled]}>
            {SETTINGS.map((setting, index) => (
              <View key={setting.key}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.settingRow}>
                  <View style={[styles.iconWrap, !enabled && styles.iconDisabled]}><Ionicons name={setting.icon} size={20} color={enabled ? colors.primary : colors.textMuted} /></View>
                  <View style={styles.copy}><Text style={[styles.title, !enabled && styles.textDisabled]}>{setting.title}</Text><Text style={styles.description}>{setting.description}</Text></View>
                  {saving === setting.key ? <ActivityIndicator color={colors.primary} /> : <Switch disabled={!enabled || Boolean(saving)} value={preferences[setting.key]} onValueChange={value => setPreference(setting.key, value)} trackColor={{ false: colors.border, true: colors.primaryMid }} thumbColor={preferences[setting.key] && enabled ? colors.primary : colors.textMuted} />}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.noteText}>Updates still appear in your Notifications inbox. Security alerts stay enabled to help protect your account.</Text>
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', color: colors.textPrimary, fontFamily: fonts.inter.semiBold, fontSize: 17 },
    headerSpacer: { width: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 20, paddingBottom: 42 },
    intro: { color: colors.textSecondary, fontFamily: fonts.inter.regular, fontSize: 14, lineHeight: 21, marginBottom: 28 },
    sectionLabel: { color: colors.textMuted, fontFamily: fonts.inter.bold, fontSize: 11, letterSpacing: 1, marginBottom: 9, marginLeft: 4 },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, overflow: 'hidden', marginBottom: 26 },
    cardDisabled: { opacity: 0.62 },
    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
    iconWrap: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
    iconDisabled: { backgroundColor: colors.background },
    copy: { flex: 1, paddingRight: 4 },
    title: { color: colors.textPrimary, fontFamily: fonts.inter.semiBold, fontSize: 14 },
    textDisabled: { color: colors.textMuted },
    description: { color: colors.textSecondary, fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 17, marginTop: 3 },
    divider: { height: 1, backgroundColor: colors.border, marginLeft: 67 },
    note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 15, borderRadius: 15, backgroundColor: colors.primaryLight },
    noteText: { flex: 1, color: colors.textSecondary, fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 18 },
  })
}
