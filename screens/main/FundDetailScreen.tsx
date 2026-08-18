import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Share, Alert } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'
import { fundPreviewUrl } from '../../lib/fundLinks'
import { api } from '../../lib/api'
import { runApiRead, toApiUiError } from '../../lib/apiScreen'
import { formatFundMemberCount, fundMemberCount } from '../../lib/fundMembers'
import { useFundPermissions } from '../../lib/useFundPermissions'
import {
  Contribution,
  Expense,
  FundDetail,
  Member,
  MemberRole,
  PendingRequest,
  SponsorshipItem,
  Tab,
  formatMoney,
} from './fundDetail/types'
import { ContributionRow, ExpenseRow, MemberRow, PendingRequestRow } from './fundDetail/rows'
import FundHeader, { FUND_HEADER_PURPLE } from './fundDetail/FundHeader'
import EditExpenseModal from './fundDetail/EditExpenseModal'
import EditContributionModal from './fundDetail/EditContributionModal'
import ActivityLogModal from './fundDetail/ActivityLogModal'
import FundSettingsModal from './fundDetail/FundSettingsModal'
import SponsorshipBoard from './fundDetail/SponsorshipBoard'
import FundActionMenu from './fundDetail/FundActionMenu'
import AdminPermissionEditorModal from './fundDetail/AdminPermissionEditorModal'
import { calculateFundFinancialSummary, isFundReadOnly, isVisibleInFundMoneyView, prioritiseRichAunties } from './fundDetail/finance'
import LoadingOverlay from '../../components/LoadingOverlay'
import InviteDetailsModal from '../../components/InviteDetailsModal'
import { FUND_PERMISSION_KEYS, type FundPermission } from '../../lib/fundPermissions'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'FundDetail'>
  route: RouteProp<MainStackParamList, 'FundDetail'>
  embedded?: boolean
  embeddedExpanded?: boolean
  onToggleEmbeddedExpanded?: () => void
}

