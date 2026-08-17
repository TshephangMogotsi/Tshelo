import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Linking, Share, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { fundPreviewUrl } from '../../lib/supabase'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'FundCreated'>
  route:      RouteProp<MainStackParamList, 'FundCreated'>
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr
  const [y, m, d] = parts
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d} ${months[m - 1]} ${y}`
}

function formatAmount(value: string, currencyPrefix: string): string {
  const n = parseFloat(value.replace(/,/g, ''))
  if (isNaN(n)) return '—'
  return `${currencyPrefix} ${n.toLocaleString('en-BW', { minimumFractionDigits: 0 })}`
}

export default function FundCreatedScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  const {
    fundName,
    category,
    emoji,
    goalBWP,
    currencyCode,
    currencySymbol,
    targetDate,
    shareCode,
    fundId,
  } = route.params
  const currencyPrefix = currencySymbol ?? (currencyCode === 'BWP' ? 'P' : currencyCode) ?? 'P'

  const fundCode   = shareCode ?? '—'
  const inviteLink = shareCode ? fundPreviewUrl(shareCode) : 'https://tshelo.app'
  const message    = `Dumelang! 🙏 I've created a fund for *${fundName}* on Tshelo. Join here to contribute and see all payments transparently:\n\n${inviteLink}`

  async function handleWhatsApp() {
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      await Linking.openURL(url)
    } else {
      Alert.alert('WhatsApp not found', 'Please install WhatsApp to share via it.')
    }
    handleDone()
  }

  async function handleSMS() {
    await Linking.openURL(`sms:?body=${encodeURIComponent(message)}`)
    handleDone()
  }

  async function handleCopyLink() {
    try {
      await Share.share({ message: inviteLink })
    } catch (_) {}
    handleDone()
  }

  function handleDone() {
    if (fundId) {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'Tabs' as any },
          { name: 'FundDetail', params: { fundId } },
        ],
      })
    } else {
      navigation.popToTop()
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Success icon ───────────────────────── */}
        <View style={styles.iconWrap}>
          <View style={styles.iconGlow} />
          <View style={styles.iconCircle}>
            <Ionicons name="wallet" size={32} color="#FFFFFF" />
          </View>
          <Text style={[styles.sparkle, { top: 12,  left: 22,  fontSize: 18 }]}>✦</Text>
          <Text style={[styles.sparkle, { top: 6,   right: 20, fontSize: 24 }]}>✦</Text>
          <Text style={[styles.sparkle, { bottom: 18, left: 30, fontSize: 13 }]}>✦</Text>
        </View>

        {/* ── Heading ────────────────────────────── */}
        <Text style={styles.heading}>Fund Created!</Text>
        <Text style={styles.subheading}>
          {fundName} is ready to receive contributions
        </Text>

        {/* ── Fund summary card ──────────────────── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.fundIconCircle}>
              <Text style={styles.fundEmoji}>{emoji}</Text>
            </View>
            <View style={styles.fundNameWrap}>
              <Text style={styles.fundName}>{fundName}</Text>
              <View style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>{category}</Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Target</Text>
              <Text style={styles.statValue}>{goalBWP ? formatAmount(goalBWP, currencyPrefix) : '—'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Date</Text>
              <Text style={styles.statValue}>{targetDate ? formatDate(targetDate) : '—'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Members</Text>
              <Text style={styles.statValue}>Just you</Text>
            </View>
          </View>

          {shareCode ? (
            <>
              <View style={styles.summaryDivider} />
              <Text style={styles.codeLabel}>INVITE CODE</Text>
              <Text style={styles.codeValue}>{shareCode}</Text>
              <Text style={styles.codeHint}>Share this code with anyone you want to invite</Text>
            </>
          ) : null}
        </View>

        {/* ── Invite section ─────────────────────── */}
        <Text style={styles.inviteTitle}>Invite family &amp; friends</Text>

        <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp} activeOpacity={0.85}>
          <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
          <Text style={styles.whatsappBtnText}>Share via WhatsApp</Text>
        </TouchableOpacity>

        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSMS} activeOpacity={0.8}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.secondaryBtnText}>SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopyLink} activeOpacity={0.8}>
            <Ionicons name="link-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.secondaryBtnText}>Copy Link</Text>
          </TouchableOpacity>
        </View>

        {/* ── Message preview ────────────────────── */}
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Ionicons name="phone-portrait-outline" size={14} color={colors.primary} />
            <Text style={styles.previewHeaderText}>Message preview</Text>
          </View>
          <Text style={styles.previewText}>{message}</Text>
        </View>

        {/* ── Skip ───────────────────────────────── */}
        <TouchableOpacity onPress={handleDone} activeOpacity={0.7} style={styles.skipBtn}>
          <Text style={styles.skipText}>I'll invite people later</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe:   { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 48,
      alignItems: 'center',
    },

    // ── Success icon ───────────────────────────────────────────
    iconWrap: {
      width: 140,
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    iconGlow: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: '#22C55E',
      opacity: 0.18,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: '#22C55E',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#22C55E',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    sparkle: {
      position: 'absolute',
      color: '#F59E0B',
      fontWeight: '900',
    },

    // ── Heading ────────────────────────────────────────────────
    heading: {
      fontSize: 28,
      fontFamily: fonts.display.bold,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    subheading: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 28,
    },

    // ── Summary card ───────────────────────────────────────────
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      width: '100%',
      marginBottom: 28,
    },
    summaryTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    fundIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fundEmoji: { fontSize: 20 },
    fundNameWrap: {
      flex: 1,
    },
    fundName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    categoryTag: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    categoryTagText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 16,
      marginTop: 16,
    },
    codeLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: colors.textMuted,
      marginBottom: 6,
    },
    codeValue: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 3,
      color: colors.primary,
      marginBottom: 4,
    },
    codeHint: {
      fontSize: 12,
      color: colors.textMuted,
    },
    statsRow: {
      flexDirection: 'row',
    },
    stat: {
      flex: 1,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    // ── Invite ─────────────────────────────────────────────────
    inviteTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
      alignSelf: 'flex-start',
      marginBottom: 14,
    },
    whatsappBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: '#25D366',
      borderRadius: 28,
      paddingVertical: 16,
      width: '100%',
      marginBottom: 12,
      shadowColor: '#25D366',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
    },
    whatsappBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
      marginBottom: 20,
    },
    secondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 13,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    secondaryBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    // ── Message preview ────────────────────────────────────────
    previewCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: 14,
      padding: 14,
      width: '100%',
      marginBottom: 32,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    previewHeaderText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    previewText: {
      fontSize: 13,
      color: colors.primary,
      lineHeight: 20,
      fontStyle: 'italic',
    },

    // ── Skip ───────────────────────────────────────────────────
    skipBtn: {
      paddingVertical: 8,
    },
    skipText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
  })
}
