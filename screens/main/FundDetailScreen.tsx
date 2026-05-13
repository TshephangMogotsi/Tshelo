import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  FlatList,
  Share,
  Alert,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'FundDetail'>
  route: RouteProp<MainStackParamList, 'FundDetail'>
}

type Tab = 'contributions' | 'expenses' | 'members'

type MobileMoneyProvider = 'orange_money' | 'myzaka' | 'smega'
type ContributionSource  = 'sms_detected' | 'manual'
type MemberRole          = 'organiser' | 'member'

type Contribution = {
  id: string
  contributor_name: string
  amount: number         // thebe
  source: ContributionSource
  provider: MobileMoneyProvider | null
  confirmed_at: string
  notes: string | null
  is_disputed: boolean
}

type Expense = {
  id: string
  vendor: string
  category: string | null
  amount: number         // thebe
  expense_date: string
  notes: string | null
  is_disputed: boolean
}

type Member = {
  id: string
  display_name: string
  phone: string
  role: MemberRole
  joined_at: string
}

// ── Mock data (replace with Supabase queries keyed on fundId) ──
const MOCK_FUND = {
  id: '1',
  title: "Kgosi's Funeral Fund",
  fund_type: 'funeral' as const,
  status: 'active' as const,
  goal_amount: 500000,
  total_contributions: 320000,
  total_expenses: 25000,
  balance: 295000,
  member_count: 12,
  organiser_id: 'current-user',   // matches mock "current user" → shows organiser controls
  invite_code: 'A3F9B1C2D4E56789',
}

const MOCK_CONTRIBUTIONS: Contribution[] = [
  { id: 'c1', contributor_name: 'Mpho Dube',    amount: 50000,  source: 'sms_detected', provider: 'orange_money', confirmed_at: '2026-05-10T09:14:00Z', notes: null,                  is_disputed: false },
  { id: 'c2', contributor_name: 'Tebogo Nkwe',  amount: 30000,  source: 'manual',       provider: 'myzaka',       confirmed_at: '2026-05-09T14:30:00Z', notes: 'Paid at the meeting', is_disputed: false },
  { id: 'c3', contributor_name: 'Lesedi Moagi', amount: 100000, source: 'sms_detected', provider: 'orange_money', confirmed_at: '2026-05-08T11:05:00Z', notes: null,                  is_disputed: true  },
  { id: 'c4', contributor_name: 'Amogelang S.', amount: 40000,  source: 'manual',       provider: 'smega',        confirmed_at: '2026-05-07T16:20:00Z', notes: null,                  is_disputed: false },
  { id: 'c5', contributor_name: 'Kagiso Pule',  amount: 100000, source: 'sms_detected', provider: 'myzaka',       confirmed_at: '2026-05-06T08:00:00Z', notes: null,                  is_disputed: false },
]

const MOCK_EXPENSES: Expense[] = [
  { id: 'e1', vendor: 'Mmoloki Funeral Home', category: 'Funeral Services', amount: 15000, expense_date: '2026-05-11', notes: 'Deposit payment',   is_disputed: false },
  { id: 'e2', vendor: 'Choppies Supermarket',  category: 'Catering',         amount: 10000, expense_date: '2026-05-10', notes: 'Food for the family', is_disputed: false },
]

const MOCK_MEMBERS: Member[] = [
  { id: 'm1', display_name: 'Kefilwe Moeti',   phone: '+267 71 234 567', role: 'organiser', joined_at: '2026-05-05T08:00:00Z' },
  { id: 'm2', display_name: 'Mpho Dube',       phone: '+267 72 111 222', role: 'member',    joined_at: '2026-05-05T09:00:00Z' },
  { id: 'm3', display_name: 'Tebogo Nkwe',     phone: '+267 73 333 444', role: 'member',    joined_at: '2026-05-06T10:00:00Z' },
  { id: 'm4', display_name: 'Lesedi Moagi',    phone: '+267 74 555 666', role: 'member',    joined_at: '2026-05-06T11:00:00Z' },
  { id: 'm5', display_name: 'Amogelang Seolo', phone: '+267 75 777 888', role: 'member',    joined_at: '2026-05-07T08:30:00Z' },
]

const PROVIDER_LABELS: Record<MobileMoneyProvider, string> = {
  orange_money: 'Orange Money',
  myzaka:       'MyZaka',
  smega:        'Smega',
}

const PROVIDER_COLORS: Record<MobileMoneyProvider, string> = {
  orange_money: '#FF6B00',
  myzaka:       '#009FE3',
  smega:        '#8B2FC9',
}

