import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'
import { buildTokenPortalUrl, TOKEN_PORTAL_URL } from '../../lib/tokenPortal'
import {
  TOKEN_FEATURE_PRICES,
  TOKEN_PACKS,
  tokenPriceLabel,
  type TokenPack,
  type TokenPackId,
} from '../../lib/tokenPricing'

type Props = {
  navigation: any
  route?: { name?: string }
}

const TOKEN_USES = [
  { icon: '✨', action: 'Create an Event + Fund', cost: TOKEN_FEATURE_PRICES.eventFund },
  { icon: '📁', action: 'First event and first fund', cost: 0, note: 'Free' },
  { icon: '📂', action: 'Each additional event or fund', cost: TOKEN_FEATURE_PRICES.additionalFund },
  { icon: '📄', action: 'Interim PDF report', cost: TOKEN_FEATURE_PRICES.interimPdf },
  { icon: '🛡️', action: 'Certified audit report', cost: TOKEN_FEATURE_PRICES.certifiedAudit },
  { icon: '🔒', action: 'Final report when a fund closes', cost: 0, note: 'Free' },
]

type Styles = ReturnType<typeof makeStyles>

function PackCard({
  pack,
  selected,
  onSelect,
  styles,
}: {
  pack: TokenPack
  selected: boolean
  onSelect: () => void
  styles: Styles
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
          <Text style={styles.packPerToken}>{tokenPriceLabel(pack.priceBWP, pack.tokens)}</Text>
        </View>
        <View style={styles.radioOuter}>
          {selected && <View style={styles.radioInner} />}
        </View>
      </View>

      <View style={styles.packMiddle}>
        <Text style={styles.packTokenCount}>
          🪙 <Text style={styles.packTokenNumber}>{pack.tokens}</Text> tokens
        </Text>
        <Text style={styles.packPrice}>P{pack.priceBWP}</Text>
      </View>

      <Text style={styles.packDescription}>{pack.description}</Text>
    </TouchableOpacity>
  )
}

export default function TokenPurchaseScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const { tokenBalance, refreshProfile } = useAuth()
  const styles = makeStyles(colors)

  const [selectedPack, setSelectedPack] = useState<TokenPackId>('popular')
  const currentBalance = tokenBalance
  const isTab = route?.name === 'Tokens'

  const pack = TOKEN_PACKS.find(p => p.id === selectedPack)!

  useFocusEffect(useCallback(() => {
    void refreshProfile()
  }, [refreshProfile]))

  async function handlePurchase() {
    const checkoutUrl = buildTokenPortalUrl(TOKEN_PORTAL_URL, pack.id)
    if (!checkoutUrl) {
      Alert.alert(
        'Web checkout coming soon',
        'Token payments will be completed securely on the Tshelo website. No payment has been taken.',
      )
      return
    }

    if (!await Linking.canOpenURL(checkoutUrl)) {
      Alert.alert('Could not open checkout', 'Please try again or visit the Tshelo website in your browser.')
      return
    }
    await Linking.openURL(checkoutUrl)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────── */}
        <View style={styles.topRow}>
          {isTab ? <View /> : (
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
          )}
          <View style={styles.balanceBadge}>
            <Text style={styles.balanceEmoji}>🪙</Text>
            <Text style={styles.balanceText}>{currentBalance} tokens</Text>
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.heading}>Buy Tokens</Text>
          <Text style={styles.subheading}>
            Tokens are purchased credit for paid Tshelo features. They are separate from trust points.
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
          {TOKEN_PACKS.map(p => (
            <PackCard
              key={p.id}
              pack={p}
              selected={selectedPack === p.id}
              onSelect={() => setSelectedPack(p.id)}
              styles={styles}
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
            <Text style={styles.summaryValue}>P{pack.priceBWP}.00</Text>
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
            💳 Checkout opens on the secure Tshelo website. Your in-app balance updates only after the payment is confirmed.
          </Text>
        </View>

        {/* ── CTA ──────────────────────────────────── */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handlePurchase}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            Continue on web — P{pack.priceBWP}
          </Text>
        </TouchableOpacity>
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
      fontSize: 30,
      fontFamily: fonts.display.bold,
      color: colors.heading,
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
      borderRadius: 28,
      paddingVertical: 17,
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  })
}