export default function FundDetailScreen({
  navigation,
  route,
  embedded = false,
  embeddedExpanded = false,
  onToggleEmbeddedExpanded,
}: Props) {
  const { fundId } = route.params
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const styles = makeStyles(colors)

  const [activeTab, setActiveTab]     = useState<Tab>(route.params.tab ?? 'contributions')
  const [fund, setFund]               = useState<FundDetail | null>(null)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [expenses, setExpenses]       = useState<Expense[]>([])
  const [members, setMembers]         = useState<Member[]>([])
  const [richAuntieUserIds, setRichAuntieUserIds] = useState<Set<string>>(new Set())
  const [sponsorshipItems, setSponsorshipItems] = useState<SponsorshipItem[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [isLoading, setIsLoading]     = useState(true)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [isDeleting, setIsDeleting]   = useState(false)
  const [decidingId, setDecidingId]   = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingContribution, setEditingContribution] = useState<Contribution | null>(null)
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [showFundSettings, setShowFundSettings] = useState(false)
  const [showFundInvite, setShowFundInvite] = useState(false)
  const [permissionMember, setPermissionMember] = useState<Member | null>(null)
  const [memberPermissionRows, setMemberPermissionRows] = useState<Record<string, FundPermission[]>>({})
  const [isLoadingMemberPermissions, setIsLoadingMemberPermissions] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const { can, isLoading: permissionsLoading } = useFundPermissions(fundId)
  const canRecordContributions = can('record_contributions')
  const canEditContributions = can('edit_contributions')
  const canRecordExpenses = can('record_expenses')
  const canEditExpenses = can('edit_expenses')
  const canManageMembers = can('manage_members')
  const canManageSponsorships = can('manage_sponsorships')
  const canAwardRecognition = can('award_recognition')

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController()

      async function loadData() {
        if (!userId) return
        setIsLoading(true)
        setLoadError(null)
        try {
          const workspace = await runApiRead(call => api.funds.workspace(fundId, call), { signal: controller.signal })
          if (controller.signal.aborted) return
          setFund({ id: workspace.fund.id, owner_id: workspace.fund.owner_id, title: workspace.fund.title,
            status: workspace.fund.status, currency_code: workspace.fund.currency_code,
            goal_amount: Number(workspace.fund.goal_amount ?? 0), total_contributions: Number(workspace.fund.totals.raised),
            total_expenses: Number(workspace.fund.totals.spent), balance: Number(workspace.fund.totals.balance),
            member_count: workspace.fund.totals.member_count, fund_code: workspace.fund.fund_code,
            linked_event_id: workspace.fund.linked_event_id, contribution_deadline: workspace.fund.contribution_deadline,
            is_private: workspace.fund.is_private })
          setContributions(workspace.contributions.map(item => ({ ...item, amount: Number(item.amount), pledged_amount: item.pledged_amount === null ? null : Number(item.pledged_amount), allocated_amount: Number(item.allocated_amount), outstanding_amount: item.outstanding_amount === null ? null : Number(item.outstanding_amount) })))
          setExpenses(workspace.expenses.map(item => ({ ...item, amount: Number(item.amount) })))
          setSponsorshipItems(workspace.sponsorship_items.filter(item => item.status !== 'cancelled').map(item => ({ ...item, target_amount: Number(item.target_amount), allocated_amount: Number(item.allocated_amount), outstanding_amount: Number(item.outstanding_amount) })))
          setMembers(workspace.members.filter(item => item.status === 'joined').map(item => ({ id: item.id, user_id: item.user_id, display_name: item.display_name, phone: item.phone ?? '', role: item.role as MemberRole, joined_at: item.joined_at ?? item.requested_at ?? '' })))
          setPendingRequests(workspace.members.filter(item => item.status === 'pending').map(item => ({ id: item.id, user_id: item.user_id, display_name: item.display_name, phone: item.phone ?? '', requested_at: item.requested_at ?? item.joined_at ?? '' })))
          setRichAuntieUserIds(new Set(workspace.members.filter(item => item.is_rich_auntie && item.user_id).map(item => item.user_id!)))
        } catch (error) {
          if (!controller.signal.aborted) setLoadError(toApiUiError(error, controller.signal).message)
        } finally {
          if (!controller.signal.aborted) setIsLoading(false)
        }
      }

      loadData()
      return () => controller.abort()
    }, [fundId, userId])
  )

  async function handleApprove(memberId: string) {
    if (!canManageMembers || decidingId || !requireActiveFund()) return
    setDecidingId(memberId)
    try {
      await api.funds.updateMember(fundId, memberId, { status: 'joined' })
    } catch (error) {
      setDecidingId(null)
      Alert.alert('Could not approve request', toApiUiError(error).message)
      return
    }
    setDecidingId(null)

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
    if (!canManageMembers || !requireActiveFund()) return
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
    if (!canManageMembers || decidingId || !requireActiveFund()) return
    setDecidingId(memberId)
    try {
      await api.funds.updateMember(fundId, memberId, { status: 'declined' })
    } catch (error) {
      setDecidingId(null)
      Alert.alert('Could not reject request', toApiUiError(error).message)
      return
    }
    setDecidingId(null)

    setPendingRequests(prev => prev.filter(r => r.id !== memberId))
  }

  function confirmRemoveMember(memberId: string, displayName: string) {
    if (!canManageMembers || !requireActiveFund()) return
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
    if (!canManageMembers || decidingId || !requireActiveFund()) return
    setDecidingId(memberId)
    try {
      await api.funds.updateMember(fundId, memberId, { status: 'removed' })
    } catch (error) {
      setDecidingId(null)
      Alert.alert('Could not remove member', toApiUiError(error).message)
      return
    }
    setDecidingId(null)

    setMembers(prev => prev.filter(m => m.id !== memberId))
    setFund(prev => prev ? { ...prev, member_count: fundMemberCount(prev.member_count - 1) } : prev)
  }

  function openMemberDetails(member: Member) {
    if (!fund || !member.user_id) return
    navigation.navigate('MemberDetails', {
      fundId: fund.id,
      fundTitle: fund.title,
      currencyCode: fund.currency_code,
      memberId: member.id,
      memberUserId: member.user_id,
      memberName: member.display_name,
      memberPhone: member.phone,
      canAward: canAwardRecognition && !isFundReadOnly(fund.status) && member.user_id !== userId,
    })
  }

  async function openMemberPermissionEditor(member: Member) {
    if (!fund || fund.owner_id !== userId || member.role === 'owner' || !member.user_id || isFundReadOnly(fund.status)) return
    setPermissionMember(member)
    setIsLoadingMemberPermissions(true)
    let data
    try {
      data = await runApiRead(call => api.funds.listAdminPermissions(fund.id, call))
    } catch (error) {
      setIsLoadingMemberPermissions(false)
      setPermissionMember(null)
      Alert.alert('Could not load admin permissions', toApiUiError(error).message)
      return
    }
    setIsLoadingMemberPermissions(false)

    const next: Record<string, FundPermission[]> = {}
    for (const row of data ?? []) {
      if (!row.member_id || !row.permission_key || !FUND_PERMISSION_KEYS.includes(row.permission_key as FundPermission)) continue
      const permissions = next[row.member_id] ?? []
      permissions.push(row.permission_key as FundPermission)
      next[row.member_id] = permissions
    }
    setMemberPermissionRows(next)
  }

  function showMemberActions(member: Member) {
    if (!fund) return
    const hasAdminRelationship = member.role !== 'member' && member.role !== 'owner'
    const relationshipLabel = member.role === 'owner'
      ? 'Fund organiser'
      : hasAdminRelationship
        ? 'Fund admin'
        : 'Fund member'
    const canConfigureAdmin = fund.owner_id === userId
      && member.role !== 'owner'
      && Boolean(member.user_id)
      && !isFundReadOnly(fund.status)
    const canRemoveMember = canManageMembers
      && member.role !== 'owner'
      && member.user_id !== userId
      && !isFundReadOnly(fund.status)
    const options: any[] = []
    if (canConfigureAdmin) {
      options.push({
        text: hasAdminRelationship ? 'Manage admin permissions' : 'Make admin',
        onPress: () => { void openMemberPermissionEditor(member) },
      })
    }
    if (member.user_id) options.push({ text: 'View member details', onPress: () => openMemberDetails(member) })
    if (canRemoveMember) {
      options.push({
        text: 'Remove member',
        style: 'destructive',
        onPress: () => confirmRemoveMember(member.id, member.display_name),
      })
    }
    options.push({ text: 'Cancel', style: 'cancel' })
    Alert.alert(member.display_name, relationshipLabel, options)
  }

  function handleMemberPermissionsSaved(memberId: string, permissions: FundPermission[]) {
    setMemberPermissionRows(previous => ({ ...previous, [memberId]: permissions }))
    setMembers(previous => previous.map(member => member.id === memberId ? { ...member, role: 'admin' } : member))
    setPermissionMember(null)
  }

  function handleMemberAdminRemoved(memberId: string) {
    setMemberPermissionRows(previous => {
      const next = { ...previous }
      delete next[memberId]
      return next
    })
    setMembers(previous => previous.map(member => member.id === memberId ? { ...member, role: 'member' } : member))
    setPermissionMember(null)
  }

  async function handleShareInvite() {
    if (!canManageMembers || !fund?.fund_code) return
    const link = fundPreviewUrl(fund.fund_code)
    await Share.share({
      message: `Join *${fund.title}* on Tshelo 🙏\n\n${link}`,
      url: link,
    })
  }

  function handleMoreOptions() {
    if (!fund) return
    if (fund.owner_id === userId) {
      Alert.alert(fund.title, 'What would you like to do?', [
        { text: 'Fund settings', onPress: () => setShowFundSettings(true) },
        { text: 'Delete fund', style: 'destructive', onPress: confirmDelete },
        { text: 'Cancel', style: 'cancel' },
      ])
      return
    }

    Alert.alert(fund.title, 'What would you like to do?', [
      { text: isLeaving ? 'Leaving fund…' : 'Leave fund', style: 'destructive', onPress: confirmLeaveFund },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  function confirmLeaveFund() {
    if (!fund || isLeaving || fund.owner_id === userId) return
    const linkedEventNote = fund.linked_event_id
      ? '\n\nThis will not remove you from the linked event.'
      : ''
    Alert.alert(
      'Leave Fund?',
      `You will lose access to this fund. Your previous contributions remain in its records.${linkedEventNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Fund', style: 'destructive', onPress: leaveFund },
      ],
    )
  }

  async function leaveFund() {
    if (!fund || isLeaving || fund.owner_id === userId) return
    setIsLeaving(true)
    try {
      await api.funds.leave(fund.id)
    } catch (error) {
      setIsLeaving(false)
      Alert.alert('Could not leave fund', toApiUiError(error).message)
      return
    }
    setIsLeaving(false)

    navigation.reset({ index: 0, routes: [{ name: 'Tabs' as any }] })
  }

  function requireActiveFund() {
    if (fund && !isFundReadOnly(fund.status)) return true
    Alert.alert('Fund is closed', 'Closed funds are read-only. You can still view their records and history.')
    return false
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
    try {
      await api.funds.remove(fund.id)
    } catch (error) {
      setIsDeleting(false)
      Alert.alert('Could not delete fund', toApiUiError(error).message)
      return
    }
    setIsDeleting(false)

    navigation.reset({
      index: 0,
      routes: [{ name: 'Tabs' as any }],
    })
  }

  function handleExpenseSaved(updated: Expense) {
    setEditingExpense(null)
    const next = expenses.map(e => (e.id === updated.id ? updated : e))
    setExpenses(next)
    const totalExpenses = next
      .filter(expense => !expense.is_sponsored)
      .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0)
    setFund(prev => prev ? {
      ...prev,
      total_expenses: totalExpenses,
      balance: prev.total_contributions - totalExpenses,
    } : prev)
  }

  function handleContributionSaved(updated: Contribution) {
    setEditingContribution(null)
    const next = contributions.map(item => item.id === updated.id ? updated : item)
    setContributions(next)
    const total = next
      .filter(item => item.status === 'confirmed' && !item.is_refunded)
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
    setFund(previous => previous ? {
      ...previous,
      total_contributions: total,
      balance: total - previous.total_expenses,
    } : previous)
  }

  const visibleContributions = contributions.filter(isVisibleInFundMoneyView)
  const displayedMembers = prioritiseRichAunties(members, richAuntieUserIds)
  const financialSummary = calculateFundFinancialSummary({
    goalAmount: fund?.goal_amount ?? 0,
    totalIn: fund?.total_contributions ?? 0,
    totalOut: fund?.total_expenses ?? 0,
  })
  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'contributions', label: 'Money',         count: visibleContributions.length },
    { id: 'sponsorships',  label: 'Sponsor',       count: sponsorshipItems.length },
    { id: 'expenses',      label: 'Expenses',      count: expenses.length },
    { id: 'members',       label: 'Members',       count: fundMemberCount(members.length) },
  ]

  useEffect(() => {
    if (embedded || !fund?.linked_event_id) return
    navigation.replace('EventDetail', {
      eventId: fund.linked_event_id,
      workspace: 'fund',
      fundTab: route.params.tab ?? 'contributions',
    })
  }, [embedded, fund?.linked_event_id, navigation, route.params.tab])

  // ── Loading (first load only — refreshes overlay the stale page) ──
  if (isLoading && !fund) {
    return (
      <SafeAreaView style={[styles.safe, embedded && styles.embeddedSafe]} edges={embedded ? [] : undefined}>
        {!embedded && <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />}
        <LoadingOverlay />
      </SafeAreaView>
    )
  }

  // ── Error ──────────────────────────────────────────────
  if (loadError || !fund) {
    return (
      <SafeAreaView style={[styles.safe, embedded && styles.embeddedSafe]} edges={embedded ? [] : undefined}>
        {!embedded && <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />}
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{loadError ?? 'Fund not found.'}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBack}>
            <Text style={styles.errorBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (!embedded && fund.linked_event_id) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <LoadingOverlay />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView
      style={[styles.safe, embedded && styles.embeddedSafe]}
      edges={embedded ? [] : ['top', 'left', 'right']}
    >
      {!embedded && <StatusBar barStyle="dark-content" backgroundColor={FUND_HEADER_PURPLE} />}

      {embedded ? (
        <View style={[styles.embeddedFundHeader, embeddedExpanded && styles.embeddedFundHeaderExpanded]}>
          {embeddedExpanded ? (
            <Text style={styles.embeddedExpandedTitle} numberOfLines={2}>{fund.title}</Text>
          ) : null}
          <View style={[styles.embeddedFundControlsRow, embeddedExpanded && styles.embeddedFundControlsRowExpanded]}>
            <View style={styles.embeddedFundHeading}>
              {canManageMembers && !isFundReadOnly(fund.status) && fund.fund_code ? (
                <TouchableOpacity
                  style={styles.embeddedInviteLink}
                  onPress={() => setShowFundInvite(true)}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="Open fund invite details"
                >
                  <Ionicons name="copy-outline" size={17} color={colors.primary} />
                  <Text style={styles.embeddedFundEyebrow}>Copy Fund Invite</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.embeddedHeaderActions}>
              {onToggleEmbeddedExpanded ? (
                <TouchableOpacity
                  style={styles.embeddedHeaderButton}
                  onPress={onToggleEmbeddedExpanded}
                  accessibilityLabel={embeddedExpanded ? 'Restore Event and Fund overview' : 'Expand fund workspace'}
                >
                  <Ionicons name={embeddedExpanded ? 'contract-outline' : 'expand-outline'} size={18} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.embeddedHeaderButton} onPress={() => setShowActivityLog(true)} accessibilityLabel="Fund history">
                <Ionicons name="time-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.embeddedHeaderButton} onPress={handleMoreOptions} accessibilityLabel="Fund options">
                <Ionicons name="ellipsis-horizontal" size={19} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <FundHeader
          fund={fund}
          isOwner={fund.owner_id === userId && !isFundReadOnly(fund.status)}
          isDeleting={isDeleting}
          remainingToTarget={financialSummary.remainingToTarget}
          amountOverTarget={financialSummary.amountOverTarget}
          onBack={() => navigation.goBack()}
          onViewHistory={() => setShowActivityLog(true)}
          onMoreOptions={handleMoreOptions}
        />
      )}

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
            {tab.id === 'members' && canManageMembers && !isFundReadOnly(fund.status) && pendingRequests.length > 0 && (
              <View style={styles.tabPendingDot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab content ────────────────────────────── */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>

        {activeTab === 'contributions' && (
          <>
            {visibleContributions.length === 0 ? (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabEmoji}>💰</Text>
                <Text style={styles.emptyTabText}>No contributions recorded yet.</Text>
              </View>
            ) : (
              visibleContributions.map(c => (
                <ContributionRow
                  key={c.id}
                  item={c}
                  currencyCode={fund.currency_code}
                  onPress={canEditContributions && !isFundReadOnly(fund.status) ? () => setEditingContribution(c) : undefined}
                />
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
              {expenses.some(expense => expense.is_sponsored) && (
                <Text style={styles.summaryText}>
                  {expenses.filter(expense => expense.is_sponsored).length} sponsored
                </Text>
              )}
            </View>
            {expenses.length === 0 ? (
              <View style={styles.emptyTab}>
                <Ionicons name="receipt-outline" size={28} color={colors.textMuted} style={styles.emptyTabIcon} />
                <Text style={styles.emptyTabText}>No expenses recorded yet.</Text>
              </View>
            ) : (
              expenses.map(e => (
                <ExpenseRow
                  key={e.id}
                  item={e}
                  currencyCode={fund.currency_code}
                  onPress={canEditExpenses && !isFundReadOnly(fund.status) ? () => setEditingExpense(e) : undefined}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'sponsorships' && (
          <SponsorshipBoard
            fundId={fund.id}
            currencyCode={fund.currency_code}
            goalAmount={fund.goal_amount}
            canManageSponsorships={canManageSponsorships}
            canRecordContributions={canRecordContributions}
            canRecordExpenses={canRecordExpenses}
            isFundActive={fund.status === 'active'}
            items={sponsorshipItems}
            onItemsChange={setSponsorshipItems}
            onRecordPayment={item => navigation.navigate('RecordContribution', {
              fundId: fund.id,
              fundTitle: fund.title,
              currencyCode: fund.currency_code,
              initialMode: 'received',
              sponsorshipItemId: item.id,
              sponsorUserId: item.claimed_by_user_id ?? undefined,
            })}
            onRecordPurchase={(item, direct) => navigation.navigate('RecordExpense', {
              fundId: fund.id,
              fundTitle: fund.title,
              currencyCode: fund.currency_code,
              sponsorshipItemId: item.id,
              sponsorshipItemTitle: item.title,
              sponsorshipTargetAmount: item.target_amount,
              sponsorUserId: direct ? item.claimed_by_user_id ?? undefined : undefined,
            })}
          />
        )}

        {activeTab === 'members' && (
          <>
            {canManageMembers && !isFundReadOnly(fund.status) && pendingRequests.length > 0 && (
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
                {formatFundMemberCount(members.length)}
              </Text>
            </View>
            {displayedMembers.map(m => (
              <MemberRow
                key={m.id}
                item={m}
                isRichAuntie={Boolean(m.user_id && richAuntieUserIds.has(m.user_id))}
                canRemove={canManageMembers && !isFundReadOnly(fund.status) && m.role !== 'owner' && m.user_id !== userId}
                isRemoving={decidingId === m.id}
                onRemove={() => confirmRemoveMember(m.id, m.display_name)}
                onPress={() => showMemberActions(m)}
                onOptions={m.role !== 'owner' && (canManageMembers || fund.owner_id === userId) ? () => showMemberActions(m) : undefined}
              />
            ))}
          </>
        )}
      </ScrollView>

      {fund.status === 'active' && (
        <FundActionMenu
          canRecordContributions={canRecordContributions}
          canRecordExpenses={canRecordExpenses}
          canManageMembers={canManageMembers}
          onRecordContribution={() => navigation.navigate('RecordContribution', {
            fundId: fund.id,
            fundTitle: fund.title,
            currencyCode: fund.currency_code,
            initialMode: 'received',
          })}
          onMakePledge={() => navigation.navigate('RecordContribution', {
            fundId: fund.id,
            fundTitle: fund.title,
            currencyCode: fund.currency_code,
            initialMode: 'pledge',
          })}
          onRecordExpense={() => navigation.navigate('RecordExpense', {
            fundId: fund.id,
            fundTitle: fund.title,
            currencyCode: fund.currency_code,
          })}
          onInviteMembers={() => { void handleShareInvite() }}
        />
      )}

      <EditExpenseModal
        expense={editingExpense}
        currencySymbol={fund.currency_code === 'BWP' ? 'P' : fund.currency_code}
        onClose={() => setEditingExpense(null)}
        onSaved={handleExpenseSaved}
      />

      <EditContributionModal
        contribution={editingContribution}
        currencySymbol={fund.currency_code === 'BWP' ? 'P' : fund.currency_code}
        canRefund={fund.owner_id === userId}
        onClose={() => setEditingContribution(null)}
        onSaved={handleContributionSaved}
      />

      <ActivityLogModal
        visible={showActivityLog}
        fundId={fund.id}
        currencyCode={fund.currency_code}
        memberNames={new Map(members.filter(m => m.user_id).map(m => [m.user_id as string, m.display_name]))}
        onClose={() => setShowActivityLog(false)}
      />

      <FundSettingsModal
        visible={showFundSettings}
        fund={fund}
        members={members}
        onClose={() => setShowFundSettings(false)}
        onFundSaved={changes => setFund(previous => previous ? { ...previous, ...changes } : previous)}
        onMemberRoleChanged={(memberId, role) => setMembers(previous => previous.map(member => member.id === memberId ? { ...member, role } : member))}
        onClosed={() => {
          setShowFundSettings(false)
          setFund(previous => previous ? { ...previous, status: 'closed' } : previous)
        }}
      />

      <InviteDetailsModal
        visible={showFundInvite}
        inviteType="Fund"
        title={fund.title}
        inviteValue={fund.fund_code}
        helpText="This invite joins the contribution fund only. It does not invite someone to the event or give them fund-management permissions."
        shareMessage={`Join *${fund.title}* on Tshelo 🙏\n\n${fundPreviewUrl(fund.fund_code)}`}
        onClose={() => setShowFundInvite(false)}
      />

      <AdminPermissionEditorModal
        fundId={fundId}
        visible={Boolean(permissionMember)}
        member={permissionMember}
        initialPermissions={permissionMember ? memberPermissionRows[permissionMember.id] ?? [] : []}
        isLoading={isLoadingMemberPermissions}
        onClose={() => setPermissionMember(null)}
        onSaved={handleMemberPermissionsSaved}
        onRemoved={handleMemberAdminRemoved}
      />

      {(isLoading || permissionsLoading) && <LoadingOverlay />}
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: FUND_HEADER_PURPLE,
    },
    embeddedSafe: {
      backgroundColor: '#FFFFFF',
    },
    embeddedFundHeader: {
      minHeight: 76,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    embeddedFundHeaderExpanded: { minHeight: 112, justifyContent: 'flex-start', paddingTop: 14 },
    embeddedFundControlsRow: { width: '100%', flexDirection: 'row', alignItems: 'center' },
    embeddedFundControlsRowExpanded: { marginTop: 6 },
    embeddedFundHeading: { flex: 1, minWidth: 0 },
    embeddedExpandedTitle: {
      paddingRight: 8,
      fontSize: 20,
      lineHeight: 25,
      fontFamily: fonts.inter.extraBold,
      color: colors.textPrimary,
    },
    embeddedFundEyebrow: {
      fontSize: 12,
      fontFamily: fonts.inter.extraBold,
      letterSpacing: 0.1,
      color: colors.primary,
    },
    embeddedInviteLink: { alignSelf: 'flex-start', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7 },
    embeddedHeaderActions: { flexDirection: 'row', gap: 7, marginLeft: 10 },
    embeddedHeaderButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.border,
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
      fontFamily: fonts.inter.regular,
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
      fontFamily: fonts.inter.semiBold,
      color: colors.primary,
    },

    // ── Tabs ─────────────────────────────────────────
    tabBar: {
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 0,
      borderBottomWidth: 1,
      borderBottomColor: '#D4D4D8',
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 9,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      position: 'relative',
    },
    tabItemActive: {
      borderBottomColor: colors.primary,
    },
    tabLabel: {
      fontSize: 12,
      fontFamily: fonts.inter.bold,
      color: '#A1A1AA',
    },
    tabLabelActive: {
      color: colors.primary,
      fontFamily: fonts.inter.bold,
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
      backgroundColor: '#FFFFFF',
    },
    contentInner: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 104,
    },
    summaryStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      marginBottom: 4,
    },
    summaryText: {
      fontSize: 13,
      fontFamily: fonts.inter.regular,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontFamily: fonts.inter.bold,
      color: colors.primary,
    },
    summaryRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    historyLink: {
      fontSize: 13,
      fontFamily: fonts.inter.bold,
      color: colors.primary,
    },

    // ── Pending requests ─────────────────────────────
    pendingSectionTitle: {
      fontSize: 12,
      fontFamily: fonts.inter.bold,
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
    emptyTabIcon: {
      marginBottom: 12,
    },
    emptyTabText: {
      fontSize: 14,
      fontFamily: fonts.inter.regular,
      color: colors.textMuted,
    },
  })
}
