import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import {
  BACK_HIT_SLOP,
  CREATE_OPTIONS,
  CreateOption,
  QUICK_ACTIONS,
  QuickActionId,
} from './constants'

type Props = {
  onSelect: (option: CreateOption) => void
  onQuickAction: (id: QuickActionId) => void
  onBack: () => void
}

export default function CreateOptionChooser({ onSelect, onQuickAction, onBack }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Header ─────────────────────────────────── */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={BACK_HIT_SLOP}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.greeting}>What's next?</Text>
        <Text style={styles.subtitle}>Jump into a quick action, or start something new.</Text>

        {/* ── Quick actions rail ─────────────────────── */}
        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {QUICK_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.id}
              style={styles.railItem}
              activeOpacity={0.8}
              onPress={() => onQuickAction(action.id)}
            >
              <View style={styles.railIconWrap}>
                <Ionicons name={action.icon} size={24} color={colors.primary} />
              </View>
              <Text style={styles.railItemText} numberOfLines={2}>
                {action.title}{'\n'}{action.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Tokens ──────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Tokens</Text>
        <TouchableOpacity
          style={styles.tokensCard}
          activeOpacity={0.88}
          onPress={() => onQuickAction('tokens')}
        >
          <View style={styles.tokensIconWrap}>
            <Ionicons name="cash-outline" size={24} color={colors.accent} />
          </View>
          <View style={styles.tokensBody}>
            <Text style={styles.tokensTitle}>Buy Tokens</Text>
            <Text style={styles.tokensDescription}>Top up your balance to unlock paid features like Event + Fund</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* ── Start something new ────────────────────── */}
        <Text style={styles.sectionLabel}>Start Something New</Text>
        {CREATE_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.id}
            style={styles.optionCard}
            activeOpacity={0.86}
            onPress={() => onSelect(option.id)}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: option.iconBg }]}>
              <Ionicons name={option.icon} size={24} color={option.tint} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription} numberOfLines={2}>{option.description}</Text>
            </View>
            <View style={styles.optionPricePill}>
              <Text style={styles.optionPriceText}>{option.price === 'FREE' ? 'FREE' : `${option.price} tokens`}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 48,
    },

    headerRow: {
      flexDirection: 'row',
      marginBottom: 18,
    },
    backButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    greeting: {
      fontSize: 30,
      lineHeight: 36,
      fontFamily: fonts.display.bold,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.textMuted,
      marginBottom: 28,
    },

    sectionLabel: {
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginBottom: 12,
    },

    rail: {
      gap: 14,
      paddingRight: 8,
      paddingBottom: 4,
      marginBottom: 32,
    },
    railItem: {
      width: 76,
      alignItems: 'center',
      gap: 8,
    },
    railIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    railItemText: {
      fontSize: 11.5,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'center',
    },

    tokensCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.accentLight,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.accent + '40',
      padding: 16,
      marginBottom: 32,
    },
    tokensIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tokensBody: {
      flex: 1,
    },
    tokensTitle: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 3,
    },
    tokensDescription: {
      fontSize: 12.5,
      lineHeight: 17,
      color: colors.textSecondary,
    },

    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.03,
      shadowRadius: 12,
      elevation: 1,
    },
    optionIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionBody: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 3,
    },
    optionDescription: {
      fontSize: 12.5,
      lineHeight: 17,
      color: colors.textMuted,
    },
    optionPricePill: {
      backgroundColor: colors.primaryLight,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    optionPriceText: {
      fontSize: 11.5,
      fontWeight: '900',
      color: colors.primary,
    },
  })
}
