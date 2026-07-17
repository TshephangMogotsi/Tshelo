import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Share, Modal, Linking, Alert, Clipboard } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { supabase } from '../../lib/supabase'
import { fundPreviewUrl } from '../../lib/supabase'
import LoadingOverlay from '../../components/LoadingOverlay'
import { ContributionRow, ExpenseRow, MemberRow } from './fundDetail/rows'
import { Contribution, Expense, FundDetail, Member, Tab, formatMoney } from './fundDetail/types'
import ActivityLogModal from './fundDetail/ActivityLogModal'
import FundSettingsModal from './fundDetail/FundSettingsModal'
import { useAuth } from '../../context/AuthContext'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'EventDetail'>
  route: RouteProp<MainStackParamList, 'EventDetail'>
}

type EventView = {
  title: string
  emoji: string
  date: string
  venue: string
  confirmed: number
  pending: number
  declined: number
  rsvpLink: string
  hasBudget: boolean
  linkedFundId: string | null
}

type EmbeddedFund = {
  id: string
  ownerId: string
  title: string
  status: string
  currency: string
  goal: number
  contributions: number
  expenses: number
  code: string
  deadline: string | null
  isPrivate: boolean
}

function displayEventDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString('en-BW', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function EventDetailScreen({ navigation, route }: Props) {
  const { eventId } = route.params
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const styles = makeStyles(colors)
  const [event, setEvent] = useState<EventView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [fund, setFund] = useState<EmbeddedFund | null>(null)
  const [fundTab, setFundTab] = useState<Tab>('contributions')
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [showFundHistory, setShowFundHistory] = useState(false)
  const [showFundSettings, setShowFundSettings] = useState(false)

  useFocusEffect(useCallback(() => {
    let active = true

    async function loadEvent() {
      setIsLoading(true)
      const [eventResult, guestsResult, budgetResult] = await Promise.all([
        supabase
          .from('events')
          .select('name, event_emoji, event_date, venue_name, share_code, linked_fund_id')
          .eq('id', eventId)
          .single(),
        supabase.from('event_guests').select('rsvp_status').eq('event_id', eventId),
        supabase.from('event_budgets').select('id').eq('event_id', eventId).maybeSingle(),
      ])

      if (!active) return
      if (eventResult.error || !eventResult.data) {
        setIsLoading(false)
        Alert.alert('Could not load event', eventResult.error?.message ?? 'The event is unavailable.', [
          { text: 'Go back', onPress: () => navigation.goBack() },
        ])
        return
      }

      const row = eventResult.data
      const guests = guestsResult.data ?? []
      const count = (status: string) => guests.filter(guest => guest.rsvp_status === status).length
      setEvent({
        title: row.name,
        emoji: row.event_emoji ?? '🎉',
        date: displayEventDate(row.event_date),
        venue: row.venue_name?.trim() || 'Venue to be confirmed',
        confirmed: count('confirmed'),
        pending: count('pending'),
        declined: count('declined'),
        rsvpLink: row.share_code ? `RSVP code: ${row.share_code}` : 'RSVP link unavailable',
        hasBudget: Boolean(budgetResult.data),
        linkedFundId: row.linked_fund_id ?? null,
      })

      if (row.linked_fund_id) {
        const [fundResult, contributionResult, expenseResult, memberResult, profileResult] = await Promise.all([
          supabase.from('funds').select('id, owner_id, title, status, currency_code, goal_amount, fund_code, contribution_deadline, is_private').eq('id', row.linked_fund_id).single(),
          supabase.from('contributions').select('id, contributor_name, amount, payment_method, reference_number, detected_via, status, is_refunded, confirmed_at, notes').eq('fund_id', row.linked_fund_id).order('confirmed_at', { ascending: false }),
          supabase.from('expenses').select('id, vendor_name, description, category, amount, created_at, has_open_query').eq('fund_id', row.linked_fund_id).is('deleted_at', null).order('created_at', { ascending: false }),
          supabase.from('fund_members').select('id, user_id, role, joined_at').eq('fund_id', row.linked_fund_id).eq('status', 'joined').order('joined_at', { ascending: true }),
          supabase.rpc('get_fund_member_profiles', { p_fund_id: row.linked_fund_id }),
        ])
        if (!active) return
        const fundRow = fundResult.data
        const contributionRows = (contributionResult.data ?? []) as Contribution[]
        const expenseRows = (expenseResult.data ?? []) as Expense[]
        const profiles = new Map<string, { name: string; phone: string }>((profileResult.data ?? []).map((profile: any) => [profile.member_row_id, { name: profile.name, phone: profile.phone }]))
        if (fundRow) {
          setFund({
            id: fundRow.id,
            ownerId: fundRow.owner_id,
            title: fundRow.title,
            status: fundRow.status,
            currency: fundRow.currency_code,
            goal: Number(fundRow.goal_amount ?? 0),
            contributions: contributionRows.filter(item => item.status === 'confirmed' && !item.is_refunded).reduce((sum, item) => sum + Number(item.amount), 0),
            expenses: expenseRows.reduce((sum, item) => sum + Number(item.amount), 0),
            code: fundRow.fund_code,
            deadline: fundRow.contribution_deadline ?? null,
            isPrivate: fundRow.is_private ?? false,
          })
        }
        setContributions(contributionRows)
        setExpenses(expenseRows)
        setMembers((memberResult.data ?? []).map((member: any) => ({
          id: member.id,
          user_id: member.user_id,
          display_name: profiles.get(member.id)?.name ?? 'Member',
          phone: profiles.get(member.id)?.phone ?? '',
          role: member.role,
          joined_at: member.joined_at,
        })))
      } else {
        setFund(null)
        setContributions([])
        setExpenses([])
        setMembers([])
      }
      setIsLoading(false)
    }

    loadEvent()
    return () => { active = false }
  }, [eventId, navigation]))

  const shareMessage = event ? `You're invited to ${event.title}. ${event.rsvpLink}` : ''

  async function handleWhatsAppShare() {
    if (!event) return
    const url = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      Linking.openURL(url)
      setShowShareModal(false)
    } else {
      Alert.alert('WhatsApp not found', 'Please install WhatsApp to share via it.')
    }
  }

  function handleSmsShare() {
    if (!event) return
    Linking.openURL(`sms:?body=${encodeURIComponent(shareMessage)}`)
    setShowShareModal(false)
  }

  async function handleCopyShare() {
    if (!event) return
    await Share.share({ message: event.rsvpLink })
    setShowShareModal(false)
  }

  function copyFundCode() {
    if (!fund?.code) return
    Clipboard.setString(fund.code)
    Alert.alert('Copied', 'Fund invite code copied.')
  }

  async function shareFundInvite() {
    if (!fund?.code) return
    const link = fundPreviewUrl(fund.code)
    await Share.share({ message: `Join *${fund.title}* on Tshelo 🙏\n\n${link}`, url: link })
  }

  const fundDetail: FundDetail | null = fund ? {
    id: fund.id,
    owner_id: fund.ownerId,
    title: fund.title,
    status: fund.status,
    currency_code: fund.currency,
    goal_amount: fund.goal,
    total_contributions: fund.contributions,
    total_expenses: fund.expenses,
    balance: fund.contributions - fund.expenses,
    member_count: members.length,
    fund_code: fund.code,
    linked_event_id: eventId,
    contribution_deadline: fund.deadline,
    is_private: fund.isPrivate,
  } : null

  if (!event) return <View style={{ flex: 1 }}><LoadingOverlay /></View>

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topBarLabel}>Event overview</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => setShowShareModal(true)}>
          <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroSummary}>
            <View style={styles.emojiBadge}><Text style={styles.heroEmoji}>{event.emoji}</Text></View>
            <View style={styles.heroInfo}>
              <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={styles.eventMeta} numberOfLines={1}>{event.date}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text style={styles.eventMeta} numberOfLines={1}>{event.venue}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.inviteButton} onPress={() => setShowShareModal(true)} activeOpacity={0.86}>
            <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
            <Text style={styles.inviteButtonText}>Invite</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Manage</Text>
        <View style={styles.actionList}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('GuestList', { eventId })} activeOpacity={0.86}>
            <View style={styles.actionIcon}><Ionicons name="people-outline" size={23} color={colors.primary} /></View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Guests &amp; RSVPs</Text>
              <Text style={styles.actionHint}>{event.confirmed} confirmed · {event.pending} pending · {event.declined} declined</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('EventBudget', { eventId })} activeOpacity={0.86}>
            <View style={styles.actionIcon}><Ionicons name="receipt-outline" size={23} color={colors.primary} /></View>
            <View style={styles.actionCopy}><Text style={styles.actionTitle}>Budget</Text><Text style={styles.actionHint}>{event.hasBudget ? 'Track event spending' : 'Create your budget'}</Text></View>
            <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {fund && (
          <View style={styles.fundWorkspace}>
            <View style={styles.fundWorkspaceHeader}>
              <View style={styles.fundTitleRow}>
                <View style={styles.fundTitleCopy}>
                  <Text style={styles.fundWorkspaceEyebrow}>CONTRIBUTION FUND</Text>
                  <Text style={styles.fundWorkspaceTitle}>{fund.title}</Text>
                </View>
                <View style={styles.fundHeaderIcons}>
                  <TouchableOpacity style={styles.fundIconAction} onPress={() => setShowFundHistory(true)}><Ionicons name="time-outline" size={17} color={colors.textPrimary} /></TouchableOpacity>
                  {fund.ownerId === userId && <TouchableOpacity style={styles.fundIconAction} onPress={() => setShowFundSettings(true)}><Ionicons name="ellipsis-horizontal" size={18} color={colors.textPrimary} /></TouchableOpacity>}
                </View>
              </View>
              <View style={styles.fundRecordActions}>
                <TouchableOpacity style={styles.fundRecordButton} onPress={() => navigation.navigate('RecordContribution', { fundId: fund.id, fundTitle: fund.title, currencyCode: fund.currency })}>
                  <Ionicons name="add" size={17} color={colors.primary} /><Text style={styles.fundRecordText}>Money in</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fundRecordButton} onPress={() => navigation.navigate('RecordExpense', { fundId: fund.id, fundTitle: fund.title, currencyCode: fund.currency })}>
                  <Ionicons name="arrow-up" size={16} color={colors.primary} /><Text style={styles.fundRecordText}>Expense</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fundStats}>
              <View style={styles.fundStat}><Text style={styles.fundStatValue}>{formatMoney(fund.contributions - fund.expenses, fund.currency)}</Text><Text style={styles.fundStatLabel}>Balance</Text></View>
              <View style={styles.fundStatDivider} />
              <View style={styles.fundStat}><Text style={styles.fundStatValue}>{formatMoney(fund.goal, fund.currency)}</Text><Text style={styles.fundStatLabel}>Goal</Text></View>
              <View style={styles.fundStatDivider} />
              <View style={styles.fundStat}><Text style={styles.fundStatValue}>{members.length}</Text><Text style={styles.fundStatLabel}>Members</Text></View>
            </View>

            {fund.code ? (
              <View style={styles.inviteCodeRow}>
                <View style={styles.inviteCodeCopy}><Text style={styles.inviteCodeLabel}>INVITE CODE</Text><Text style={styles.inviteCodeValue}>{fund.code}</Text></View>
                <TouchableOpacity style={styles.inviteCodeButton} onPress={copyFundCode}><Ionicons name="copy-outline" size={16} color={colors.primary} /><Text style={styles.inviteCodeButtonText}>Copy</Text></TouchableOpacity>
                <TouchableOpacity style={styles.inviteCodeButton} onPress={shareFundInvite}><Ionicons name="share-outline" size={16} color={colors.primary} /><Text style={styles.inviteCodeButtonText}>Share</Text></TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.fundTabs}>
              {([['contributions', 'Contributions', contributions.length], ['expenses', 'Expenses', expenses.length], ['members', 'Members', members.length]] as const).map(([id, label, count]) => (
                <TouchableOpacity key={id} style={[styles.fundTab, fundTab === id && styles.fundTabActive]} onPress={() => setFundTab(id)}>
                  <Text style={[styles.fundTabText, fundTab === id && styles.fundTabTextActive]}>{label}</Text>
                  <View style={[styles.fundTabCount, fundTab === id && styles.fundTabCountActive]}><Text style={[styles.fundTabCountText, fundTab === id && styles.fundTabCountTextActive]}>{count}</Text></View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.fundList}>
              {fundTab === 'contributions' && (contributions.length ? contributions.map(item => <ContributionRow key={item.id} item={item} currencyCode={fund.currency} />) : <Text style={styles.fundEmpty}>No contributions yet.</Text>)}
              {fundTab === 'expenses' && (expenses.length ? expenses.map(item => <ExpenseRow key={item.id} item={item} currencyCode={fund.currency} />) : <Text style={styles.fundEmpty}>No expenses yet.</Text>)}
              {fundTab === 'members' && (members.length ? members.map(item => <MemberRow key={item.id} item={item} />) : <Text style={styles.fundEmpty}>No members yet.</Text>)}
            </View>
          </View>
        )}

      </ScrollView>

      {fund && <ActivityLogModal visible={showFundHistory} fundId={fund.id} currencyCode={fund.currency} memberNames={new Map(members.filter(member => member.user_id).map(member => [member.user_id as string, member.display_name]))} onClose={() => setShowFundHistory(false)} />}
      {fundDetail && <FundSettingsModal
        visible={showFundSettings}
        fund={fundDetail}
        members={members}
        onClose={() => setShowFundSettings(false)}
        onFundSaved={changes => setFund(previous => previous ? ({ ...previous, title: changes.title ?? previous.title, goal: changes.goal_amount ?? previous.goal, deadline: changes.contribution_deadline ?? previous.deadline, isPrivate: changes.is_private ?? previous.isPrivate }) : previous)}
        onMemberRoleChanged={(memberId, role) => setMembers(previous => previous.map(member => member.id === memberId ? { ...member, role } : member))}
        onClosed={() => { setShowFundSettings(false); setFund(previous => previous ? { ...previous, status: 'closed' } : previous) }}
      />}

      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.shareModalBackdrop}>
          <View style={styles.shareModalCard}>
            <Text style={styles.shareModalTitle}>Share RSVP{'\n'}Link</Text>

            <View style={styles.rsvpLinkBox}>
              <Text style={styles.rsvpLinkLabel}>RSVP Link</Text>
              <Text style={styles.rsvpLinkText}>{event.rsvpLink}</Text>
            </View>

            <Text style={styles.shareViaText}>Share via</Text>

            <View style={styles.shareOptionsRow}>
              <TouchableOpacity style={styles.shareOption} onPress={handleWhatsAppShare} activeOpacity={0.85}>
                <View style={[styles.shareOptionCircle, styles.whatsappCircle]}>
                  <Ionicons name="logo-whatsapp" size={34} color="#FFFFFF" />
                </View>
                <Text style={styles.shareOptionLabel}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareOption} onPress={handleSmsShare} activeOpacity={0.85}>
                <View style={[styles.shareOptionCircle, styles.smsCircle]}>
                  <Ionicons name="chatbubble-outline" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.shareOptionLabel}>SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareOption} onPress={handleCopyShare} activeOpacity={0.85}>
                <View style={[styles.shareOptionCircle, styles.copyCircle]}>
                  <Ionicons name="copy-outline" size={32} color={colors.textMuted} />
                </View>
                <Text style={styles.shareOptionLabel}>Copy</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelShareButton} onPress={() => setShowShareModal(false)} activeOpacity={0.85}>
              <Text style={styles.cancelShareText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 72,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 4,
    },
    topBarLabel: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
    iconButton: {
      width: 36, height: 36, borderRadius: 11,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    hero: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 20,
    },
    heroSummary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    emojiBadge: {
      width: 48, height: 48, borderRadius: 15,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    heroInfo: { flex: 1, minWidth: 0 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    heroActions: { alignSelf: 'stretch', flexDirection: 'row', gap: 8, marginTop: 14 },
    inviteButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      alignSelf: 'stretch',
      backgroundColor: colors.primary, borderRadius: 12,
      paddingHorizontal: 11, paddingVertical: 11, marginTop: 12,
    },
    inviteButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    fundButton: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
      backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary + '50',
      borderRadius: 14, paddingVertical: 11,
    },
    fundButtonText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
    fundWorkspace: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      overflow: 'hidden',
      marginTop: 4,
    },
    fundWorkspaceHeader: {
      paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    },
    fundTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    fundTitleCopy: { flex: 1 },
    fundWorkspaceEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.primary, marginBottom: 4 },
    fundWorkspaceTitle: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: colors.textPrimary },
    fundHeaderIcons: { flexDirection: 'row', gap: 7 },
    fundRecordActions: { flexDirection: 'row', gap: 8 },
    fundRecordButton: {
      flex: 1,
      flexDirection: 'row', alignItems: 'center', gap: 3,
      justifyContent: 'center',
      backgroundColor: colors.primaryLight, borderRadius: 12,
      paddingHorizontal: 10, paddingVertical: 10,
    },
    fundRecordText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    fundIconAction: {
      width: 36, height: 36, borderRadius: 11,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    },
    fundStats: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: 16, marginBottom: 14,
      backgroundColor: colors.background, borderRadius: 14, paddingVertical: 13,
    },
    fundStat: { flex: 1, alignItems: 'center' },
    fundStatDivider: { width: 1, height: 28, backgroundColor: colors.border },
    fundStatValue: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 3 },
    fundStatLabel: { fontSize: 11, color: colors.textMuted },
    inviteCodeRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      marginHorizontal: 16, marginBottom: 14,
    },
    inviteCodeCopy: { flex: 1 },
    inviteCodeLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.7, color: colors.textMuted, marginBottom: 2 },
    inviteCodeValue: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: colors.textPrimary },
    inviteCodeButton: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.primaryLight, borderRadius: 9,
      paddingHorizontal: 8, paddingVertical: 7,
    },
    inviteCodeButtonText: { fontSize: 10, fontWeight: '700', color: colors.primary },
    fundTabs: {
      flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
      paddingHorizontal: 10,
    },
    fundTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    fundTabActive: { borderBottomColor: colors.primary },
    fundTabText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
    fundTabTextActive: { color: colors.primary, fontWeight: '800' },
    fundTabCount: { minWidth: 18, alignItems: 'center', backgroundColor: colors.border, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 1 },
    fundTabCountActive: { backgroundColor: colors.primaryLight },
    fundTabCountText: { fontSize: 9, fontWeight: '700', color: colors.textMuted },
    fundTabCountTextActive: { color: colors.primary },
    fundList: { paddingHorizontal: 14, paddingBottom: 10 },
    fundEmpty: { fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingVertical: 30 },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 10 },
    sectionHint: { fontSize: 12, color: colors.textMuted, marginTop: -8 },
    sectionLink: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 2 },
    rsvpPanel: {
      flexDirection: 'row', backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, borderRadius: 18,
      paddingVertical: 11, marginBottom: 20,
    },
    rsvpItem: { flex: 1, alignItems: 'center', gap: 2 },
    rsvpItemBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },
    actionList: { gap: 8, marginBottom: 18 },
    actionCard: {
      minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, borderRadius: 14,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    actionIcon: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    actionCopy: { flex: 1 },
    actionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
    actionHint: { fontSize: 12, lineHeight: 16, color: colors.textMuted },
    fundBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: colors.primaryLight, borderRadius: 14,
      borderWidth: 1, borderColor: colors.primary + '40', padding: 12,
    },
    fundBannerIcon: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    },
    fundBannerCopy: { flex: 1 },
    fundEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: colors.primary, marginBottom: 4 },
    fundBannerTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 3 },
    fundBannerHint: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
    titleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    titleBarText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    titleBarSpacer: { width: 40 },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventSummaryCard: {
      backgroundColor: colors.surface,
      borderWidth: 0,
      borderRadius: 0,
      paddingHorizontal: 0,
      paddingVertical: 16,
      marginBottom: 4,
    },
    heroBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    heroEmoji: {
      width: 44,
      fontSize: 30,
      textAlign: 'center',
    },
    heroCopy: {
      flex: 1,
    },
    eventTitle: {
      fontSize: 17,
      lineHeight: 21,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    eventMeta: {
      flex: 1,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '500',
      color: colors.textMuted,
    },
    content: {
      paddingTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 0,
      marginBottom: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 14,
    },
    rsvpStat: {
      flex: 1,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 0,
    },
    confirmedStat: { backgroundColor: 'transparent' },
    pendingStat: { backgroundColor: 'transparent', borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
    declinedStat: { backgroundColor: 'transparent' },
    rsvpValue: {
      fontSize: 21,
      lineHeight: 26,
      fontWeight: '800',
    },
    rsvpLabel: {
      fontSize: 11,
      fontWeight: '600',
    },
    eventToolCard: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      marginBottom: 10,
    },
    budgetEmptyCard: {
      position: 'relative',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fundSwitchCard: {
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
    },
    fundSwitchHeader: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    toolIconFund: {
      width: 46,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#DCFCE7',
    },
    fundQuickRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
    fundQuickButton: {
      flex: 1,
      alignItems: 'center',
      borderRadius: 12,
      paddingVertical: 9,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: '#86EFAC',
    },
    fundQuickText: { fontSize: 10, fontWeight: '800', color: '#15803D' },
    tapHereBadge: {
      position: 'absolute',
      top: -15,
      right: 28,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 6,
      zIndex: 1,
    },
    tapHereText: {
      fontSize: 12,
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    toolIconBlue: {
      width: 46,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#DBEAFE',
    },
    toolIconPurple: {
      width: 46,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    toolBody: {
      flex: 1,
    },
    toolTitle: {
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    toolSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    budgetEmptyText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
      color: '#F59E0B',
    },
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.primary,
      borderRadius: 28,
      paddingHorizontal: 20,
      paddingVertical: 17,
      marginTop: 14,
    },
    shareButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    shareModalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.48)',
      paddingHorizontal: 28,
    },
    shareModalCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 36,
      backgroundColor: colors.surface,
      paddingHorizontal: 28,
      paddingTop: 42,
      paddingBottom: 28,
      alignItems: 'center',
    },
    shareModalTitle: {
      fontSize: 32,
      lineHeight: 40,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 24,
    },
    rsvpLinkBox: {
      width: '100%',
      backgroundColor: '#F4F4F6',
      borderRadius: 20,
      paddingHorizontal: 22,
      paddingVertical: 20,
      marginBottom: 34,
    },
    rsvpLinkLabel: {
      fontSize: 17,
      color: colors.textMuted,
      marginBottom: 10,
    },
    rsvpLinkText: {
      fontSize: 22,
      lineHeight: 30,
      color: colors.textPrimary,
    },
    shareViaText: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 24,
    },
    shareOptionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 34,
    },
    shareOption: {
      alignItems: 'center',
      width: 92,
    },
    shareOptionCircle: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    whatsappCircle: {
      backgroundColor: '#25D366',
    },
    smsCircle: {
      backgroundColor: '#29A9E8',
    },
    copyCircle: {
      backgroundColor: '#E5E7EB',
    },
    shareOptionLabel: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: 'center',
    },
    cancelShareButton: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 28,
      paddingVertical: 17,
    },
    cancelShareText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textMuted,
    },
  })
}
