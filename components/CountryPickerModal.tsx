import { useMemo, useState } from 'react'
import {
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../context/ThemeContext'
import type { AppColors } from '../theme/themes'
import { fonts } from '../theme/typography'
import { searchSignupCountries, type SignupCountry } from '../lib/countries'

type Props = {
  visible: boolean
  selectedCode: string
  onSelect: (country: SignupCountry) => void
  onClose: () => void
}

export default function CountryPickerModal({ visible, selectedCode, onSelect, onClose }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const [search, setSearch] = useState('')
  const filteredCountries = useMemo(() => searchSignupCountries(search), [search])

  function close() {
    setSearch('')
    onClose()
  }

  function select(country: SignupCountry) {
    setSearch('')
    onSelect(country)
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Choose your country</Text>
            <Text style={styles.subtitle}>{filteredCountries.length} countries in the list</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close country picker"
          >
            <Ionicons name="close" size={21} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search country, code or currency"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search countries"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear country search">
              <Ionicons name="close-circle" size={19} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          data={filteredCountries}
          keyExtractor={country => country.code}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          initialNumToRender={18}
          windowSize={7}
          renderItem={({ item }) => {
            const selected = selectedCode === item.code
            return (
              <TouchableOpacity
                style={[styles.countryRow, selected && styles.countryRowSelected]}
                onPress={() => select(item)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${item.name}, ${item.dialCode}, ${item.currency}`}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={styles.countryCopy}>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryMeta}>{item.code} · {item.dialCode} · {item.currency}</Text>
                </View>
                <View style={[styles.check, selected && styles.checkSelected]}>
                  {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                </View>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name="globe-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No country found</Text>
              <Text style={styles.emptyText}>Try its name, two-letter code, currency, or calling code.</Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
    title: { fontFamily: fonts.display.bold, fontSize: 22, color: colors.textPrimary },
    subtitle: { marginTop: 3, fontSize: 12, color: colors.textMuted },
    closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    searchBox: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    searchInput: { flex: 1, height: 48, paddingVertical: 0, fontSize: 15, color: colors.textPrimary },
    list: { paddingHorizontal: 20, paddingBottom: 28 },
    countryRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    countryRowSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    flag: { width: 34, fontSize: 25, textAlign: 'center' },
    countryCopy: { flex: 1, minWidth: 0 },
    countryName: { fontFamily: fonts.inter.bold, fontSize: 14, color: colors.textPrimary },
    countryMeta: { marginTop: 3, fontFamily: fonts.inter.regular, fontSize: 11, color: colors.textMuted },
    check: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border },
    checkSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
    empty: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 64 },
    emptyTitle: { marginTop: 12, fontFamily: fonts.inter.bold, fontSize: 15, color: colors.textPrimary },
    emptyText: { marginTop: 5, maxWidth: 270, textAlign: 'center', fontSize: 12, lineHeight: 18, color: colors.textMuted },
  })
}
