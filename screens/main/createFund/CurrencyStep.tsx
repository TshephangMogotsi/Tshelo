import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import { BRAND_LAVENDER, BRAND_PURPLE, FUND_CURRENCIES, FundCurrency } from './constants'

type Props = {
  currency: FundCurrency
  onSelectCurrency: (currency: FundCurrency) => void
  onContinue: () => void
  onBack: () => void
}

export default function CurrencyStep({ currency, onSelectCurrency, onContinue, onBack }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <FlowHeader title="New Fund" centered onBack={onBack} />

      <ScrollView contentContainerStyle={styles.currencyScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.currencyIntro}>
          <Text style={styles.currencyIntroTitle}>Fund Currency</Text>
          <Text style={styles.currencyIntroText}>You can create funds in any currency</Text>
        </View>

        <View style={styles.currencyList}>
          {FUND_CURRENCIES.map(item => {
            const active = item.id === currency
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.currencyCard, active && styles.currencyCardActive]}
                activeOpacity={0.86}
                onPress={() => onSelectCurrency(item.id)}
              >
                {active && <Text style={styles.currencyWatermark}>{item.code.slice(0, 2)}</Text>}
                <View style={styles.currencyCardBody}>
                  <Text style={styles.currencyCode}>{item.code}</Text>
                  <Text style={styles.currencyName}>({item.name})</Text>
                  {item.helper && <Text style={styles.currencyHelper}>{item.helper}</Text>}
                </View>
                <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                  {active && (
                    <View style={styles.radioInner}>
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.currencyTip}>
          <Text style={styles.currencyTipIcon}>💡</Text>
          <Text style={styles.currencyTipText}>
            Choose based on where contributors are. Diaspora family? Use their local currency.
          </Text>
        </View>

        <TouchableOpacity style={styles.currencyContinue} activeOpacity={0.86} onPress={onContinue}>
          <Text style={styles.currencyContinueText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    currencyScroll: {
      flexGrow: 1,
      paddingHorizontal: 28,
      paddingTop: 22,
      paddingBottom: 40,
    },
    currencyIntro: {
      marginBottom: 24,
    },
    currencyIntroTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 10,
    },
    currencyIntroText: {
      maxWidth: 270,
      fontSize: 17,
      lineHeight: 25,
      fontWeight: '500',
      color: colors.textMuted,
    },
    currencyList: {
      gap: 18,
      marginBottom: 28,
    },
    currencyCard: {
      minHeight: 120,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.035,
      shadowRadius: 14,
      elevation: 2,
    },
    currencyCardActive: {
      backgroundColor: BRAND_LAVENDER,
      borderColor: BRAND_PURPLE,
      borderWidth: 2,
    },
    currencyWatermark: {
      position: 'absolute',
      left: 30,
      fontSize: 28,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    currencyCardBody: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    currencyCode: {
      fontSize: 23,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    currencyName: {
      fontSize: 22,
      lineHeight: 29,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    currencyHelper: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '600',
      color: BRAND_PURPLE,
      textAlign: 'center',
      marginTop: 2,
    },
    radioOuter: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    radioOuterActive: {
      borderColor: BRAND_PURPLE,
      backgroundColor: BRAND_PURPLE,
    },
    radioInner: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    currencyTip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.accentLight,
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 18,
      marginBottom: 28,
    },
    currencyTipIcon: {
      fontSize: 16,
      marginTop: 1,
    },
    currencyTipText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 23,
      fontWeight: '500',
      color: '#92400E',
    },
    currencyContinue: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE,
      borderRadius: 28,
      paddingVertical: 17,
      shadowColor: BRAND_PURPLE,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },
    currencyContinueText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  })
}
