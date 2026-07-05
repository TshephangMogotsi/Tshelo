import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Share, Alert, ActivityIndicator, Clipboard } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import type { AppColors } from '../../theme/themes'
import { supabase, fundPreviewUrl } from '../../lib/supabase'
import {
  Contribution,
  Expense,
  FundDetail,
  Member,
  MemberRole,
  PendingRequest,
  Tab,
  formatMoney,
} from './fundDetail/types'
import { ContributionRow, ExpenseRow, MemberRow, PendingRequestRow } from './fundDetail/rows'
import FundHeader from './fundDetail/FundHeader'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'FundDetail'>
  route: RouteProp<MainStackParamList, 'FundDetail'>
}

export default function FundDetailScreen({ navigation, route }: Props) {
  const { fundId } = route.params
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const styles = makeStyles(colors)

  const [activeTab, setActiveTab]     = useState<Tab>('contributions')
  const [fund, setFund]               = useState<FundDetail | null>(null)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [expenses, setExpenses]       = useState<Expense[]>([])
  const [members, setMembers]         = useState<Member[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [isOrganiser, setIsOrganiser] = useState(false)
  const [isLoading, setIsLoading]     = useState(true)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [isDeleting, setIsDeleting]   = useState(false)
  const [decidingId, setDecidingId]   = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true

      async function loadData() {
        if (!userId) return
        setIsLoading(true)
        setLoadError(null)

        const [{ data: fundData, error: fundError }, { data: membership }] = await Promise.all([
          supabase
            .from('funds')
            .select('id, owner_id, title, status, goal_amount, currency_code, fund_code')
            .eq('id', fundId)
            .single(),
          supabase
            .from('fund_members')
            .select('role')
            .eq('fund_id', fundId)
            .eq('user_id', userId)
            .maybeSingle(),
        ])

        if (!active) return

        if (fundError || !fundData) {
          setLoadError('Could not load fund details.')
          setIsLoading(false)
          return
        }

        const organiser = fundData.owner_id === userId || membership?.role === 'owner' || membership?.role === 'admin'
        setIsOrganiser(organiser)

        const [{ data: contribData }, { data: expenseData }, { data: memberData }, { data: pendingData }, { data: profileData }] = await Promise.all([
          supabase
            .from('contributions')
            .select('id, contributor_name, amount, payment_method, detected_via, status, is_refunded, confirmed_at, notes')
            .eq('fund_id', fundId)
            .order('confirmed_at', { ascending: false }),
          supabase
            .from('expenses')
            .select('id, vendor_name, description, category, amount, created_at, notes, has_open_query')
            .eq('fund_id', fundId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('fund_members')
            .select('id, user_id, role, joined_at')
            .eq('fund_id', fundId)
            .eq('status', 'joined')
            .order('joined_at', { ascending: true }),
          organiser
            ? supabase
                .from('fund_members')
                .select('id, invited_at')
                .eq('fund_id', fundId)
                .eq('status', 'pending')
                .order('invited_at', { ascending: true })
            : Promise.resolve({ data: [] as any[] }),
          supabase.rpc('get_fund_member_profiles', { p_fund_id: fundId }),
        ])

        if (!active) return

        const profileByRowId = new Map<string, { user_id: string; name: string; phone: string }>(
          (profileData ?? []).map((p: any) => [p.member_row_id, { user_id: p.user_id, name: p.name, phone: p.phone }])
        )

        const totalContributions = (contribData ?? [])
          .filter(c => c.status === 'confirmed' && !c.is_refunded)
          .reduce((s, c) => s + (c.amount ?? 0), 0)
        const totalExpenses      = (expenseData ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)

        setFund({
          id:                  fundData.id,
          owner_id:            fundData.owner_id,
          title:               fundData.title,
          status:              fundData.status,
          currency_code:       fundData.currency_code,
          goal_amount:         fundData.goal_amount ?? 0,
          total_contributions: totalContributions,
          total_expenses:      totalExpenses,
          balance:             totalContributions - totalExpenses,
          member_count:        (memberData ?? []).length,
          fund_code:           fundData.fund_code,
        })

        setContributions(contribData ?? [])
        setExpenses(expenseData ?? [])
        setMembers(
          (memberData ?? []).map(m => {
            const profile = profileByRowId.get(m.id)
            return {
              id:           m.id,
              user_id:      m.user_id,
              display_name: profile?.name ?? 'Unknown',
              phone:        profile?.phone ?? '',
              role:         m.role as MemberRole,
              joined_at:    m.joined_at,
            }
          })
        )
        setPendingRequests(
          (pendingData ?? []).map((p: any) => {
            const profile = profileByRowId.get(p.id)
            return {
              id:           p.id,
              user_id:      profile?.user_id ?? null,
              display_name: profile?.name ?? 'Unknown',
              phone:        profile?.phone ?? '',
              requested_at: p.invited_at,
            }
          })
        )

        setIsLoading(false)
      }

      loadData()
      return () => { active = false }
    }, [fundId, userId])
  )

  async function handleApprove(memberId: string) {
    if (decidingId) return
    setDecidingId(memberId)
    const { error } = await supabase
      .from('fund_members')
      .update({ status: 'joined', joined_at: new Date().toISOString() })
      .eq('id', memberId)

    setDecidingId(null)

    if (error) {
      Alert.alert('Could not approve request', error.message)
      return
    }

    const request = pendingRequests.find(r => r.id === memberId)
    setPendingRequests(prev => prev.filter(r => r.id !== memberId))
    if (request) {
      setMembers(prev => [...prev, {
        id:           memberId,
        user_id:      request.user_id,
        display_name: request.display_name,
        phone:        request.phone,
        role:         'member',
        joined_at:    new Date().toISOString(),
      }])
      setFund(prev => prev ? { ...prev, member_count: prev.member_count + 1 } : prev)
    }
  }

  function confirmReject(memberId: string, displayName: string) {
    Alert.alert(
      'Reject Request',
      `Reject ${displayName}'s request to join this fund?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => handleReject(memberId) },
      ]
    )
  }

  async function handleReject(memberId: string) {
    if (decidingId) return
    setDecidingId(memberId)
    const { error } = await supabase
      .from('fund_members')
      .update({ status: 'declined' })
      .eq('id', memberId)

    setDecidingId(null)

    if (error) {
      Alert.alert('Could not reject request', error.message)
      return
    }

    setPendingRequests(prev => prev.filter(r => r.id !== memberId))
  }

  function confirmRemoveMember(memberId: string, displayName: string) {
    Alert.alert(
      'Remove Member',
      `Remove ${displayName} from this fund? They will lose access to view contributions and expenses, and will need to be re-invited or request to join again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => handleRemoveMember(memberId) },
      ]
    )
  }

  async function handleRemoveMember(memberId: string) {
    if (decidingId) return
    setDecidingId(memberId)
    const { error } = await supabase
      .from('fund_members')
      .update({ status: 'removed' })
      .eq('id', memberId)

    setDecidingId(null)

    if (error) {
      Alert.alert('Could not remove member', error.message)
      return
    }

    setMembers(prev => prev.filter(m => m.id !== memberId))
    setFund(prev => prev ? { ...prev, member_count: Math.max(0, prev.member_count - 1) } : prev)
  }

  async function handleShareInvite() {
    if (!fund?.fund_code) return
    const link = fundPreviewUrl(fund.fund_code)
    await Share.share({
      message: `Join *${fund.title}* on Tshelo 🙏\n\n${link}`,
      url: link,
    })
  }

  function handleCopyCode() {
    if (!fund?.fund_code) return
    Clipboard.setString(fund.fund_code)
    Alert.alert('Copied', 'Invite code copied to clipboard.')
  }

  function handleMoreOptions() {
    Alert.alert(fund!.title, 'What would you like to do?', [
      {
        text: 'Delete Fund',
        style: 'destructive',
        onPress: confirmDelete,
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  function confirmDelete() {
    Alert.alert(
      'Delete Fund',
      `Are you sure you want to delete "${fund!.title}"? This cannot be undone and all contribution and expense records will be hidden.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: deleteFund,
        },
      ]
    )
  }

  async function deleteFund() {
    if (!fund || isDeleting) return
    setIsDeleting(true)
    const { error } = await supabase
      .from('funds')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', fund.id)

    setIsDeleting(false)

    if (error) {
      Alert.alert('Could not delete fund', error.message)
      return
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'Tabs' as any }],
    })
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'contributions', label: 'Contributions', count: contributions.length },
    { id: 'expenses',      label: 'Expenses',      count: expenses.length },
    { id: 'members',       label: 'Members',       count: members.length },
  ]

  // ── Loading ────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  // ── Error ──────────────────────────────────────────────
  if (loadError || !fund) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{loadError ?? 'Fund not found.'}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBack}>
            <Text style={styles.errorBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <FundHeader
        fund={fund}
        isOrganiser={isOrganiser}
        isOwner={fund.owner_id === userId}
        isDeleting={isDeleting}
        onBack={() => navigation.goBack()}
        onRecordContribution={() => navigation.navigate('RecordContribution', {
          fundId: fund.id,
          fundTitle: fund.title,
          currencyCode: fund.currency_code,
        })}
        onRecordExpense={() => navigation.navigate('RecordExpense', {
          fundId: fund.id,
          fundTitle: fund.title,
          currencyCode: fund.currency_code,
        })}
        onMoreOptions={handleMoreOptions}
        onCopyCode={handleCopyCode}
        onShareInvite={handleShareInvite}
      />

      {/* ── Tabs ───────────────────────────────────── */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            <View style={[styles.tabCount, activeTab === tab.id && styles.tabCountActive]}>
              <Text style={[styles.tabCountText, activeTab === tab.id && styles.tabCountTextActive]}>
                {tab.count}
              </Text>
            </View>
            {tab.id === 'members' && isOrganiser && pendingRequests.length > 0 && (
              <View style={styles.tabPendingDot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab content ────────────────────────────── */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>

        {activeTab === 'contributions' && (
          <>
            <View style={styles.summaryStrip}>
              <Text style={styles.summaryText}>
                Total in: <Text style={styles.summaryValue}>{formatMoney(fund.total_contributions, fund.currency_code)}</Text>
              </Text>
              <Text style={styles.summaryText}>
                {contributions.length} contribution{contributions.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {contributions.length === 0 ? (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabEmoji}>💰</Text>
                <Text style={styles.emptyTabText}>No contributions recorded yet.</Text>
              </View>
            ) : (
              contributions.map(c => (
                <ContributionRow key={c.id} item={c} currencyCode={fund.currency_code} />
              ))
            )}
          </>
        )}

        {activeTab === 'expenses' && (
          <>
            <View style={styles.summaryStrip}>
              <Text style={styles.summaryText}>
                Total out: <Text style={[styles.summaryValue, { color: colors.error }]}>{formatMoney(fund.total_expenses, fund.currency_code)}</Text>
              </Text>
              <Text style={styles.summaryText}>
                {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {expenses.length === 0 ? (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabEmoji}>🧾</Text>
                <Text style={styles.emptyTabText}>No expenses recorded yet.</Text>
              </View>
            ) : (
              expenses.map(e => (
                <ExpenseRow key={e.id} item={e} currencyCode={fund.currency_code} />
              ))
            )}
          </>
        )}

        {activeTab === 'members' && (
          <>
            {isOrganiser && pendingRequests.length > 0 && (
              <>
                <Text style={styles.pendingSectionTitle}>
                  Pending Requests ({pendingRequests.length})
                </Text>
                {pendingRequests.map(r => (
                  <PendingRequestRow
                    key={r.id}
                    request={r}
                    isDeciding={decidingId === r.id}
                    onApprove={() => handleApprove(r.id)}
                    onReject={() => confirmReject(r.id, r.display_name)}
                  />
                ))}
              </>
            )}

            <View style={styles.summaryStrip}>
              <Text style={styles.summaryText}>
                {members.length} member{members.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {members.map(m => (
              <MemberRow
                key={m.id}
                item={m}
                canRemove={isOrganiser && m.role !== 'owner' && m.user_id !== userId}
                isRemoving={decidingId === m.id}
                onRemove={() => confirmRemoveMember(m.id, m.display_name)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ── Loading / Error ───────────────────────────────────
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    errorText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    errorBack: {
      paddingVertical: 10,
      paddingHorizontal: 24,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    errorBackText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },

    // ── Tabs ─────────────────────────────────────────
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 0,
      gap: 4,
    },
    tabItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingBottom: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      position: 'relative',
    },
    tabItemActive: {
      borderBottomColor: colors.primary,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    tabCount: {
      backgroundColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 1,
      minWidth: 20,
      alignItems: 'center',
    },
    tabCountActive: {
      backgroundColor: colors.primaryLight,
    },
    tabCountText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    tabCountTextActive: {
      color: colors.primary,
    },
    tabPendingDot: {
      position: 'absolute',
      top: 2,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.error,
    },

    // ── Content ──────────────────────────────────────
    content: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentInner: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 48,
    },
    summaryStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      marginBottom: 4,
    },
    summaryText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontWeight: '700',
      color: colors.primary,
    },

    // ── Pending requests ─────────────────────────────
    pendingSectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 8,
    },

    // ── Empty tab ────────────────────────────────────
    emptyTab: {
      alignItems: 'center',
      paddingVertical: 48,
    },
    emptyTabEmoji: {
      fontSize: 40,
      marginBottom: 12,
    },
    emptyTabText: {
      fontSize: 14,
      color: colors.textMuted,
    },
  })
}
