import { useCallback, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { createLatestApiRequest, toApiUiError } from '../../lib/apiScreen'
import {
  HomeItem,
  HomeItemKind,
  HomeSortOrder,
  HomeStatusFilter,
  KIND_LABELS,
  initials,
  matchesHomeStatus,
  sortHomeItems,
} from './home/helpers'
import { loadHomeSummary } from './home/loadHomeItems'
import HomeItemCard from './home/HomeItemCard'
import HomeSortMenu from './home/HomeSortMenu'
import WelcomeOverlay from './home/WelcomeOverlay'

// persists for the current app session; resets on app restart (= "show every login")
let _welcomeDismissed = false

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { userName, userId, tokenBalance, refreshProfile } = useAuth()
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  const [showWelcome,    setShowWelcome]    = useState(false)
  const [homeItems,      setHomeItems]      = useState<HomeItem[]>([])
  const [isLoading,      setIsLoading]      = useState(false)
  const [loadError,      setLoadError]      = useState<string | null>(null)
  const [kindFilter,     setKindFilter]     = useState<'all' | HomeItemKind>('all')
  const [statusFilter,   setStatusFilter]   = useState<HomeStatusFilter>('all')
  const [sortOrder,      setSortOrder]      = useState<HomeSortOrder>('newest')
  const [unreadCount,    setUnreadCount]    = useState(0)
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [searchQuery,    setSearchQuery]    = useState('')
  const hasLoadedRef = useRef(false)
  const latestRequestRef = useRef(createLatestApiRequest())

  useFocusEffect(
    useCallback(() => {
      const signal = latestRequestRef.current.start()

      // Token grants and paid actions happen on other screens. Refresh the
      // shared profile state whenever Home regains focus so this header always
      // reflects the server-owned balance rather than a stale session value.
      void refreshProfile()

      async function load() {
        if (!userId) return
        if (!hasLoadedRef.current) setIsLoading(true)
        setLoadError(null)

        try {
          const summary = await loadHomeSummary(signal)
          if (latestRequestRef.current.isCurrent(signal)) {
            setHomeItems(summary.items)
            setUnreadCount(summary.unreadCount)
            hasLoadedRef.current = true
          }
        } catch (err) {
          if (latestRequestRef.current.isCurrent(signal)) {
            if (!hasLoadedRef.current) {
              const error = toApiUiError(err, signal)
              if (error.kind !== 'cancelled') setLoadError(error.message)
              setHomeItems([])
            }
          }
        } finally {
          if (latestRequestRef.current.isCurrent(signal)) setIsLoading(false)
        }
      }

      load()
      return () => latestRequestRef.current.cancel()
    }, [userId])
  )

  function dismissWelcome() {
    _welcomeDismissed = true
    setShowWelcome(false)
  }

  const userInitials   = userName ? initials(userName) : '?'

  const presentKinds   = Array.from(new Set(homeItems.map(i => i.kind)))
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredItems  = sortHomeItems(homeItems.filter(item => {
    const matchesKind = kindFilter === 'all' || item.kind === kindFilter
    const matchesStatus = matchesHomeStatus(item, statusFilter)
    const matchesSearch = !normalizedSearch || [item.title, item.category, item.venue_name]
      .some(value => value?.toLowerCase().includes(normalizedSearch))
    return matchesKind && matchesStatus && matchesSearch
  }), sortOrder)
  const selectedFilterLabel = [
    statusFilter === 'all' ? '' : statusFilter,
    kindFilter === 'all' ? '' : KIND_LABELS[kindFilter],
  ].filter(Boolean).join(' ')

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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
          <View style={styles.homeTopRow}>
            <Text style={styles.homeGreeting}>Overview</Text>

            <View style={styles.profileActions}>
              <TouchableOpacity
                style={styles.tokenPill}
                onPress={() => navigation.navigate('TokenPurchase')}
                activeOpacity={0.85}
                accessibilityLabel={`${tokenBalance} tokens`}
              >
                <View style={styles.tokenIcon}>
                  <View style={styles.tokenIconDot} />
                </View>
                <Text style={styles.tokenCount}>{tokenBalance}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bellBtn}
                onPress={() => navigation.navigate('Notifications')}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications-outline" size={19} color={colors.textSecondary} />
                {unreadCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
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

          {!searchOpen && (
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.searchBtn} onPress={() => setSearchOpen(true)} activeOpacity={0.8}>
                <Ionicons name="search" size={18} color={colors.textSecondary} />
                <Text style={styles.searchBtnText}>Search items</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {searchOpen && (
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search funds and events"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="search"
            />
            <TouchableOpacity
              onPress={() => { setSearchQuery(''); setSearchOpen(false) }}
              hitSlop={8}
              accessibilityLabel="Close search"
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.homeSectionTitle}>YOUR ITEMS</Text>
          <HomeSortMenu
            sortOrder={sortOrder}
            statusFilter={statusFilter}
            kindFilter={kindFilter}
            availableKinds={presentKinds}
            onSortChange={setSortOrder}
            onStatusChange={setStatusFilter}
            onKindChange={setKindFilter}
          />
        </View>

        <View style={styles.fundsList}>
          {isLoading && homeItems.length === 0 && (
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
              <Text style={styles.emptyText}>Create something new, or join a fund or event with an invite code.</Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={styles.emptyPrimaryBtn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('CreateFund')}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.emptyPrimaryBtnText}>Create</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.emptySecondaryBtn}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('JoinFund')}
                >
                  <Ionicons name="link-outline" size={16} color={colors.primary} />
                  <Text style={styles.emptySecondaryBtnText}>Join Fund</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.emptySecondaryBtn}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('JoinEvent')}
                >
                  <Ionicons name="ticket-outline" size={16} color={colors.primary} />
                  <Text style={styles.emptySecondaryBtnText}>Join Event</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!isLoading && !loadError && homeItems.length > 0 && filteredItems.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{normalizedSearch ? 'No results' : `No ${selectedFilterLabel} items`}</Text>
              <Text style={styles.emptyText}>{normalizedSearch ? `Nothing matches “${searchQuery.trim()}”.` : 'Nothing matches this filter.'}</Text>
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
      </ScrollView>

    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    // ── Home overview ──────────────────────────────────────────
    homeHeader: {
      marginBottom: 18,
      gap: 10,
    },
    homeTopRow: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    homeGreeting: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    profileActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerActions: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 15,
      paddingHorizontal: 4,
      overflow: 'visible',
    },
    searchBtn: {
      flex: 1,
      height: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 11,
      paddingHorizontal: 10,
    },
    searchBtnActive: {
      backgroundColor: colors.primaryLight,
    },
    searchBtnText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    searchBtnTextActive: {
      color: colors.primary,
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
      borderColor: colors.surface,
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
      gap: 5,
      backgroundColor: colors.accentLight,
      borderRadius: 19,
      paddingHorizontal: 10,
    },
    searchBar: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 13,
      marginTop: -8,
      marginBottom: 14,
    },
    searchInput: {
      flex: 1,
      height: 44,
      fontSize: 14,
      color: colors.textPrimary,
      paddingVertical: 0,
      textAlignVertical: 'center',
    },
    tokenIcon: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tokenIconDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    tokenCount: {
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '900',
      color: colors.accent,
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
    fundsList: {
      gap: 16,
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
    // ── Header ─────────────────────────────────────────────────
    avatarWrap: { position: 'relative' },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },

    scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 48 },
  })
}
