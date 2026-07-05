import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { makeCommonStyles } from './common'
import { CATEGORIES, CategoryOption, categoryColor } from './categories'

type Props = {
  visible: boolean
  title: string
  selected: CategoryOption | null
  onSelect: (category: CategoryOption) => void
  onClose: () => void
}

export default function CategoryPickerModal({ visible, title, selected, onSelect, onClose }: Props) {
  const { colors } = useTheme()
  const common = makeCommonStyles(colors)
  const styles = makeStyles(colors)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={common.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={common.modalSheet}>
          <Text style={common.modalTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat, index) => {
                const isActive = selected?.value === cat.value
                const dot = categoryColor(index)
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.categoryGridItem, isActive && { borderColor: dot, backgroundColor: dot + '14' }]}
                    onPress={() => onSelect(cat)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.categoryGridDot, { backgroundColor: dot }]} />
                    <Text style={[styles.categoryGridText, isActive && { color: dot, fontWeight: '700' }]} numberOfLines={1}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryGridItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      width: '48%',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
    },
    categoryGridDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    categoryGridText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  })
}
