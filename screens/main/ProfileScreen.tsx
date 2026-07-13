import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type ThemePref = 'light' | 'dark' | 'system'

type ProfileData = {
  name:  string
  email: string
  phone: string
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { colors, isDark, preference, setPreference } = useTheme()
  const { userId, tokenBalance, refreshProfile, signOut } = useAuth()
  const styles = makeStyles(colors)

  const [profile,     setProfile]     = useState<ProfileData>({ name: '', email: '', phone: '' })
  const [isLoading,   setIsLoading]   = useState(true)
  const [showEdit,    setShowEdit]    = useState(false)
  const [editName,    setEditName]    = useState('')
  const [editEmail,   setEditEmail]   = useState('')
  const [isSaving,    setIsSaving]    = useState(false)

  useFocusEffect(
    useCallback(() => {
      let active = true
      async function loadProfile() {
        if (!userId) return
        setIsLoading(true)
        const { data } = await supabase
          .from('users')
          .select('name, email, phone')
          .eq('id', userId)
          .single()
        if (active && data) {
          const loadedName = data.name ?? ''
          setProfile({
            name:  loadedName,
            email: data.email ?? '',
            phone: data.phone ?? '',
          })
          if (!loadedName) {
            setEditName('')
            setEditEmail(data.email ?? '')
            setShowEdit(true)
          }
        }
        if (active) setIsLoading(false)
      }
      loadProfile()
      return () => { active = false }
    }, [userId])
  )

  function openEdit() {
    setEditName(profile.name)
    setEditEmail(profile.email)
    setShowEdit(true)
  }

  async function handleSave() {
    if (!userId) return
    const trimmedName = editName.trim()
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter your name.')
      return
    }
    setIsSaving(true)
    const { error } = await supabase
      .from('users')
      .update({ name: trimmedName, email: editEmail.trim() || null })
      .eq('id', userId)
    if (error) {
      Alert.alert('Error', 'Could not save changes. Please try again.')
      setIsSaving(false)
      return
    }
    setProfile(p => ({ ...p, name: trimmedName, email: editEmail.trim() }))
    await refreshProfile()
    setIsSaving(false)
    setShowEdit(false)
  }

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ])
  }

  const displayName   = profile.name || 'Your Name'
  const init          = initials(profile.name || 'U')
  const isFirstSetup  = !profile.name && showEdit

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
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {onPress && !danger ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <Text style={styles.heading}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Avatar card ───────────────────────── */}
        <View style={styles.avatarCard}>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ flex: 1, paddingVertical: 10 }} />
          ) : (
            <>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{init}</Text>
              </View>
              <View style={styles.avatarInfo}>
                <Text style={styles.userName}>{displayName}</Text>
                {profile.phone ? (
                  <Text style={styles.userPhone}>{profile.phone}</Text>
                ) : null}
                <View style={styles.tokenRow}>
                  <Text style={styles.tokenEmoji}>🪙</Text>
                  <Text style={styles.tokenText}>{tokenBalance} tokens</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={openEdit} activeOpacity={0.8}>
                <Ionicons name="pencil-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Account ───────────────────────────── */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.section}>
          <SettingsRow icon="person-outline"            label="Edit Profile"   onPress={openEdit} />
          <SettingsRow icon="cash-outline"              label="Buy Tokens"     onPress={() => navigation.navigate('TokenPurchase')} />
          <SettingsRow icon="shield-checkmark-outline"  label="Security"       onPress={() => {}} />
        </View>

        {/* ── Preferences ───────────────────────── */}
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
          <SettingsRow icon="notifications-outline" label="Notifications" onPress={() => navigation.navigate('Notifications')} />
          <SettingsRow icon="language-outline"      label="Language"      value="English" />
        </View>

        {/* ── Support ───────────────────────────── */}
        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.section}>
          <SettingsRow icon="help-circle-outline"        label="Help & Support" onPress={() => navigation.navigate('Support')} />
          <SettingsRow icon="settings-outline"           label="App Settings"   onPress={() => navigation.navigate('Settings')} />
          <SettingsRow icon="information-circle-outline" label="About Tshelo"   onPress={() => {}} />
        </View>

        {/* ── Sign out ──────────────────────────── */}
        <View style={styles.section}>
          <SettingsRow icon="log-out-outline" label="Sign Out" onPress={handleSignOut} danger />
        </View>

        <Text style={styles.version}>Tshelo · v1.0.0-sandbox</Text>
      </ScrollView>

      {/* ── Edit Profile modal ────────────────── */}
      <Modal
        visible={showEdit}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEdit(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView
            style={styles.modalFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => { if (!isFirstSetup) setShowEdit(false) }}
                style={[styles.modalClose, isFirstSetup && { opacity: 0.3 }]}
                disabled={isFirstSetup}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{isFirstSetup ? 'Complete Your Profile' : 'Edit Profile'}</Text>
              <View style={{ width: 38 }} />
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Avatar preview */}
              <View style={styles.modalAvatarWrap}>
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>
                    {initials(editName || 'U')}
                  </Text>
                </View>
              </View>

              {/* Name */}
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your full name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                returnKeyType="next"
              />

              {/* Email */}
              <Text style={styles.fieldLabel}>Email <Text style={styles.fieldOptional}>(optional)</Text></Text>
              <TextInput
                style={styles.fieldInput}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="your@email.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
              />

              {/* Phone — read only */}
              <Text style={styles.fieldLabel}>Phone Number <Text style={styles.fieldOptional}>(registered)</Text></Text>
              <View style={[styles.fieldInput, styles.fieldReadOnly]}>
                <Text style={styles.fieldReadOnlyText}>{profile.phone || '—'}</Text>
              </View>
              <Text style={styles.fieldHint}>Phone number is your login identifier and cannot be changed here.</Text>

              {/* Save button */}
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                {isSaving
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.saveBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe:          { flex: 1, backgroundColor: colors.background },
    header:        { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
    heading:       { fontSize: 30, fontFamily: fonts.display.bold, color: colors.heading },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },

    // ── Avatar card ────────────────────────────────
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
      minHeight: 88,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText:  { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    avatarInfo:  { flex: 1, gap: 2 },
    userName:    { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
    userPhone:   { fontSize: 13, color: colors.textSecondary },
    tokenRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    tokenEmoji:  { fontSize: 13 },
    tokenText:   { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    editBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Settings rows ──────────────────────────────
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
    themeChip:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
    themeChipActive:    { backgroundColor: colors.primary },
    themeChipText:      { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    themeChipTextActive:{ color: '#FFFFFF' },

    version: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 8,
    },

    // ── Edit modal ─────────────────────────────────
    modalSafe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalFlex: { flex: 1 },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalClose: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.heading,
    },
    modalScroll: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 48,
    },
    modalAvatarWrap: {
      alignItems: 'center',
      marginBottom: 28,
    },
    modalAvatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalAvatarText: {
      fontSize: 30,
      fontWeight: '800',
      color: colors.primary,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    fieldOptional: {
      fontSize: 11,
      fontWeight: '400',
      color: colors.textMuted,
      textTransform: 'none',
      letterSpacing: 0,
    },
    fieldInput: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 20,
    },
    fieldReadOnly: {
      justifyContent: 'center',
      opacity: 0.6,
    },
    fieldReadOnlyText: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    fieldHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: -14,
      marginBottom: 28,
      lineHeight: 18,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 28,
      paddingVertical: 17,
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    saveBtnDisabled: {
      opacity: 0.7,
    },
    saveBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  })
}
