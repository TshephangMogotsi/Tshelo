import { View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../context/AuthContext'
import { useTheme, ThemePreference } from '../../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/types'
import { openLegalDocument } from '../../lib/legalDocuments'

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value?: string
  onPress?: () => void
  destructive?: boolean
  last?: boolean
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light',  label: 'Light',  icon: 'sunny-outline' },
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'dark',   label: 'Dark',   icon: 'moon-outline' },
]

export default function SettingsScreen() {
  const { signOut, userName, tokenBalance } = useAuth()
  const { colors, isDark, preference, setPreference } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  function handleSignOut() {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: signOut },
      ]
    )
  }

  function SettingsRow({ icon, label, value, onPress, destructive, last }: RowProps) {
    return (
      <TouchableOpacity
        style={[row.base, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <View style={[row.icon, { backgroundColor: destructive ? colors.errorLight : colors.primaryLight }]}>
          <Ionicons name={icon} size={18} color={destructive ? colors.error : colors.primary} />
        </View>
        <Text style={[row.label, { color: destructive ? colors.error : colors.textPrimary }, destructive && { fontWeight: '600' }]}>
          {label}
        </Text>
        {value ? (
          <Text style={[row.value, { color: colors.textMuted }]} numberOfLines={1}>{value}</Text>
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        ) : null}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.pageTitle, { color: colors.heading }]}>Settings</Text>

        {/* Profile card */}
        <View style={[s.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.avatar, { backgroundColor: colors.primary }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={[s.profileName, { color: colors.textPrimary }]}>{userName || 'Your Name'}</Text>
            <View style={s.tokenRow}>
              <Ionicons name="wallet-outline" size={13} color={colors.textSecondary} />
              <Text style={[s.tokenText, { color: colors.textSecondary }]}>{tokenBalance} tokens</Text>
            </View>
          </View>
          <TouchableOpacity style={[s.editBtn, { backgroundColor: colors.primaryLight }]} activeOpacity={0.8}>
            <Text style={[s.editBtnText, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Profile */}
        <Text style={[s.sectionTitle, { color: colors.textMuted }]}>Profile</Text>
        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsRow icon="person-outline"         label="Full name"     value={userName || '—'} />
          <SettingsRow icon="phone-portrait-outline" label="Mobile money"  onPress={() => {}} />
          <SettingsRow icon="notifications-outline"  label="Notifications" onPress={() => navigation.navigate('Notifications')} last />
        </View>

        {/* Appearance */}
        <Text style={[s.sectionTitle, { color: colors.textMuted }]}>Appearance</Text>
        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.themeRow}>
            <View style={[s.themeRowIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={18} color={colors.primary} />
            </View>
            <Text style={[s.themeRowLabel, { color: colors.textPrimary }]}>Theme</Text>
            <View style={[s.toggle, { backgroundColor: colors.background }]}>
              {THEME_OPTIONS.map(opt => {
                const active = preference === opt.value
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.toggleBtn, active && { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 }]}
                    onPress={() => setPreference(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={opt.icon} size={14} color={active ? colors.primary : colors.textMuted} />
                    <Text style={[s.toggleLabel, { color: active ? colors.primary : colors.textMuted }, active && { fontWeight: '700' }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </View>

        {/* App */}
        <Text style={[s.sectionTitle, { color: colors.textMuted }]}>App</Text>
        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsRow icon="wallet-outline"           label="Buy tokens"       onPress={() => navigation.navigate('TokenPurchase')} />
          <SettingsRow icon="document-text-outline"    label="Terms of Service" onPress={() => { void openLegalDocument('terms') }} />
          <SettingsRow icon="shield-checkmark-outline" label="Privacy Policy"   onPress={() => { void openLegalDocument('privacy') }} />
          <SettingsRow icon="help-circle-outline"      label="Help & Support"   onPress={() => navigation.navigate('Support')} last />
        </View>

        {/* Session */}
        <Text style={[s.sectionTitle, { color: colors.textMuted }]}>Session</Text>
        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsRow icon="log-out-outline" label="Sign out" onPress={handleSignOut} destructive last />
        </View>

        <Text style={[s.version, { color: colors.textMuted }]}>Tshelo v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: 30,
    fontFamily: fonts.display.bold,
    marginBottom: 20,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tokenText: {
    fontSize: 13,
    fontWeight: '600',
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },

  // Theme toggle
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  themeRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeRowLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  version: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 4,
  },
})

// Row sub-styles kept separate to avoid StyleSheet dynamic color issues
const row = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    maxWidth: 140,
  },
})
