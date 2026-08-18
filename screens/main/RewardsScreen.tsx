import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { api } from '../../lib/api'
import { createLatestApiRequest, runApiRead, toApiUiError } from '../../lib/apiScreen'
import type { MainStackParamList } from '../../navigation/types'
import type { RewardProgress } from '../../shared/contracts'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'Rewards'>
}

type TrustProfile = {
  trust_score: number
  trust_level: 'new' | 'basic' | 'trusted' | 'verified'
}

const TRUST_LABELS: Record<TrustProfile['trust_level'], string> = {
  new: 'New',
  basic: 'Basic',
  trusted: 'Trusted',
  verified: 'Verified',
}

function progressCopy(reward: RewardProgress) {
  if (reward.is_earned) return 'Earned'
  if (reward.reward_code === 'transparent_organiser') {
    return '80% receipts across 5 expenses'
  }
  return `${Math.min(reward.current, reward.threshold)} of ${reward.threshold} ${reward.unit}`
}

export default function RewardsScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme()
  const { userId, tokenBalance, refreshProfile } = useAuth()
  const styles = makeStyles(colors)
  const [rewards, setRewards] = useState<RewardProgress[]>([])
  const [trust, setTrust] = useState<TrustProfile>({ trust_score: 0, trust_level: 'new' })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const rewardsRequest = useRef(createLatestApiRequest())

  const load = useCallback(async (refreshing = false, signal?: AbortSignal) => {
    if (!userId) return
    refreshing ? setIsRefreshing(true) : setIsLoading(true)
    setLoadError(null)

    try {
      await api.rewards.evaluate({ signal })
      const overview = await runApiRead(call => api.rewards.progress(call), { signal })
      if (signal?.aborted) return
      setRewards(overview.rewards)
      const level = overview.trust.trust_level
      setTrust({
        trust_score: overview.trust.trust_score,
        trust_level: (level in TRUST_LABELS ? level : 'new') as TrustProfile['trust_level'],
      })
      await refreshProfile()
    } catch (error) {
      if (!signal?.aborted) setLoadError(toApiUiError(error, signal).message)
    }

    if (!signal?.aborted) {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [refreshProfile, userId])

  const startLoad = useCallback((refreshing = false) => {
    const signal = rewardsRequest.current.start()
    void load(refreshing, signal)
  }, [load])

  useFocusEffect(useCallback(() => {
    startLoad()
    return () => rewardsRequest.current.cancel()
  }, [startLoad]))

  const earned = rewards.filter(reward => reward.is_earned)
  const inProgress = rewards.filter(reward => !reward.is_earned)
  const trustProgress = Math.max(0, Math.min(100, trust.trust_score))

  function RewardCard({ reward }: { reward: RewardProgress }) {
    const ratio = reward.is_earned
      ? 1
      : Math.max(0, Math.min(1, reward.current / reward.threshold))

    return (
      <View style={[styles.rewardCard, reward.is_earned && styles.rewardCardEarned]}>
        <View style={[styles.rewardIcon, reward.is_earned && styles.rewardIconEarned]}>
          <Ionicons
            name={(reward.icon || 'trophy-outline') as keyof typeof Ionicons.glyphMap}
            size={21}
            color={reward.is_earned ? colors.primary : colors.textMuted}
          />
        </View>
        <View style={styles.rewardBody}>
          <View style={styles.rewardTitleRow}>
            <Text style={styles.rewardName}>{reward.name}</Text>
            {reward.is_earned ? (
              <View style={styles.earnedPill}>
                <Ionicons name="checkmark" size={11} color={colors.primary} />
                <Text style={styles.earnedPillText}>EARNED</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rewardDescription}>{reward.description}</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{progressCopy(reward)}</Text>
          </View>
        </View>
        <View style={styles.pointsPill}>
          <Text style={styles.pointsPlus}>+{reward.trust_points_reward}</Text>
          <Text style={styles.pointsUnit}>TRUST</Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trust & Achievements</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={34} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Rewards unavailable</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => startLoad()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => startLoad(true)} tintColor={colors.primary} />}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroEyebrow}>YOUR TRUST POINTS</Text>
                <View style={styles.balanceRow}>
                  <Text style={styles.balance}>{trust.trust_score}</Text>
                  <Text style={styles.balanceUnit}>/ 100</Text>
                </View>
              </View>
              <View style={styles.coinIcon}>
                <Ionicons name="sparkles" size={24} color={colors.primary} />
              </View>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStats}>
              <View>
                <Text style={styles.heroStatValue}>{earned.length}</Text>
                <Text style={styles.heroStatLabel}>Achievements</Text>
              </View>
            </View>
          </View>

          <View style={styles.trustCard}>
            <View style={styles.trustHeadingRow}>
              <View style={styles.trustIcon}>
                <Ionicons name="shield-checkmark" size={21} color={colors.primary} />
              </View>
              <View style={styles.trustCopy}>
                <Text style={styles.trustLabel}>Trust level</Text>
                <Text style={styles.trustValue}>{TRUST_LABELS[trust.trust_level]}</Text>
              </View>
              <Text style={styles.trustScore}>{trust.trust_score}/100</Text>
            </View>
            <View style={styles.trustTrack}>
              <View style={[styles.trustFill, { width: `${trustProgress}%` }]} />
            </View>
            <Text style={styles.trustHint}>Trust points are earned through reliable activity. They cannot be bought, transferred or redeemed, and have no cash value.</Text>
          </View>

          <TouchableOpacity style={styles.tokenWalletCard} onPress={() => navigation.navigate('TokenPurchase')} activeOpacity={0.82}>
            <View style={styles.tokenWalletIcon}>
              <Ionicons name="wallet-outline" size={21} color={colors.primary} />
            </View>
            <View style={styles.tokenWalletCopy}>
              <Text style={styles.tokenWalletTitle}>Paid token balance</Text>
              <Text style={styles.tokenWalletText}>{tokenBalance} tokens for paid features</Text>
            </View>
            <Text style={styles.tokenWalletAction}>Buy</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.richAuntieCard} onPress={() => navigation.navigate('RichAuntieStatus')} activeOpacity={0.82}>
            <View style={styles.richAuntieIcon}>
              <Ionicons name="ribbon-outline" size={21} color="#A36300" />
            </View>
            <View style={styles.richAuntieCopy}>
              <Text style={styles.richAuntieTitle}>Rich Auntie recognition</Text>
              <Text style={styles.richAuntieText}>Special appreciation awarded by organisers.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {earned.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Earned</Text>
              <View style={styles.rewardList}>
                {earned.map(reward => <RewardCard key={reward.reward_code} reward={reward} />)}
              </View>
            </>
          ) : null}

          {inProgress.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Keep going</Text>
              <View style={styles.rewardList}>
                {inProgress.map(reward => <RewardCard key={reward.reward_code} reward={reward} />)}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      height: 64,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: { fontFamily: fonts.inter.extraBold, fontSize: 18, color: colors.textPrimary },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    scroll: { paddingHorizontal: 18, paddingBottom: 42 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
    errorTitle: { fontFamily: fonts.inter.bold, fontSize: 17, color: colors.textPrimary, marginTop: 4 },
    errorText: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
    retryButton: { marginTop: 8, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
    retryText: { fontFamily: fonts.inter.bold, fontSize: 13, color: '#FFFFFF' },
    hero: { backgroundColor: '#E8DDFF', borderRadius: 24, padding: 20, marginTop: 6 },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroEyebrow: { fontFamily: fonts.inter.bold, fontSize: 10, letterSpacing: 0.9, color: '#6C37C6' },
    balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 3 },
    balance: { fontFamily: fonts.inter.extraBold, fontSize: 34, color: '#17121F' },
    balanceUnit: { fontFamily: fonts.inter.semiBold, fontSize: 14, color: '#604C7D' },
    coinIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    heroDivider: { height: 1, backgroundColor: 'rgba(93,53,151,0.16)', marginVertical: 16 },
    heroStats: { flexDirection: 'row', alignItems: 'center' },
    heroStatValue: { fontFamily: fonts.inter.extraBold, fontSize: 18, color: '#17121F' },
    heroStatLabel: { fontFamily: fonts.inter.medium, fontSize: 11, color: '#604C7D', marginTop: 1 },
    trustCard: { marginTop: 14, padding: 17, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    trustHeadingRow: { flexDirection: 'row', alignItems: 'center' },
    trustIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
    trustCopy: { flex: 1, marginLeft: 11 },
    trustLabel: { fontFamily: fonts.inter.medium, fontSize: 11, color: colors.textMuted },
    trustValue: { fontFamily: fonts.inter.extraBold, fontSize: 16, color: colors.textPrimary, marginTop: 1 },
    trustScore: { fontFamily: fonts.inter.bold, fontSize: 13, color: colors.primary },
    trustTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: 14, overflow: 'hidden' },
    trustFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
    trustHint: { fontFamily: fonts.inter.regular, fontSize: 11, lineHeight: 16, color: colors.textSecondary, marginTop: 9 },
    tokenWalletCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, marginTop: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    tokenWalletIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
    tokenWalletCopy: { flex: 1 },
    tokenWalletTitle: { fontFamily: fonts.inter.bold, fontSize: 13, color: colors.textPrimary },
    tokenWalletText: { fontFamily: fonts.inter.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    tokenWalletAction: { fontFamily: fonts.inter.bold, fontSize: 12, color: colors.primary },
    richAuntieCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, marginTop: 14, borderRadius: 18, backgroundColor: '#FFF6DE', borderWidth: 1, borderColor: '#F5D991' },
    richAuntieIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
    richAuntieCopy: { flex: 1 },
    richAuntieTitle: { fontFamily: fonts.inter.bold, fontSize: 13, color: '#3F2A00' },
    richAuntieText: { fontFamily: fonts.inter.regular, fontSize: 11, color: '#785F2B', marginTop: 2 },
    sectionTitle: { fontFamily: fonts.inter.extraBold, fontSize: 16, color: colors.textPrimary, marginTop: 25, marginBottom: 10 },
    rewardList: { gap: 10 },
    rewardCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 13 },
    rewardCardEarned: { borderColor: '#D9C7FF' },
    rewardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    rewardIconEarned: { backgroundColor: '#E8DDFF' },
    rewardBody: { flex: 1, minWidth: 0 },
    rewardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rewardName: { flexShrink: 1, fontFamily: fonts.inter.bold, fontSize: 13, color: colors.textPrimary },
    rewardDescription: { fontFamily: fonts.inter.regular, fontSize: 10.5, lineHeight: 15, color: colors.textSecondary, marginTop: 2 },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
    progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
    progressText: { fontFamily: fonts.inter.medium, fontSize: 8.5, color: colors.textMuted },
    earnedPill: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 8, backgroundColor: '#E8DDFF', paddingHorizontal: 6, paddingVertical: 3 },
    earnedPillText: { fontFamily: fonts.inter.bold, fontSize: 7, letterSpacing: 0.4, color: colors.primary },
    pointsPill: { alignItems: 'center', minWidth: 40 },
    pointsPlus: { fontFamily: fonts.inter.extraBold, fontSize: 13, color: colors.primary },
    pointsUnit: { fontFamily: fonts.inter.bold, fontSize: 6.5, letterSpacing: 0.4, color: colors.textMuted },
  })
}
