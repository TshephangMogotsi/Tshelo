import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../context/ThemeContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { api } from '../../lib/api'
import { toApiUiError } from '../../lib/apiScreen'
import type { SupportReportCategory, SupportReportReceipt } from '../../shared/contracts/users'
import { fonts } from '../../theme/typography'
import type { AppColors } from '../../theme/themes'

type Category = {
  id: SupportReportCategory
  label: string
  icon: keyof typeof Ionicons.glyphMap
}

const CATEGORIES: Category[] = [
  { id: 'sign_in', label: 'Sign-in', icon: 'key-outline' },
  { id: 'fund_or_event', label: 'Fund or event', icon: 'people-outline' },
  { id: 'contribution_or_expense', label: 'Money record', icon: 'receipt-outline' },
  { id: 'report_or_export', label: 'Report or PDF', icon: 'document-text-outline' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { id: 'technical', label: 'App problem', icon: 'bug-outline' },
  { id: 'suggestion', label: 'Suggestion', icon: 'bulb-outline' },
  { id: 'other', label: 'Something else', icon: 'ellipsis-horizontal' },
]

const MAX_DESCRIPTION_LENGTH = 2_000

export default function SupportScreen() {
  const navigation = useNavigation()
  const { colors, isDark } = useTheme()
  const requireOnline = useRequireOnline()
  const styles = makeStyles(colors)
  const [category, setCategory] = useState<SupportReportCategory | null>(null)
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<SupportReportReceipt | null>(null)

  const isValid = category !== null && description.trim().length >= 10

  async function handleSubmit() {
    if (!isValid || !category || !requireOnline()) return
    setIsSubmitting(true)
    try {
      const submitted = await api.users.submitSupportReport({
        category,
        description: description.trim(),
        platform: Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web'
          ? Platform.OS
          : undefined,
      })
      setReceipt(submitted)
    } catch (error) {
      Alert.alert('Could not send report', toApiUiError(error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (receipt) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={styles.successContainer}>
          <View style={styles.successIcon}><Ionicons name="checkmark" size={34} color={colors.primary} /></View>
          <Text style={styles.successTitle}>Report received</Text>
          <Text style={styles.successText}>Thank you. Your report is now in the Tshelo support queue.</Text>
          <View style={styles.ticketCard}>
            <Text style={styles.ticketLabel}>REFERENCE NUMBER</Text>
            <Text style={styles.ticketNumber}>{receipt.ticket_number}</Text>
          </View>
          <Text style={styles.successHint}>Keep this number if you need to follow up. Please do not send one-time codes, passwords, or bank details.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.heading}>Report a problem</Text>
            <Text style={styles.subheading}>Tell us what happened. Your report goes directly to the Tshelo support queue.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>What do you need help with?</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(item => {
                const active = category === item.id
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setCategory(item.id)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={item.label}
                  >
                    <Ionicons name={item.icon} size={16} color={active ? colors.primary : colors.textMuted} />
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>What happened?</Text>
            <TextInput
              style={styles.textarea}
              value={description}
              onChangeText={value => setDescription(value.slice(0, MAX_DESCRIPTION_LENGTH))}
              placeholder="Include what you expected, what happened instead, and any useful details."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={7}
              textAlignVertical="top"
              autoCapitalize="sentences"
              accessibilityLabel="Describe the problem"
            />
            <Text style={styles.characterCount}>{description.length} / {MAX_DESCRIPTION_LENGTH}</Text>
          </View>

          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text style={styles.privacyText}>We automatically include only your app platform to help diagnose the issue. Do not include OTP codes, passwords, bank details, or mobile-money PINs.</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Send report"
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="send-outline" size={17} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Send report</Text></>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, padding: 24, paddingBottom: 48 },
    backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
    header: { marginBottom: 28 },
    heading: { fontFamily: fonts.display.bold, fontSize: 30, color: colors.heading, marginBottom: 8 },
    subheading: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
    field: { marginBottom: 24 },
    label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 10 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    categoryChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    categoryText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    categoryTextActive: { color: colors.primary },
    textarea: { minHeight: 150, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary, fontSize: 15, lineHeight: 22, padding: 14 },
    characterCount: { alignSelf: 'flex-end', color: colors.textMuted, fontSize: 11, marginTop: 7 },
    privacyNote: { flexDirection: 'row', gap: 10, borderRadius: 14, backgroundColor: colors.primaryLight, padding: 14, marginBottom: 26 },
    privacyText: { flex: 1, color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
    primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryButtonDisabled: { opacity: 0.45 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    successIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight, marginBottom: 22 },
    successTitle: { fontFamily: fonts.display.bold, fontSize: 30, color: colors.heading, marginBottom: 10 },
    successText: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
    ticketCard: { width: '100%', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, marginVertical: 24 },
    ticketLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.8, fontWeight: '700' },
    ticketNumber: { color: colors.primary, fontSize: 19, fontWeight: '800', marginTop: 4 },
    successHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 28 },
  })
}