const FUND_TYPE_META: Record<string, { emoji: string; color: string }> = {
  funeral:    { emoji: '🕊️', color: '#6B7280' },
  wedding:    { emoji: '💍', color: '#EC4899' },
  graduation: { emoji: '🎓', color: '#8B5CF6' },
  birthday:   { emoji: '🎂', color: '#F59E0B' },
  party:      { emoji: '🎉', color: '#10B981' },
  other:      { emoji: '📁', color: '#6B7280' },
}

function thebeToBWP(thebe: number): string {
  return `BWP ${(thebe / 100).toLocaleString('en-BW', { minimumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-BW', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1)
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} />
    </View>
  )
}

// ── Contribution row ───────────────────────────────────────────
function ContributionRow({ item }: { item: Contribution }) {
  const providerColor = item.provider ? PROVIDER_COLORS[item.provider] : colors.textMuted

  return (
    <View style={styles.listRow}>
      <View style={[styles.providerDot, { backgroundColor: providerColor + '20' }]}>
        <Text style={[styles.providerDotText, { color: providerColor }]}>
          {item.provider ? item.provider.charAt(0).toUpperCase() : '?'}
        </Text>
      </View>

      <View style={styles.listRowBody}>
        <View style={styles.listRowTop}>
          <Text style={styles.listRowName} numberOfLines={1}>{item.contributor_name}</Text>
          <Text style={styles.listRowAmount}>{thebeToBWP(item.amount)}</Text>
        </View>
        <View style={styles.listRowBottom}>
          <Text style={styles.listRowDate}>{formatDate(item.confirmed_at)}</Text>
          <View style={styles.badgeRow}>
            {item.source === 'sms_detected' && (
              <View style={styles.smsBadge}>
                <Text style={styles.smsBadgeText}>SMS</Text>
              </View>
            )}
            {item.is_disputed && (
              <View style={styles.disputedBadge}>
                <Text style={styles.disputedBadgeText}>Disputed</Text>
              </View>
            )}
          </View>
        </View>
        {item.notes && <Text style={styles.listRowNote}>{item.notes}</Text>}
      </View>
    </View>
  )
}

// ── Expense row ────────────────────────────────────────────────
function ExpenseRow({ item }: { item: Expense }) {
  return (
    <View style={styles.listRow}>
      <View style={[styles.providerDot, { backgroundColor: colors.errorLight }]}>
        <Text style={[styles.providerDotText, { color: colors.error }]}>↑</Text>
      </View>

      <View style={styles.listRowBody}>
        <View style={styles.listRowTop}>
          <Text style={styles.listRowName} numberOfLines={1}>{item.vendor}</Text>
          <Text style={[styles.listRowAmount, { color: colors.error }]}>
            −{thebeToBWP(item.amount)}
          </Text>
        </View>
        <View style={styles.listRowBottom}>
          <Text style={styles.listRowDate}>{formatDate(item.expense_date)}</Text>
          {item.category && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{item.category}</Text>
            </View>
          )}
          {item.is_disputed && (
            <View style={styles.disputedBadge}>
              <Text style={styles.disputedBadgeText}>Disputed</Text>
            </View>
          )}
        </View>
        {item.notes && <Text style={styles.listRowNote}>{item.notes}</Text>}
      </View>
    </View>
  )
}

// ── Member row ─────────────────────────────────────────────────
function MemberRow({ item }: { item: Member }) {
  const initials = item.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <View style={styles.listRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.listRowBody}>
        <View style={styles.listRowTop}>
          <Text style={styles.listRowName}>{item.display_name}</Text>
          {item.role === 'organiser' && (
            <View style={styles.organiserBadge}>
              <Text style={styles.organiserBadgeText}>Organiser</Text>
            </View>
          )}
        </View>
        <Text style={styles.listRowDate}>{item.phone}</Text>
      </View>
    </View>
  )
}

export default function FundDetailScreen({ navigation, route }: Props) {
  const { fundId } = route.params
  const [activeTab, setActiveTab] = useState<Tab>('contributions')

  const fund        = MOCK_FUND          // replace: query by fundId
  const isOrganiser = true               // replace: fund.organiser_id === currentUser.id
  const meta        = FUND_TYPE_META[fund.fund_type]
  const pct         = Math.round((fund.total_contributions / fund.goal_amount) * 100)

  async function handleShareInvite() {
    await Share.share({
      message: `Join my Tshelo fund "${fund.title}" — use invite code: ${fund.invite_code}`,
    })
  }

  function handleCopyCode() {
    Alert.alert('Invite Code', fund.invite_code, [{ text: 'OK' }])
    // replace with Clipboard.setStringAsync(fund.invite_code) once expo-clipboard is added
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'contributions', label: 'Contributions', count: MOCK_CONTRIBUTIONS.length },
    { id: 'expenses',      label: 'Expenses',      count: MOCK_EXPENSES.length },
    { id: 'members',       label: 'Members',        count: MOCK_MEMBERS.length },
  ]

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          {isOrganiser && (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.recordBtn}
                onPress={() => navigation.navigate('RecordContribution', {
                  fundId: fund.id,
                  fundTitle: fund.title,
                })}
                activeOpacity={0.85}
              >
                <Text style={styles.recordBtnText}>＋ Contribution</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.recordBtn, styles.recordBtnExpense]}
                onPress={() => navigation.navigate('RecordExpense', {
                  fundId: fund.id,
                  fundTitle: fund.title,
                })}
                activeOpacity={0.85}
              >
                <Text style={styles.recordBtnText}>↑ Expense</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.fundTypeChip}>
          <Text style={styles.fundTypeEmoji}>{meta.emoji}</Text>
          <Text style={styles.fundTypeLabel}>{fund.fund_type.charAt(0).toUpperCase() + fund.fund_type.slice(1)}</Text>
        </View>
        <Text style={styles.fundTitle}>{fund.title}</Text>

        {/* ── Stats row ──────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{thebeToBWP(fund.balance)}</Text>
            <Text style={styles.statLabel}>Balance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{thebeToBWP(fund.goal_amount)}</Text>
            <Text style={styles.statLabel}>Goal</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{fund.member_count}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
        </View>

        {/* ── Progress ───────────────────────────── */}
        <View style={styles.progressRow}>
          <ProgressBar value={fund.total_contributions} max={fund.goal_amount} />
          <Text style={styles.progressPct}>{pct}%</Text>
        </View>

        {/* ── Invite code ────────────────────────── */}
        <View style={styles.inviteRow}>
          <View style={styles.inviteCode}>
            <Text style={styles.inviteLabel}>Invite Code</Text>
            <Text style={styles.inviteCodeText}>{fund.invite_code}</Text>
          </View>
          <TouchableOpacity style={styles.inviteAction} onPress={handleCopyCode} activeOpacity={0.8}>
            <Text style={styles.inviteActionText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inviteAction} onPress={handleShareInvite} activeOpacity={0.8}>
            <Text style={styles.inviteActionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

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
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab content ────────────────────────────── */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>

        {activeTab === 'contributions' && (
          <>
            <View style={styles.summaryStrip}>
              <Text style={styles.summaryText}>
                Total in: <Text style={styles.summaryValue}>{thebeToBWP(fund.total_contributions)}</Text>
              </Text>
              <Text style={styles.summaryText}>
                {MOCK_CONTRIBUTIONS.length} contribution{MOCK_CONTRIBUTIONS.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {MOCK_CONTRIBUTIONS.map(c => <ContributionRow key={c.id} item={c} />)}
          </>
        )}

        {activeTab === 'expenses' && (
          <>
            <View style={styles.summaryStrip}>
              <Text style={styles.summaryText}>
                Total out: <Text style={[styles.summaryValue, { color: colors.error }]}>{thebeToBWP(fund.total_expenses)}</Text>
              </Text>
              <Text style={styles.summaryText}>
                {MOCK_EXPENSES.length} expense{MOCK_EXPENSES.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {MOCK_EXPENSES.length === 0 ? (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabEmoji}>🧾</Text>
                <Text style={styles.emptyTabText}>No expenses recorded yet.</Text>
              </View>
            ) : (
              MOCK_EXPENSES.map(e => <ExpenseRow key={e.id} item={e} />)
            )}
          </>
        )}

        {activeTab === 'members' && (
          <>
            <View style={styles.summaryStrip}>
              <Text style={styles.summaryText}>
                {MOCK_MEMBERS.length} of 20 member slots used
              </Text>
            </View>
            {MOCK_MEMBERS.map(m => <MemberRow key={m.id} item={m} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  // ── Header ───────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: colors.surface,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  recordBtn: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  recordBtnExpense: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  recordBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.surface,
  },
  fundTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  fundTypeEmoji: {
    fontSize: 14,
  },
  fundTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fundTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.surface,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.surface,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    width: 36,
    textAlign: 'right',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  inviteCode: {
    flex: 1,
  },
  inviteLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteCodeText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: 1.5,
  },
  inviteAction: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  inviteActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
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

  // ── List rows ────────────────────────────────────
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  providerDot: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  providerDotText: {
    fontSize: 15,
    fontWeight: '800',
  },
  listRowBody: {
    flex: 1,
  },
  listRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listRowName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  listRowAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  listRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  listRowDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  listRowNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  smsBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  smsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  disputedBadge: {
    backgroundColor: colors.errorLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  disputedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
  },
  categoryChip: {
    backgroundColor: colors.background,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // ── Member avatar ────────────────────────────────
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  organiserBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  organiserBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
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
