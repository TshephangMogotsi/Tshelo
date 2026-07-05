import { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import emojiData from '@emoji-mart/data'
import type { EmojiMartData } from '@emoji-mart/data'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { BRAND_LAVENDER, BRAND_PURPLE } from './constants'

type EmojiPickerItem = {
  id: string
  native: string
  name: string
  keywords: string[]
  category: string
}

const EMOJI_CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  people: 'Smileys',
  nature: 'Nature',
  foods: 'Food',
  activity: 'Events',
  places: 'Places',
  objects: 'Objects',
  symbols: 'Symbols',
  flags: 'Flags',
}

const emojiPickerData = emojiData as EmojiMartData

const CATEGORY_OPTIONS = ['all', ...emojiPickerData.categories.map(category => category.id)]

const EMOJI_ITEMS: EmojiPickerItem[] = emojiPickerData.categories.flatMap(category => (
  category.emojis
    .map(id => {
      const emoji = emojiPickerData.emojis[id]
      const native = emoji?.skins?.[0]?.native

      if (!emoji || !native) return null

      return {
        id: emoji.id,
        native,
        name: emoji.name,
        keywords: emoji.keywords ?? [],
        category: category.id,
      }
    })
    .filter((item): item is EmojiPickerItem => item !== null)
))

type Props = {
  visible: boolean
  selected: string
  search: string
  onSearchChange: (text: string) => void
  category: string
  onCategoryChange: (category: string) => void
  onSelect: (native: string) => void
  onClose: () => void
}

export default function EmojiPickerModal({
  visible,
  selected,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  onSelect,
  onClose,
}: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const filteredEmojiItems = useMemo(() => {
    const query = search.trim().toLowerCase()

    return EMOJI_ITEMS.filter(item => {
      const categoryMatches = category === 'all' || item.category === category
      if (!categoryMatches) return false
      if (!query) return true

      return item.name.toLowerCase().includes(query)
        || item.id.toLowerCase().includes(query)
        || item.keywords.some(keyword => keyword.toLowerCase().includes(query))
    })
  }, [category, search])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.emojiDialogBackdrop}>
        <View style={styles.emojiDialogCard}>
          <View style={styles.emojiDialogHeader}>
            <Text style={styles.emojiDialogTitle}>Choose emoji</Text>
            <TouchableOpacity
              style={styles.emojiDialogClose}
              activeOpacity={0.75}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.emojiSearchBox}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.emojiSearchInput}
              placeholder="Search emojis"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={onSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.emojiCategoryRow}
          >
            {CATEGORY_OPTIONS.map(option => {
              const active = category === option
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.emojiCategoryChip, active && styles.emojiCategoryChipActive]}
                  activeOpacity={0.84}
                  onPress={() => onCategoryChange(option)}
                >
                  <Text style={[styles.emojiCategoryText, active && styles.emojiCategoryTextActive]}>
                    {EMOJI_CATEGORY_LABELS[option] ?? option}
                  </Text>
                </TouchableOpacity>
              )
            })}

          </ScrollView>

          <FlatList
            data={filteredEmojiItems}
            keyExtractor={item => item.id}
            numColumns={6}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.emojiDialogGrid}
            columnWrapperStyle={styles.emojiDialogGridRow}
            initialNumToRender={48}
            maxToRenderPerBatch={60}
            windowSize={8}
            ListEmptyComponent={(
              <Text style={styles.emojiEmptyText}>No emojis found</Text>
            )}
            renderItem={({ item }) => {
              const active = selected === item.native
              return (
                <TouchableOpacity
                  style={[styles.emojiDialogChoice, active && styles.emojiDialogChoiceActive]}
                  activeOpacity={0.84}
                  onPress={() => onSelect(item.native)}
                >
                  <Text style={styles.emojiDialogChoiceText}>{item.native}</Text>
                </TouchableOpacity>
              )
            }}
          />
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    emojiDialogBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.38)',
      paddingHorizontal: 28,
    },
    emojiDialogCard: {
      width: '100%',
      maxWidth: 340,
      maxHeight: '82%',
      backgroundColor: colors.surface,
      borderRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emojiDialogHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    emojiDialogTitle: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    emojiDialogClose: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
      backgroundColor: colors.background,
    },
    emojiSearchBox: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      gap: 8,
      marginBottom: 12,
    },
    emojiSearchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      paddingVertical: 10,
    },
    emojiCategoryRow: {
      gap: 8,
      paddingBottom: 14,
    },
    emojiCategoryChip: {
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 17,
      paddingHorizontal: 13,
    },
    emojiCategoryChipActive: {
      backgroundColor: BRAND_LAVENDER,
      borderColor: BRAND_PURPLE,
    },
    emojiCategoryText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    emojiCategoryTextActive: {
      color: BRAND_PURPLE,
    },
    emojiDialogGrid: {
      paddingBottom: 4,
    },
    emojiDialogGridRow: {
      gap: 8,
      marginBottom: 8,
    },
    emojiDialogChoice: {
      flex: 1,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
    },
    emojiDialogChoiceActive: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    emojiDialogChoiceText: {
      fontSize: 24,
    },
    emojiEmptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 24,
    },
  })
}
