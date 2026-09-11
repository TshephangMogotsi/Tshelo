import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Linking, Clipboard, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { fundPreviewUrl } from '../../lib/fundLinks'
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
    goalBWP,
    currencyCode,
    currencySymbol,
    targetDate,
    shareCode,
    fundId,
    creationKind = 'fund',
    eventId,
  } = route.params
  const isEventFund = creationKind === 'eventFund'
  const currencyPrefix = currencySymbol ?? (currencyCode === 'BWP' ? 'P' : currencyCode) ?? 'P'

  const inviteLink = shareCode ? fundPreviewUrl(shareCode) : 'https://app.tshelo.com'
  const message    = isEventFund
    ? `Dumelang! I've created *${fundName}*, an event contribution fund on Tshelo. Join here to contribute and see all payments transparently:\n\n${inviteLink}`
    : `Dumelang! 🙏 I've created a fund for *${fundName}* on Tshelo. Join here to contribute and see all payments transparently:\n\n${inviteLink}`

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

  function handleCopyCode() {
    if (!shareCode) return
    Clipboard.setString(shareCode)
    Alert.alert('Copied', `${isEventFund ? 'Event + Fund' : 'Fund'} invite code copied.`)
  }

  function handleCopyLink() {
    Clipboard.setString(inviteLink)
    Alert.alert('Copied', 'Fund invite link copied.')
  }

  function handleDone() {
    if (isEventFund && eventId) {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'Tabs' as any },
          { name: 'EventDetail', params: { eventId } },
        ],
      })
      return
    }
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
        {/* ── Heading ────────────────────────────── */}
        <View
          style={styles.headingRow}
          accessibilityLabel={`${isEventFund ? 'Event and fund' : 'Fund'} created successfully`}
        >
          <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          <Text
            style={styles.heading}
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {isEventFund ? 'Event + Fund Created!' : 'Fund Created!'}
          </Text>
        </View>
        <Text style={styles.subheading}>
          {isEventFund
            ? `${fundName} is ready for planning and contributions`
            : `${fundName} is ready to receive contributions`}
        </Text>

        {/* ── Fund summary card ──────────────────── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
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
              <View style={styles.codeHeader}>
                <Text style={styles.codeLabel}>INVITE CODE</Text>
                <TouchableOpacity
                  style={styles.codeCopyBtn}
                  onPress={handleCopyCode}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Copy ${isEventFund ? 'event and fund' : 'fund'} invite code`}
                >
                  <Ionicons name="copy-outline" size={14} color={colors.primary} />
                  <Text style={styles.codeCopyText}>Copy code</Text>
                </TouchableOpacity>
              </View>
              <Text
                style={styles.codeValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                selectable
                accessibilityLabel={`Invite code ${shareCode}`}
              >
                {shareCode}
              </Text>
              <Text style={styles.codeHint}>Share this code with anyone you want to invite</Text>
            </>
          ) : null}
        </View>

        {/* ── Invite section ─────────────────────── */}
        <Text style={styles.inviteTitle}>
          {isEventFund ? 'Invite contributors' : 'Invite family & friends'}
        </Text>

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

        <TouchableOpacity
          onPress={handleDone}
          activeOpacity={0.8}
          style={styles.viewFundBtn}
          accessibilityRole="button"
          accessibilityLabel={isEventFund ? 'View Event and Fund' : 'View Fund'}
        >
          <Text style={styles.viewFundText}>{isEventFund ? 'View Event + Fund' : 'View Fund'}</Text>
          <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
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
      paddingTop: 28,
      paddingBottom: 48,
      alignItems: 'center',
    },

    // ── Heading ────────────────────────────────────────────────
    headingRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 8,
    },
    heading: {
      flexShrink: 1,
      fontSize: 28,
      fontFamily: fonts.display.bold,
      fontWeight: '800',
      color: colors.textPrimary,
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
      marginBottom: 16,
    },
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
    },
    codeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    codeCopyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minHeight: 32,
      paddingHorizontal: 9,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
    },
    codeCopyText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    codeValue: {
      width: '100%',
      fontSize: 18,
      lineHeight: 24,
      fontFamily: fonts.inter.extraBold,
      letterSpacing: 1.2,
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

    viewFundBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      backgroundColor: colors.primary,
      borderRadius: 16,
    },
    viewFundText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  })
}
