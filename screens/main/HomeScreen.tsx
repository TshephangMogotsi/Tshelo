import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

// persists for the current app session; resets on app restart (= "show every login")
let _welcomeDismissed = false
import { Ionicons } from '@expo/vector-icons'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'

type FundStatus = 'active' | 'closed' | 'suspended'
type MemberRole = 'organiser' | 'member'

type Fund = {
  id:                  string
  title:               string
  status:              FundStatus
  goal_amount:         number
  total_contributions: number
  balance:             number
  member_count:        number
  role:                MemberRole
  next_payout:         string
  category:            string
  emoji:               string
}

type SmsItem = {
  id:       string
  amount:   number
  phone:    string
  provider: string
  timeAgo:  string
}

function thebeToBWP(thebe: number) {
  return `P ${(thebe / 100).toLocaleString('en-BW', { minimumFractionDigits: 2 })}`
}

function thebeToWholeBWP(thebe: number) {
  return `P ${(thebe / 100).toLocaleString('en-BW', { maximumFractionDigits: 0 })}`
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const MOCK_FUNDS: Fund[] = [
  {
    id: '1', title: "Kgosi's Funeral Fund", status: 'active',
    goal_amount: 1000000, total_contributions: 875000, balance: 875000,
    member_count: 12, role: 'organiser', next_payout: '15 Jun 2025',
    category: 'Funeral', emoji: '🕯️',
  },
  {
    id: '2', title: 'Kago & Lesedi Wedding', status: 'active',
    goal_amount: 1500000, total_contributions: 1200000, balance: 1200000,
    member_count: 47, role: 'organiser', next_payout: '15 Nov 2025',
    category: 'Event', emoji: '🏠',
  },
]

const MOCK_SMS: SmsItem[] = [
  { id: 's1', amount: 50000,  phone: '72 345 678', provider: 'Orange Money', timeAgo: '10 min ago'  },
  { id: 's2', amount: 100000, phone: '74 123 456', provider: 'MyZaka',       timeAgo: '1 hour ago'  },
]

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { userName } = useAuth()
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  const [smsItems,    setSmsItems]    = useState<SmsItem[]>(MOCK_SMS)
  const [showWelcome, setShowWelcome] = useState(false)

  function dismissWelcome() {
    _welcomeDismissed = true
    setShowWelcome(false)
  }

  const firstName    = userName ? userName.split(' ')[0] : 'there'
  const userInitials = userName ? initials(userName) : '?'
  const today = new Date().toLocaleDateString('en-BW', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const activeFunds       = MOCK_FUNDS.filter(f => f.status === 'active')
  const totalBalance      = activeFunds.reduce((s, f) => s + f.balance, 0)
  const totalMembers      = activeFunds.reduce((s, f) => s + f.member_count, 0)
  const thisMonthContribs = 125000

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* ── Welcome overlay ───────────────────────── */}
      <Modal
        visible={showWelcome}
        animationType="slide"
        onRequestClose={dismissWelcome}
        statusBarTranslucent
      >
        <SafeAreaView style={[styles.safe, { backgroundColor: styles.safe.backgroundColor }]}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
          <ScrollView contentContainerStyle={styles.welcomeScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.welcomeCircle}>
              <Text style={styles.welcomeEmoji}>🎉</Text>
            </View>

            <Text style={styles.welcomeHeading}>Welcome to Tshelo!</Text>
            <Text style={styles.welcomeSub}>
              Create your first fund and start collecting contributions with full transparency.
            </Text>

            <View style={styles.featuresCard}>
              <Text style={styles.featuresCardTitle}>Your first fund is FREE</Text>
              {[
                'SMS payment detection',
                'Full transparency for all members',
                'Receipt scanning',
                'Export PDF reports',
              ].map(feature => (
                <View key={feature} style={styles.featureRow}>
                  <View style={styles.featureCheck}>
                    <Ionicons name="checkmark" size={13} color="#059669" />
                  </View>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.welcomeButton}
              onPress={() => {
                dismissWelcome()
                navigation.navigate('CreateFund', { isFirst: true })
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
              <Text style={styles.welcomeButtonText}>Create Your First Fund</Text>
            </TouchableOpacity>

            <Text style={styles.welcomeNote}>No credit card required</Text>

            <TouchableOpacity onPress={dismissWelcome} activeOpacity={0.7} style={styles.welcomeSkipBtn}>
              <Text style={styles.welcomeSkipText}>I'll do this later</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Normal homescreen content ─────────────── */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.homeHeader}>
          <View style={styles.homeTitleBlock}>
            <Text style={styles.homeGreeting}>Hey {firstName}</Text>
            <Text style={styles.homeSubtitle}>Here's your overview</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.tokenPill} onPress={() => navigation.navigate('TokenPurchase')} activeOpacity={0.85}>
              <View style={styles.tokenIcon}>
                <View style={styles.tokenIconDot} />
              </View>
              <View style={styles.tokenTextBlock}>
                <Text style={styles.tokenCount}>25</Text>
                <Text style={styles.tokenLabel}>tokens</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userInitials}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.homeSectionTitle}>YOUR FUNDS</Text>

        <View style={styles.fundsList}>
          {activeFunds.map(fund => {
            const pct = Math.round((fund.total_contributions / fund.goal_amount) * 100)
            const isEvent = fund.category === 'Event'
            return (
              <TouchableOpacity
                key={fund.id}
                style={styles.overviewCard}
                onPress={() => isEvent
                  ? navigation.navigate('EventDetail', { eventId: fund.id })
                  : navigation.navigate('FundDetail', { fundId: fund.id })}
                activeOpacity={0.85}
              >
                <View style={styles.overviewTop}>
                  <View style={[styles.fundLetterIcon, isEvent && styles.eventLetterIcon]}>
                    <Text style={styles.fundLetterText}>{isEvent ? 'W' : 'F'}</Text>
                  </View>
                  <View style={styles.overviewInfo}>
                    <Text style={styles.overviewTitle} numberOfLines={1}>{fund.title}</Text>
                    <View style={[styles.overviewTag, isEvent && styles.eventTag]}>
                      <Text style={[styles.overviewTagText, isEvent && styles.eventTagText]}>{fund.category}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={[colors.primary, '#55CFC6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` as any }]}
                  />
                </View>

                <View style={styles.overviewBottom}>
                  <Text style={styles.overviewMeta}>
                    {isEvent
                      ? `${fund.member_count} confirmed · budget ${thebeToWholeBWP(fund.goal_amount)}`
                      : `${thebeToWholeBWP(fund.balance)} of ${thebeToWholeBWP(fund.goal_amount)} · ${fund.member_count} members`}
                  </Text>
                  <Text style={[styles.overviewAction, isEvent && styles.eventAction]}>
                    {isEvent ? 'RSVP' : `${pct}%`}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.homeSectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('RecordContribution', { fundId: activeFunds[0].id, fundTitle: activeFunds[0].title })}
          >
            <View style={styles.quickIcon}>
              <Ionicons name="add" size={28} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.quickTitle}>Record</Text>
              <Text style={styles.quickSubtitle}>Contribution</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('FundDetail', { fundId: activeFunds[0].id })}
          >
            <View style={styles.quickIcon}>
              <Ionicons name="person-add" size={26} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.quickTitle}>Add</Text>
              <Text style={styles.quickSubtitle}>Members</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    // ── Welcome state ──────────────────────────────────────────
    welcomeScroll: {
      flexGrow: 1,
      paddingHorizontal: 28,
      paddingTop: 32,
      paddingBottom: 48,
      alignItems: 'center',
    },
    welcomeCircle: {
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
    },
    welcomeEmoji:   { fontSize: 72 },
    welcomeHeading: {
      fontSize: 26,
      fontFamily: fonts.display.bold,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 12,
    },
    welcomeSub: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
    },
    featuresCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      width: '100%',
      marginBottom: 24,
      gap: 14,
    },
    featuresCardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    featureCheck: {
      width: 26,
      height: 26,
      borderRadius: 6,
      backgroundColor: '#D1FAE5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: {
      fontSize: 14,
      color: colors.textPrimary,
      flex: 1,
    },
    welcomeButton: {
      backgroundColor: colors.primary,
      borderRadius: 28,
      paddingVertical: 17,
      paddingHorizontal: 28,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      width: '100%',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
      marginBottom: 12,
    },
    welcomeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    welcomeNote: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },
    welcomeSkipBtn: {
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 20,
    },
    welcomeSkipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },

    // ── Home overview ──────────────────────────────────────────
    homeHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 26,
      gap: 12,
    },
    homeTitleBlock: {
      flex: 1,
      paddingTop: 2,
    },
    homeGreeting: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    homeSubtitle: {
      fontSize: 17,
      lineHeight: 23,
      color: colors.textMuted,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    tokenPill: {
      minWidth: 108,
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      backgroundColor: colors.accentLight,
      borderWidth: 2,
      borderColor: '#F59E0B',
      borderRadius: 28,
      paddingHorizontal: 14,
    },
    tokenIcon: {
      width: 25,
      height: 25,
      borderRadius: 13,
      borderWidth: 3,
      borderColor: '#F59E0B',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tokenIconDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: '#F59E0B',
    },
    tokenTextBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 42,
    },
    tokenCount: {
      fontSize: 18,
      lineHeight: 20,
      fontWeight: '900',
      color: '#92400E',
      textAlign: 'center',
    },
    tokenLabel: {
      fontSize: 12,
      lineHeight: 14,
      fontWeight: '800',
      color: '#D97706',
      textAlign: 'center',
    },
    homeSectionTitle: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '900',
      letterSpacing: 2,
      color: colors.textMuted,
      marginBottom: 12,
    },
    fundsList: {
      gap: 20,
      marginBottom: 12,
    },
    overviewCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.04,
      shadowRadius: 14,
      elevation: 2,
    },
    overviewTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 14,
    },
    fundLetterIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    eventLetterIcon: {
      backgroundColor: '#55CFC6',
    },
    fundLetterText: {
      fontSize: 19,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    overviewInfo: {
      flex: 1,
      gap: 9,
    },
    overviewTitle: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    overviewTag: {
      alignSelf: 'flex-start',
      minWidth: 95,
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 18,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    overviewTagText: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.primary,
    },
    eventTag: {
      backgroundColor: '#CFF5EF',
    },
    eventTagText: {
      color: '#0F9F8D',
    },
    overviewBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    overviewMeta: {
      flex: 1,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    overviewAction: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.primary,
    },
    eventAction: {
      color: '#059669',
    },
    quickActions: {
      flexDirection: 'row',
      gap: 20,
    },
    quickActionCard: {
      flex: 1,
      minHeight: 88,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.04,
      shadowRadius: 14,
      elevation: 2,
    },
    quickIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickTitle: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    quickSubtitle: {
      fontSize: 15,
      lineHeight: 20,
      color: colors.textMuted,
    },

    // ── Header ─────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 16,
    },
    greeting: {
      fontSize: 22,
      fontWeight: '800',
      fontFamily: fonts.display.bold,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    date: { fontSize: 13, color: colors.textMuted },
    avatarWrap: { position: 'relative' },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 17, fontWeight: '900', color: '#FFFFFF' },
    notifDot: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: '#EF4444',
      borderWidth: 2,
      borderColor: colors.background,
    },

    scrollContent: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 48 },

    // ── Summary card ───────────────────────────────────────────
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    summaryLabel:     { fontSize: 13, color: colors.textMuted, marginBottom: 6 },
    summaryTotal: {
      fontSize: 34,
      fontFamily: fonts.display.bold,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 18,
    },
    summaryStats:     { flexDirection: 'row', alignItems: 'center' },
    summaryStat:      { flex: 1, alignItems: 'center' },
    summarySep:       { width: 1, height: 28, backgroundColor: colors.border },
    summaryStatValue: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
    summaryStatLabel: { fontSize: 11, color: colors.textMuted },

    // ── SMS banner ─────────────────────────────────────────────
    smsBanner: {
      backgroundColor: '#FEECA4',
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: '#F59E0B',
      padding: 14,
      marginBottom: 16,
      gap: 10,
    },
    smsBannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    smsBannerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#F59E0B',
      alignItems: 'center',
      justifyContent: 'center',
    },
    smsBannerTitleWrap: { flex: 1 },
    smsBannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#92400E',
    },
    smsBannerSub: {
      fontSize: 12,
      color: '#D97706',
      marginTop: 1,
    },
    smsItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF9E4',
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    smsItemInfo:   { flex: 1 },
    smsItemAmount: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    smsItemMeta:   { fontSize: 12, color: colors.textMuted },
    smsConfirmBtn: {
      backgroundColor: '#F59E0B',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    smsConfirmText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // ── Achievement card ───────────────────────────────────────
    achievementCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    achievementIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    achievementIconEmoji: { fontSize: 20 },
    achievementBody:      { flex: 1 },
    achievementTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary,
      marginBottom: 2,
    },
    achievementSub: {
      fontSize: 12,
      color: colors.primary,
      opacity: 0.75,
    },
    achievementDecor: { fontSize: 32 },

    // ── Section header ─────────────────────────────────────────
    section:       { marginBottom: 28 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      fontFamily: fonts.display.bold,
      color: colors.textPrimary,
    },
    seeAll: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

    // ── Fund card ──────────────────────────────────────────────
    fundCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fundCardMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    fundIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fundEmoji:    { fontSize: 22 },
    fundInfo:     { flex: 1 },
    fundTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    fundTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
    },
    fundPct: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
      marginLeft: 8,
    },
    fundTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    categoryTag: {
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    categoryTagText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    memberRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
    memberText: { fontSize: 11, color: colors.textMuted },

    progressTrack: {
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginBottom: 6,
    },
    progressFill: { height: '100%', borderRadius: 6, backgroundColor: colors.primary },

    fundCardBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    fundBalance:  { fontSize: 12, color: colors.textSecondary },
    payoutRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
    payoutText:   { fontSize: 11, color: colors.textMuted },
  })
}
