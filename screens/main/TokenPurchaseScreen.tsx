import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { MainStackParamList } from '../../navigation/types'
import { colors } from '../../theme/colors'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'TokenPurchase'>
}

type TokenPack = 'starter' | 'value' | 'popular' | 'power'

type Pack = {
  id: TokenPack
  tokens: number
  priceBWP: number
  label: string
  popular: boolean
  perToken: string
  description: string
}

const PACKS: Pack[] = [
  {
    id: 'starter',
    tokens: 10,
    priceBWP: 5,
    label: 'Starter',
    popular: false,
    perToken: '50t/token',
    description: 'Good for trying out the app.',
  },
  {
    id: 'value',
    tokens: 30,
    priceBWP: 12,
    label: 'Value',
    popular: false,
    perToken: '40t/token',
    description: 'Save 20% vs Starter.',
  },
  {
    id: 'popular',
    tokens: 60,
    priceBWP: 20,
    label: 'Popular',
    popular: true,
    perToken: '33t/token',
    description: 'Best value for active organisers.',
  },
  {
    id: 'power',
    tokens: 120,
    priceBWP: 35,
    label: 'Power',
    popular: false,
    perToken: '29t/token',
    description: 'Maximum savings for heavy use.',
  },
]

const TOKEN_USES = [
  { icon: '📁', action: 'Create a fund',         cost: 1 },
  { icon: '📄', action: 'Generate interim report', cost: 1 },
  { icon: '🔒', action: 'Close a fund (report)',   cost: 0, note: 'Free' },
]

function PackCard({
  pack,
  selected,
  onSelect,
}: {
  pack: Pack
  selected: boolean
  onSelect: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.packCard, selected && styles.packCardSelected]}
      onPress={onSelect}
      activeOpacity={0.85}
    >
      {pack.popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>Most Popular</Text>
        </View>
      )}

      <View style={styles.packTop}>
        <View>
          <Text style={styles.packLabel}>{pack.label}</Text>
          <Text style={styles.packPerToken}>{pack.perToken}</Text>
        </View>
        <View style={styles.radioOuter}>
          {selected && <View style={styles.radioInner} />}
        </View>
      </View>

      <View style={styles.packMiddle}>
        <Text style={styles.packTokenCount}>
          🪙 <Text style={styles.packTokenNumber}>{pack.tokens}</Text> tokens
        </Text>
        <Text style={styles.packPrice}>BWP {pack.priceBWP}</Text>
      </View>

      <Text style={styles.packDescription}>{pack.description}</Text>
    </TouchableOpacity>
  )
}

export default function TokenPurchaseScreen({ navigation }: Props) {
  const [selectedPack, setSelectedPack] = useState<TokenPack>('popular')
  const currentBalance = 3  // replace with user.token_balance

  const pack = PACKS.find(p => p.id === selectedPack)!

  function handlePurchase() {
    Alert.alert(
      'Purchase Tokens',
      `You're about to purchase ${pack.tokens} tokens for BWP ${pack.priceBWP}.\n\nPayment gateway coming soon.`,
      [{ text: 'OK' }]
    )
    // TODO: integrate payment gateway (DPO Pay / Orange Money checkout)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────── */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.balanceBadge}>
            <Text style={styles.balanceEmoji}>🪙</Text>
            <Text style={styles.balanceText}>{currentBalance} tokens</Text>
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.heading}>Buy Tokens</Text>
          <Text style={styles.subheading}>
            Tokens power key actions on Tshelo. They never expire.
          </Text>
        </View>

        {/* ── What tokens do ───────────────────────── */}
        <View style={styles.usesCard}>
          <Text style={styles.usesTitle}>What tokens unlock</Text>
          {TOKEN_USES.map(u => (
            <View key={u.action} style={styles.useRow}>
              <Text style={styles.useIcon}>{u.icon}</Text>
              <Text style={styles.useAction}>{u.action}</Text>
              <Text style={styles.useCost}>
                {u.note ?? `🪙 ${u.cost}`}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Pack selector ────────────────────────── */}
        <Text style={styles.sectionLabel}>Choose a Pack</Text>
        <View style={styles.packGrid}>
          {PACKS.map(p => (
            <PackCard
              key={p.id}
              pack={p}
              selected={selectedPack === p.id}
              onSelect={() => setSelectedPack(p.id)}
            />
          ))}
        </View>

        {/* ── Order summary ────────────────────────── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{pack.label} Pack</Text>
            <Text style={styles.summaryValue}>🪙 {pack.tokens} tokens</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Price</Text>
            <Text style={styles.summaryValue}>BWP {pack.priceBWP}.00</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelBold}>New Balance</Text>
            <Text style={styles.summaryValueBold}>
              🪙 {currentBalance + pack.tokens} tokens
            </Text>
          </View>
        </View>

        {/* ── Payment notice ───────────────────────── */}
        <View style={styles.paymentNotice}>
          <Text style={styles.paymentNoticeText}>
            💳 Payment via Orange Money, MyZaka, or card — coming soon.
            Purchases are non-refundable once tokens are credited.
          </Text>
        </View>

        {/* ── CTA ──────────────────────────────────── */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handlePurchase}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            Purchase — BWP {pack.priceBWP}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  balanceEmoji: {
    fontSize: 15,
  },
  balanceText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  header: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // ── Uses card ──────────────────────────────────
  usesCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  usesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  useRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  useIcon: {
    fontSize: 18,
    width: 28,
  },
  useAction: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  useCost: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  // ── Pack selector ──────────────────────────────
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  packGrid: {
    gap: 12,
    marginBottom: 24,
  },
  packCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  packCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  popularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.surface,
  },
  packTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  packLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  packPerToken: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  packMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  packTokenCount: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  packTokenNumber: {
    fontWeight: '800',
    color: colors.textPrimary,
    fontSize: 18,
  },
  packPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  packDescription: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // ── Summary ────────────────────────────────────
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  summaryLabelBold: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryValueBold: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },

  // ── Payment notice ─────────────────────────────
  paymentNotice: {
    backgroundColor: colors.accentLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  paymentNoticeText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 19,
  },

  // ── CTA ────────────────────────────────────────
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
})
