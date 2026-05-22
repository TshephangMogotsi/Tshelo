import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../context/AuthContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/types'

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value?: string
  onPress?: () => void
  destructive?: boolean
}

function SettingsRow({ icon, label, value, onPress, destructive }: RowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
        <Ionicons
          name={icon}
          size={18}
          color={destructive ? colors.error : colors.primary}
        />
      </View>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </TouchableOpacity>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>
}

export default function SettingsScreen() {
  const { signOut, userName, tokenBalance } = useAuth()
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Settings</Text>

        {/* ── Profile card ───────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName || 'Your Name'}</Text>
            <View style={styles.tokenRow}>
              <Ionicons name="wallet-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.tokenText}>{tokenBalance} tokens</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.8}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* ── Profile ────────────────────────────────── */}
        <SectionHeader title="Profile" />
        <View style={styles.section}>
          <SettingsRow icon="person-outline"          label="Full name"      value={userName || '—'} />
          <SettingsRow icon="phone-portrait-outline"  label="Mobile money"   onPress={() => {}} />
          <SettingsRow icon="notifications-outline"   label="Notifications"  onPress={() => {}} />
        </View>

        {/* ── App ────────────────────────────────────── */}
        <SectionHeader title="App" />
        <View style={styles.section}>
          <SettingsRow icon="wallet-outline"           label="Buy tokens"        onPress={() => {}} />
          <SettingsRow icon="document-text-outline"    label="Terms of Service"  onPress={() => {}} />
          <SettingsRow icon="shield-checkmark-outline" label="Privacy Policy"    onPress={() => {}} />
          <SettingsRow icon="help-circle-outline"      label="Help & Support"    onPress={() => navigation.navigate('Support')} />
        </View>

        {/* ── Session ────────────────────────────────── */}
        <SectionHeader title="Session" />
        <View style={styles.section}>
          <SettingsRow
            icon="log-out-outline"
            label="Sign out"
            onPress={handleSignOut}
            destructive
          />
        </View>

        <Text style={styles.version}>Tshelo v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: fonts.display.bold,
    color: colors.textPrimary,
    marginBottom: 20,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.surface,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tokenText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDestructive: {
    backgroundColor: colors.errorLight,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  rowLabelDestructive: {
    color: colors.error,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
    color: colors.textMuted,
    maxWidth: 140,
  },
  sandboxNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accentLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  sandboxText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
})
