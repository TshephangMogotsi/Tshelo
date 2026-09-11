import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import { OTHER_FUND_ICON_OPTIONS, type EmojiOption } from './constants'

type Props = {
  visible: boolean
  selectedId: string | null
  onSelect: (item: EmojiOption) => void
  onClose: () => void
}

export default function FundIconPickerSheet({ visible, selectedId, onSelect, onClose }: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = makeStyles(colors)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>More fund icons</Text>
              <Text style={styles.subtitle}>Choose an icon that best represents this fund.</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close fund icon picker"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={OTHER_FUND_ICON_OPTIONS}
            keyExtractor={item => item.id}
            numColumns={3}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => {
              const active = selectedId === item.id
              return (
                <TouchableOpacity
                  style={[styles.iconChoice, active && styles.iconChoiceActive]}
                  activeOpacity={0.8}
                  onPress={() => onSelect(item)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${item.label} fund icon`}
                  accessibilityState={{ checked: active }}
                >
                  <Ionicons
                    name={item.icon ?? 'shapes-outline'}
                    size={24}
                    color={active ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.iconLabel, active && styles.iconLabelActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
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
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    sheet: {
      maxHeight: '76%',
      paddingHorizontal: 20,
      paddingTop: 10,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: colors.surface,
    },
    handle: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      marginBottom: 18,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 18,
    },
    headerCopy: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      lineHeight: 25,
      fontFamily: fonts.inter.extraBold,
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: 3,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: fonts.inter.regular,
      color: colors.textMuted,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    grid: {
      paddingBottom: 4,
    },
    gridRow: {
      gap: 10,
      marginBottom: 10,
    },
    iconChoice: {
      flex: 1,
      minWidth: 0,
      minHeight: 82,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.background,
    },
    iconChoiceActive: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    iconLabel: {
      maxWidth: '92%',
      fontSize: 11,
      lineHeight: 14,
      fontFamily: fonts.inter.semiBold,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    iconLabelActive: {
      color: colors.primary,
    },
  })
}
