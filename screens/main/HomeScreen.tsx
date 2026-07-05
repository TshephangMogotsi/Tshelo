import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { supabase } from '../../lib/supabase'
import { HomeItem, HomeItemKind, KIND_LABELS, initials } from './home/helpers'
import { loadHomeItems } from './home/loadHomeItems'
import HomeItemCard from './home/HomeItemCard'
import WelcomeOverlay from './home/WelcomeOverlay'

// persists for the current app session; resets on app restart (= "show every login")
let _welcomeDismissed = false

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { userName, userId } = useAuth()
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  const [showWelcome,    setShowWelcome]    = useState(false)
  const [homeItems,      setHomeItems]      = useState<HomeItem[]>([])
  const [isLoading,      setIsLoading]      = useState(false)
  const [loadError,      setLoadError]      = useState<string | null>(null)
  const [activeFilter,   setActiveFilter]   = useState<string>('all')
  const [unreadCount,    setUnreadCount]    = useState(0)

  useFocusEffect(
    useCallback(() => {
      let active = true

      async function load() {
        if (!userId) return
        setIsLoading(true)
        setLoadError(null)

        try {
          const items = await loadHomeItems(userId)
          if (active) setHomeItems(items)
        } catch (err) {
          if (active) {
            setLoadError(err instanceof Error ? err.message : 'Could not load your items.')
            setHomeItems([])
          }
        } finally {
          if (active) setIsLoading(false)
        }
      }

      async function loadUnreadCount() {
        if (!userId) return
        const { count, error } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false)
        if (active && !error) setUnreadCount(count ?? 0)
      }

      load()
      loadUnreadCount()
      return () => { active = false }
    }, [userId])
  )

  function dismissWelcome() {
    _welcomeDismissed = true
    setShowWelcome(false)
  }

  const userInitials   = userName ? initials(userName) : '?'
  const firstFundItem  = homeItems.find(i => i.kind !== 'event' && i.status.toLowerCase() === 'active')

  const presentKinds   = Array.from(new Set(homeItems.map(i => i.kind)))
  const showFilters    = presentKinds.length > 1
  const filteredItems  = activeFilter === 'all' ? homeItems : homeItems.filter(i => i.kind === activeFilter)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <WelcomeOverlay
        visible={showWelcome}
        onDismiss={dismissWelcome}
        onCreateFirstFund={() => {
          dismissWelcome()
          navigation.navigate('CreateFund', { isFirst: true })
        }}
      />

      {/* ── Normal homescreen content ─────────────── */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.homeHeader}>
          <View style={styles.homeTitleBlock}>
            <Text style={styles.homeGreeting}>Overview</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.tokenPill} onPress={() => navigation.navigate('TokenPurchase')} activeOpacity={0.85}>
              <View style={styles.tokenIcon}>
                <View style={styles.tokenIconDot} />
              </View>
              <View style={styles.tokenTextBlock}>
                <Text style={styles.tokenCount}>25</Text>
                <Text style={styles.tokenLabel}> tokens</Text>
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

        <View style={styles.sectionTitleRow}>
          <Text style={styles.homeSectionTitle}>YOUR ITEMS</Text>
          <TouchableOpacity
            style={styles.joinFundBtn}
            onPress={() => navigation.navigate('JoinFund')}
            activeOpacity={0.8}
          >
            <Ionicons name="link-outline" size={14} color={colors.primary} />
            <Text style={styles.joinFundBtnText}>Join Fund</Text>
          </TouchableOpacity>
        </View>

        {showFilters && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={styles.filterScroll}
          >
            {(['all', ...presentKinds] as const).map(opt => {
              const isActive = activeFilter === opt
              const label    = opt === 'all' ? 'All' : KIND_LABELS[opt as HomeItemKind]
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setActiveFilter(opt)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}

        <View style={styles.fundsList}>
          {isLoading && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Loading...</Text>
            </View>
          )}

          {!isLoading && loadError && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Could not load your items</Text>
              <Text style={styles.emptyText}>{loadError}</Text>
            </View>
          )}

          {!isLoading && !loadError && homeItems.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyText}>Create your own fund or join one with an invite code.</Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={styles.emptyPrimaryBtn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('CreateFund')}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.emptyPrimaryBtnText}>Create Fund</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.emptySecondaryBtn}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('JoinFund')}
                >
                  <Ionicons name="link-outline" size={16} color={colors.primary} />
                  <Text style={styles.emptySecondaryBtnText}>Join Fund</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!isLoading && !loadError && homeItems.length > 0 && filteredItems.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No {activeFilter === 'all' ? '' : KIND_LABELS[activeFilter as HomeItemKind]} items</Text>
              <Text style={styles.emptyText}>Nothing matches this filter.</Text>
            </View>
          )}

          {filteredItems.map(item => (
            <HomeItemCard
              key={item.id}
              item={item}
              onPress={() => {
                if ((item.kind === 'event' || item.kind === 'eventFund') && item.eventId) {
                  navigation.navigate('EventDetail', { eventId: item.eventId })
                  return
                }
                if (item.fundId) navigation.navigate('FundDetail', { fundId: item.fundId })
              }}
            />
          ))}
        </View>

        <Text style={styles.homeSectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionCard}
            activeOpacity={0.85}
            onPress={() => {
              if (firstFundItem?.fundId) {
                navigation.navigate('RecordContribution', { fundId: firstFundItem.fundId, fundTitle: firstFundItem.title })
              } else {
                navigation.navigate('CreateFund')
              }
            }}
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
            onPress={() => {
              if (firstFundItem?.fundId) navigation.navigate('FundDetail', { fundId: firstFundItem.fundId })
              else navigation.navigate('CreateFund')
            }}
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    bellBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: colors.error,
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellBadgeText: {
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    tokenPill: {
      height: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.accentLight,
      borderWidth: 1.5,
      borderColor: '#F59E0B',
      borderRadius: 19,
      paddingHorizontal: 10,
    },
    tokenIcon: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#F59E0B',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tokenIconDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#F59E0B',
    },
    tokenTextBlock: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 0,
    },
    tokenCount: {
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '900',
      color: '#92400E',
    },
    tokenLabel: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
      color: '#D97706',
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    homeSectionTitle: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '900',
      letterSpacing: 2,
      color: colors.textMuted,
    },
    joinFundBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.primaryLight,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    joinFundBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    filterScroll: {
      marginBottom: 14,
      marginHorizontal: -20,
    },
    filterRow: {
      paddingHorizontal: 20,
      gap: 8,
      flexDirection: 'row',
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    filterChipTextActive: {
      color: '#FFFFFF',
    },
    fundsList: {
      gap: 20,
      marginBottom: 12,
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    emptyText: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.textMuted,
      marginBottom: 16,
    },
    emptyActions: {
      flexDirection: 'row',
      gap: 10,
    },
    emptyPrimaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
    },
    emptyPrimaryBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    emptySecondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primaryLight,
      borderRadius: 14,
      paddingVertical: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    emptySecondaryBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
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

    scrollContent: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 48 },
  })
}
