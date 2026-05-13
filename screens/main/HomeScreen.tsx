import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { MainStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'Home'>
}

type FundType = 'funeral' | 'wedding' | 'graduation' | 'birthday' | 'party' | 'other'
type FundStatus = 'active' | 'closed' | 'suspended'
type MemberRole = 'organiser' | 'member'

type Fund = {
  id: string
  title: string
  fund_type: FundType
  status: FundStatus
  goal_amount: number       // thebe
  total_contributions: number  // thebe
  balance: number           // thebe
  member_count: number
  contribution_count: number
  role: MemberRole
}

const FUND_META: Record<FundType, { emoji: string; label: string; color: string }> = {
  funeral:    { emoji: '🕊️', label: 'Funeral',    color: '#6B7280' },
  wedding:    { emoji: '💍', label: 'Wedding',    color: '#EC4899' },
  graduation: { emoji: '🎓', label: 'Graduation', color: '#8B5CF6' },
  birthday:   { emoji: '🎂', label: 'Birthday',   color: '#F59E0B' },
  party:      { emoji: '🎉', label: 'Party',      color: '#10B981' },
  other:      { emoji: '📁', label: 'Other',      color: '#6B7280' },
}

// ── Placeholder data (replace with Supabase query) ────────────
const MOCK_FUNDS: Fund[] = [
  {
    id: '1',
    title: "Kgosi's Funeral Fund",
    fund_type: 'funeral',
    status: 'active',
    goal_amount: 500000,       // BWP 5,000
    total_contributions: 320000,
    balance: 295000,
    member_count: 12,
    contribution_count: 18,
    role: 'organiser',
  },
  {
    id: '2',
    title: 'Mpho & Tebogo Wedding',
    fund_type: 'wedding',
    status: 'active',
    goal_amount: 800000,
    total_contributions: 140000,
    balance: 140000,
    member_count: 7,
    contribution_count: 9,
    role: 'member',
  },
]

function thebeToBWP(thebe: number): string {
  return `BWP ${(thebe / 100).toLocaleString('en-BW', { minimumFractionDigits: 2 })}`
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1)
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} />
    </View>
  )
}

function FundCard({ fund, onPress }: { fund: Fund; onPress: () => void }) {
  const meta = FUND_META[fund.fund_type]
  const pct = Math.round((fund.total_contributions / fund.goal_amount) * 100)

  return (
    <TouchableOpacity style={styles.fundCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.fundCardHeader}>
        <View style={[styles.fundTypeChip, { backgroundColor: meta.color + '18' }]}>
          <Text style={styles.fundTypeEmoji}>{meta.emoji}</Text>
          <Text style={[styles.fundTypeLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={[
          styles.roleBadge,
          fund.role === 'organiser' ? styles.roleBadgeOrganiser : styles.roleBadgeMember,
        ]}>
          <Text style={[
            styles.roleBadgeText,
            fund.role === 'organiser' ? styles.roleBadgeTextOrganiser : styles.roleBadgeTextMember,
          ]}>
            {fund.role === 'organiser' ? 'Organiser' : 'Member'}
          </Text>
        </View>
      </View>

      <Text style={styles.fundTitle} numberOfLines={1}>{fund.title}</Text>

      <View style={styles.progressRow}>
        <ProgressBar value={fund.total_contributions} max={fund.goal_amount} />
        <Text style={styles.progressPct}>{pct}%</Text>
      </View>

      <View style={styles.fundStats}>
        <View style={styles.fundStat}>
          <Text style={styles.fundStatValue}>{thebeToBWP(fund.balance)}</Text>
          <Text style={styles.fundStatLabel}>Balance</Text>
        </View>
        <View style={styles.fundStatDivider} />
        <View style={styles.fundStat}>
          <Text style={styles.fundStatValue}>{thebeToBWP(fund.goal_amount)}</Text>
          <Text style={styles.fundStatLabel}>Goal</Text>
        </View>
        <View style={styles.fundStatDivider} />
        <View style={styles.fundStat}>
          <Text style={styles.fundStatValue}>{fund.member_count}</Text>
          <Text style={styles.fundStatLabel}>Members</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function EmptyFunds({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🪣</Text>
      <Text style={styles.emptyHeading}>No funds yet</Text>
      <Text style={styles.emptyBody}>
        Create a fund to start collecting contributions, or join one with an invite code.
      </Text>
      <TouchableOpacity style={styles.emptyCreateBtn} onPress={onCreate} activeOpacity={0.85}>
        <Text style={styles.emptyCreateBtnText}>Create a Fund</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onJoin}>
        <Text style={styles.emptyJoinLink}>Join with invite code</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function HomeScreen({ navigation }: Props) {
  const displayName = 'Kefilwe'   // replace with auth user
  const tokenBalance = 3          // replace with user.token_balance

  const activeFunds = MOCK_FUNDS.filter(f => f.status === 'active')

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {displayName} 👋</Text>
          <Text style={styles.subGreeting}>Here are your active funds</Text>
        </View>
        <TouchableOpacity style={styles.tokenBadge} activeOpacity={0.8} onPress={() => navigation.navigate('TokenPurchase')}>
          <Text style={styles.tokenEmoji}>🪙</Text>
          <Text style={styles.tokenCount}>{tokenBalance}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Quick actions ──────────────────────────── */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => navigation.navigate('CreateFund')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryActionIcon}>＋</Text>
            <Text style={styles.primaryActionText}>Create Fund</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => navigation.navigate('JoinFund')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryActionIcon}>🔗</Text>
            <Text style={styles.secondaryActionText}>Join Fund</Text>
          </TouchableOpacity>
        </View>

        {/* ── Fund list ──────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Funds</Text>
            <Text style={styles.sectionCount}>{activeFunds.length} active</Text>
          </View>

          {activeFunds.length === 0 ? (
            <EmptyFunds
              onCreate={() => navigation.navigate('CreateFund')}
              onJoin={() => navigation.navigate('JoinFund')}
            />
          ) : (
            activeFunds.map(fund => (
              <FundCard
                key={fund.id}
                fund={fund}
                onPress={() => navigation.navigate('FundDetail', { fundId: fund.id })}
              />
            ))
          )}
        </View>

        {/* ── Sandbox notice ─────────────────────────── */}
        <View style={styles.sandboxNotice}>
          <Text style={styles.sandboxText}>
            🏦 Running in Bank of Botswana Sandbox — fund cap BWP 10,000
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.surface,
    marginBottom: 2,
  },
  subGreeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  tokenEmoji: {
    fontSize: 16,
  },
  tokenCount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.surface,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  primaryActionIcon: {
    fontSize: 18,
    color: colors.surface,
    fontWeight: '700',
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  secondaryActionIcon: {
    fontSize: 16,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  fundCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fundCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  fundTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 5,
  },
  fundTypeEmoji: {
    fontSize: 13,
  },
  fundTypeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleBadge: {
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  roleBadgeOrganiser: {
    backgroundColor: colors.primaryLight,
  },
  roleBadgeMember: {
    backgroundColor: colors.background,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roleBadgeTextOrganiser: {
    color: colors.primary,
  },
  roleBadgeTextMember: {
    color: colors.textSecondary,
  },
  fundTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
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
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    width: 36,
    textAlign: 'right',
  },
  fundStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fundStat: {
    flex: 1,
    alignItems: 'center',
  },
  fundStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  fundStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  fundStatLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  emptyCreateBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 14,
  },
  emptyCreateBtnText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyJoinLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  sandboxNotice: {
    backgroundColor: colors.accentLight,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  sandboxText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
})
