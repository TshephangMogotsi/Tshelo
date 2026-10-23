import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'

export type FilterOption<T extends string> = { id: T; label: string }

type Props<T extends string> = {
  query: string
  filter: T
  placeholder: string
  options: readonly FilterOption<T>[]
  onQueryChange: (value: string) => void
  onFilterChange: (value: T) => void
}

export default function ListSearchFilters<T extends string>({
  query,
  filter,
  placeholder,
  options,
  onQueryChange,
  onFilterChange,
}: Props<T>) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const activeFilter = filter !== 'all'

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onQueryChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          accessibilityLabel={placeholder}
        />
        {query ? (
          <TouchableOpacity onPress={() => onQueryChange('')} hitSlop={8} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        accessibilityRole="radiogroup"
      >
        {options.map(option => {
          const selected = filter === option.id
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.filterChip, selected && styles.filterChipActive]}
              onPress={() => onFilterChange(option.id)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      {(query || activeFilter) ? (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => { onQueryChange(''); onFilterChange('all' as T) }}
          accessibilityRole="button"
        >
          <Text style={styles.clearText}>Clear search & filters</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { gap: 10, marginBottom: 8 },
    searchBox: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: { flex: 1, paddingVertical: 0, fontSize: 14, fontFamily: fonts.inter.regular, color: colors.textPrimary },
    filterRow: { gap: 8, paddingRight: 20 },
    filterChip: {
      minHeight: 32,
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    filterChipText: { fontSize: 12, fontFamily: fonts.inter.semiBold, color: colors.textSecondary },
    filterChipTextActive: { color: colors.primary, fontFamily: fonts.inter.bold },
    clearButton: { alignSelf: 'flex-start', minHeight: 26, justifyContent: 'center' },
    clearText: { fontSize: 12, fontFamily: fonts.inter.bold, color: colors.primary },
  })
}
