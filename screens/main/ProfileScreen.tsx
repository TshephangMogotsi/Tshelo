import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type ThemePref = 'light' | 'dark' | 'system'

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { colors, isDark, preference, setPreference } = useTheme()
  const { userName, tokenBalance, signOut } = useAuth()
  const styles = makeStyles(colors)

  const init = initials(userName || 'U')

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ])
  }

  function SettingsRow({
    icon, label, value, onPress, danger,
  }: {
    icon: keyof typeof Ionicons.glyphMap
    label: string
    value?: string
    onPress?: () => void
    danger?: boolean
  }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
          <Ionicons name={icon} size={18} color={danger ? colors.error : colors.primary} />
        </View>
        <Text style={[styles.rowLabel, danger && { color: colors.error }]}>{label}</Text>
        <View style={styles.rowRight}>
          {value && <Text style={styles.rowValue}>{value}</Text>}
          {onPress && !danger && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <Text style={styles.heading}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{init}</Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={styles.userName}>{userName || 'Your Name'}</Text>
            <View style={styles.tokenRow}>
              <Text style={styles.tokenEmoji}>🪙</Text>
              <Text style={styles.tokenText}>{tokenBalance} tokens</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.8}>
            <Ionicons name="pencil-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Account section */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.section}>
          <SettingsRow icon="person-outline"    label="Edit Profile"     onPress={() => {}} />
          <SettingsRow icon="cash-outline"  label="Buy Tokens"       onPress={() => navigation.navigate('TokenPurchase')} />
          <SettingsRow icon="shield-checkmark-outline" label="Security"  onPress={() => {}} />
        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.section}>
          <View style={styles.themeRow}>
            <View style={styles.rowIcon}>
              <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.rowLabel}>Appearance</Text>
            <View style={styles.themeToggle}>
              {(['light', 'dark', 'system'] as ThemePref[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.themeChip, preference === p && styles.themeChipActive]}
                  onPress={() => setPreference(p)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.themeChipText, preference === p && styles.themeChipTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <SettingsRow icon="notifications-outline" label="Notifications"   onPress={() => {}} />
          <SettingsRow icon="language-outline"      label="Language"  value="English"  />
        </View>

        {/* Support */}
        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.section}>
          <SettingsRow icon="help-circle-outline"   label="Help & Support"  onPress={() => navigation.navigate('Support')} />
          <SettingsRow icon="settings-outline"      label="App Settings"    onPress={() => navigation.navigate('Settings')} />
          <SettingsRow icon="information-circle-outline" label="About Tshelo" onPress={() => {}} />
        </View>

        {/* Sign out */}
        <View style={styles.section}>
          <SettingsRow icon="log-out-outline" label="Sign Out" onPress={handleSignOut} danger />
        </View>

        <Text style={styles.version}>Tshelo · v1.0.0-sandbox</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe:          { flex: 1, backgroundColor: colors.background },
    header:        { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
    heading:       { fontSize: 30, fontFamily: fonts.display.bold, color: colors.heading },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },

    avatarCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    avatarInfo: { flex: 1 },
    userName:   { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    tokenRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
    tokenEmoji: { fontSize: 13 },
    tokenText:  { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    editBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sectionLabel: {
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
      marginBottom: 20,
      overflow: 'hidden',
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowIconDanger: { backgroundColor: colors.errorLight },
    rowLabel:  { flex: 1, fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
    rowRight:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowValue:  { fontSize: 13, color: colors.textMuted },

    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    themeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 3,
      gap: 2,
    },
    themeChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 7,
    },
    themeChipActive:    { backgroundColor: colors.primary },
    themeChipText:      { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    themeChipTextActive:{ color: '#FFFFFF' },

    version: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 8,
    },
  })
}
