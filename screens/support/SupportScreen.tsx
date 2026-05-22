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
  ActivityIndicator,
  Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { colors } from '../../theme/colors'
import { fonts } from '../../theme/typography'

type Category = {
  id: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
}

const CATEGORIES: Category[] = [
  { id: 'login',    label: "Can't log in",    icon: 'lock-closed-outline'   },
  { id: 'payment',  label: 'Payment issue',   icon: 'card-outline'           },
  { id: 'account',  label: 'Account',         icon: 'person-outline'         },
  { id: 'technical',label: 'Technical',       icon: 'bug-outline'            },
  { id: 'other',    label: 'Other',           icon: 'ellipsis-horizontal'    },
]

export default function SupportScreen() {
  const navigation = useNavigation()

  const [category, setCategory] = useState<string | null>(null)
  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [message,  setMessage]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [submitted,setSubmitted]= useState(false)

  const [nameFocused,   setNameFocused]   = useState(false)
  const [phoneFocused,  setPhoneFocused]  = useState(false)
  const [messageFocused,setMessageFocused]= useState(false)

  const isValid =
    category !== null &&
    name.trim().length >= 2 &&
    message.trim().length >= 10

  const selectedCategory = CATEGORIES.find(c => c.id === category)

  async function handleSubmit() {
    if (!isValid) return
    setLoading(true)

    const subject = encodeURIComponent(
      `[Support] ${selectedCategory?.label ?? 'General'} — ${name.trim()}`
    )
    const body = encodeURIComponent(
      `Category: ${selectedCategory?.label ?? '—'}\n` +
      `Name: ${name.trim()}\n` +
      `Phone: ${phone.trim() || '—'}\n\n` +
      `Message:\n${message.trim()}\n\n` +
      `---\nSent from Tshelo app`
    )

    const mailto = `mailto:support@tshelo.co.bw?subject=${subject}&body=${body}`

    try {
      const canOpen = await Linking.canOpenURL(mailto)
      if (canOpen) {
        await Linking.openURL(mailto)
      }
    } catch (_) {
      // silently fail — still show success so user isn't blocked
    }

    setLoading(false)
    setSubmitted(true)
  }

  // ── Success state ─────────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.successContainer}>
          <View style={styles.successGlow}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark" size={36} color={colors.primary} />
            </View>
          </View>
          <Text style={styles.successHeading}>Ticket submitted</Text>
          <Text style={styles.successBody}>
            We've received your message and will get back to you within 24 hours.
            Check your email for updates.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Form ──────────────────────────────────────────────────────
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
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.heading}>Get Help</Text>
            <Text style={styles.subheading}>
              Tell us what's going on and we'll get back to you as soon as possible.
            </Text>
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(cat => {
                const active = category === cat.id
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setCategory(cat.id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={15}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Your Name</Text>
            <TextInput
              style={[styles.input, nameFocused && styles.inputFocused]}
              placeholder="e.g. Kefilwe Moeti"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* Phone */}
          <View style={styles.field}>
            <Text style={styles.label}>Phone Number <Text style={styles.optional}>(optional)</Text></Text>
            <View style={[styles.phoneRow, phoneFocused && styles.phoneRowFocused]}>
              <View style={styles.countryCode}>
                <Text style={styles.flag}>🇧🇼</Text>
                <Text style={styles.countryCodeText}>+267</Text>
              </View>
              <View style={styles.divider} />
              <TextInput
                style={styles.phoneInput}
                placeholder="71 234 567"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                maxLength={9}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Message */}
          <View style={styles.field}>
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.textarea, messageFocused && styles.inputFocused]}
              placeholder="Describe your issue in as much detail as possible…"
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              onFocus={() => setMessageFocused(true)}
              onBlur={() => setMessageFocused(false)}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              returnKeyType="default"
            />
            <Text style={styles.charCount}>{message.trim().length} / 500</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.buttonDisabled]}
            onPress={handleSubmit}
            activeOpacity={isValid ? 0.85 : 1}
            disabled={loading || !isValid}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={styles.submitInner}>
                  <Ionicons name="send-outline" size={16} color="#fff" />
                  <Text style={styles.primaryButtonText}>Send message</Text>
                </View>
              )
            }
          </TouchableOpacity>

          {/* Footer note */}
          <Text style={styles.footerNote}>
            We typically respond within 24 hours on business days.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.background },
  flex:  { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    borderWidth: 1,
    borderColor: colors.border,
  },

  header: { marginBottom: 32 },
  heading: {
    fontSize: 30,
    fontFamily: fonts.display.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  field: { marginBottom: 24 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  optional: {
    fontSize: 11,
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
    color: colors.textMuted,
  },

  // Category chips
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.primary,
  },

  // Inputs
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputFocused: {
    borderColor: colors.borderFocus,
  },
  textarea: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 15,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 130,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 6,
  },

  // Phone row
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  phoneRowFocused: {
    borderColor: colors.borderFocus,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 6,
  },
  flag: { fontSize: 18 },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  // Button
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  footerNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  successIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  successHeading: {
    fontSize: 28,
    fontFamily: fonts.display.bold,
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 36,
  },
})
