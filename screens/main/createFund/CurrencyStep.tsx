import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import countries from 'world-countries'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import { BRAND_PURPLE, FUND_CURRENCIES, FundCurrency } from './constants'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const CURRENCY_COUNTRIES = countries.reduce<Record<string, string[]>>((result, country) => {
  const countryTerms = [country.name.common, country.name.official, country.cca2, country.cca3, ...country.altSpellings]
  for (const code of Object.keys(country.currencies)) {
    result[code] = [...new Set([...(result[code] ?? []), ...countryTerms])]
  }
  return result
}, {})

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const previous = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = previous
    }
  }
  return row[b.length]
}

function matchesSearch(value: string, query: string) {
  const candidate = value.toLowerCase()
  if (candidate.includes(query)) return true
  if (query.length < 5) return false
  return editDistance(candidate, query) <= (query.length >= 8 ? 2 : 1)
}

type Props = {
  currency: FundCurrency
  onSelectCurrency: (currency: FundCurrency) => void
  onContinue: () => void
  onBack: () => void
}

export default function CurrencyStep({ currency, onSelectCurrency, onContinue, onBack }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const [search, setSearch] = useState('')
  const [showOtherCurrencies, setShowOtherCurrencies] = useState(false)
  const normalizedSearch = search.trim().toUpperCase()
  const selectedKnown = FUND_CURRENCIES.find(item => item.id === currency)
  const customSelected = !selectedKnown && /^[A-Z]{3}$/.test(currency)
  const primaryCurrencies = FUND_CURRENCIES.filter(item => ['BWP', 'ZAR', 'USD'].includes(item.id))
  const otherCurrencies = FUND_CURRENCIES.filter(item => !['BWP', 'ZAR', 'USD'].includes(item.id))

  const filteredCurrencies = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return otherCurrencies
    return FUND_CURRENCIES.filter(item => {
      const searchTerms = [item.code, item.name, ...(CURRENCY_COUNTRIES[item.code] ?? [])]
      return searchTerms.some(term => matchesSearch(term, query))
    })
  }, [search])

  const canUseCustom = /^[A-Z]{3}$/.test(normalizedSearch)
    && !FUND_CURRENCIES.some(item => item.id === normalizedSearch)

  function toggleOtherCurrencies() {
    LayoutAnimation.configureNext({
      duration: 280,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    })
    setShowOtherCurrencies(open => !open)
    setSearch('')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <FlowHeader title="Create Fund" step="Step 1 of 2" onBack={onBack} />

      <View style={styles.intro}>
        <Text style={styles.title}>Choose currency</Text>
        <Text style={styles.subtitle}>Choose Pula, Rand or USD, or search for another currency.</Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!showOtherCurrencies && primaryCurrencies.map(item => (
          <CurrencyRow
            key={item.id}
            code={item.code}
            name={item.name}
            symbol={item.symbol}
            helper={item.helper}
            active={currency === item.id}
            styles={styles}
            onPress={() => onSelectCurrency(item.id)}
          />
        ))}

        <TouchableOpacity
          style={[styles.dropdownButton, showOtherCurrencies && styles.dropdownButtonOpen]}
          onPress={toggleOtherCurrencies}
          activeOpacity={0.82}
        >
          <View style={styles.customIcon}><Ionicons name="globe-outline" size={19} color={colors.primary} /></View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowCode}>Other currencies</Text>
            <Text style={styles.rowName}>{selectedKnown && !primaryCurrencies.some(item => item.id === currency) ? `${selectedKnown.code} · ${selectedKnown.name}` : 'Search by currency name or code'}</Text>
          </View>
          <Ionicons name={showOtherCurrencies ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {showOtherCurrencies && (
          <>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={text => setSearch(text.replace(/[^a-zA-Z ]/g, '').slice(0, 32))}
                placeholder="Search currency, code or country"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                returnKeyType="search"
              />
              {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></TouchableOpacity> : null}
            </View>

            {customSelected && !search && (
              <CurrencyRow code={currency} name="Custom currency" symbol={currency} active styles={styles} onPress={() => {}} />
            )}

            {canUseCustom && (
              <TouchableOpacity style={styles.customRow} onPress={() => { onSelectCurrency(normalizedSearch); setSearch('') }} activeOpacity={0.82}>
                <View style={styles.customIcon}><Ionicons name="add" size={19} color={colors.primary} /></View>
                <View style={styles.rowCopy}><Text style={styles.rowCode}>Use {normalizedSearch}</Text><Text style={styles.rowName}>Custom three-letter currency code</Text></View>
                <Ionicons name="arrow-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}

            {filteredCurrencies.map(item => (
              <CurrencyRow key={item.id} code={item.code} name={item.name} symbol={item.symbol} active={currency === item.id} styles={styles} onPress={() => onSelectCurrency(item.id)} />
            ))}

            {!filteredCurrencies.length && !canUseCustom && (
              <View style={styles.emptyState}>
                <Ionicons name="globe-outline" size={25} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Currency not listed?</Text>
                <Text style={styles.emptyText}>Enter its three-letter code, such as CHF.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.selectionSummary}>
          <Text style={styles.selectionLabel}>SELECTED</Text>
          <Text style={styles.selectionValue}>{selectedKnown ? `${selectedKnown.code} · ${selectedKnown.name}` : currency}</Text>
        </View>
        <TouchableOpacity style={styles.continueButton} onPress={onContinue} activeOpacity={0.86}>
          <Text style={styles.continueText}>Continue</Text>
          <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function CurrencyRow({ code, name, symbol, helper, active, styles, onPress }: {
  code: string
  name: string
  symbol: string
  helper?: string
  active: boolean
  styles: ReturnType<typeof makeStyles>
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={[styles.currencyRow, active && styles.currencyRowActive]} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.symbolBox, active && styles.symbolBoxActive]}><Text style={[styles.symbolText, active && styles.symbolTextActive]}>{symbol}</Text></View>
      <View style={styles.rowCopy}>
        <View style={styles.codeLine}><Text style={styles.rowCode}>{code}</Text>{helper ? <Text style={styles.homeBadge}>HOME</Text> : null}</View>
        <Text style={styles.rowName}>{name}</Text>
      </View>
      <View style={[styles.checkCircle, active && styles.checkCircleActive]}>{active && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}</View>
    </TouchableOpacity>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    intro: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14 },
    title: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    subtitle: { fontSize: 13, lineHeight: 19, color: colors.textMuted, maxWidth: 330 },
    searchBox: {
      height: 46, flexDirection: 'row', alignItems: 'center', gap: 9,
      marginTop: 2, paddingHorizontal: 13,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 13,
    },
    searchInput: { flex: 1, height: 44, paddingVertical: 0, textAlignVertical: 'center', fontSize: 14, color: colors.textPrimary },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 24, paddingBottom: 16, gap: 7 },
    currencyRow: {
      minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 13, paddingHorizontal: 11, paddingVertical: 8,
    },
    currencyRowActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    symbolBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    symbolBoxActive: { backgroundColor: colors.surface },
    symbolText: { maxWidth: 36, fontSize: 13, fontWeight: '800', color: colors.textSecondary, textAlign: 'center' },
    symbolTextActive: { color: colors.primary },
    rowCopy: { flex: 1, minWidth: 0 },
    codeLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    rowCode: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.textPrimary },
    rowName: { fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: 1 },
    homeBadge: { fontSize: 8, fontWeight: '800', letterSpacing: 0.6, color: colors.primary, backgroundColor: colors.surface, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
    checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    checkCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    customRow: {
      minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11,
      backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary,
      borderRadius: 13, paddingHorizontal: 11, paddingVertical: 8,
    },
    dropdownButton: {
      minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 13, paddingHorizontal: 11, paddingVertical: 8, marginTop: 3,
    },
    dropdownButtonOpen: { borderColor: colors.primary },
    customIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    emptyState: { alignItems: 'center', paddingVertical: 30 },
    emptyTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginTop: 8 },
    emptyText: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
    footer: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
      paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16,
    },
    selectionSummary: { flex: 1 },
    selectionLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.8, color: colors.textMuted, marginBottom: 3 },
    selectionValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    continueButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: BRAND_PURPLE, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 12 },
    continueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  })
}
