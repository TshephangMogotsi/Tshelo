import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import { KIND_LABELS, type HomeItem } from '../home/helpers'

export type FundQuickAction = 'contribution' | 'expense'

type Props = {
  action: FundQuickAction | null
  funds: HomeItem[]
  onSelect: (fund: HomeItem) => void
  onClose: () => void
}

export default function FundQuickActionSheet({ action, funds, onSelect, onClose }: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = makeStyles(colors)
  const actionLabel = action === 'expense' ? 'expense' : 'contribution'

  return (
    <Modal
      visible={action !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close fund selection"
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Record {actionLabel}</Text>
              <Text style={styles.subtitle}>Choose the Fund or Event + Fund this belongs to.</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close fund selection"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {funds.map(fund => {
              const kindLabel = KIND_LABELS[fund.kind]
              const isEventFund = fund.kind === 'eventFund'
              return (
                <TouchableOpacity
                  key={fund.id}
                  style={styles.fundRow}
                  onPress={() => onSelect(fund)}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${fund.title}, ${kindLabel}`}
                  accessibilityHint={`Record this ${actionLabel} against ${fund.title}`}
                >
                  <View style={styles.fundIcon}>
                    <Ionicons
                      name={isEventFund ? 'albums-outline' : 'wallet-outline'}
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.fundCopy}>
                    <Text style={styles.fundTitle} numberOfLines={1}>{fund.title}</Text>
                    <Text style={styles.fundMeta}>{kindLabel} · {fund.currency_code}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )
            })}
          </ScrollView>
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
      maxHeight: '72%',
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
      marginBottom: 12,
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
    list: {
      flexGrow: 0,
    },
    listContent: {
      paddingBottom: 4,
    },
    fundRow: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    fundIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    fundCopy: {
      flex: 1,
    },
    fundTitle: {
      fontSize: 15,
      lineHeight: 20,
      fontFamily: fonts.inter.bold,
      color: colors.textPrimary,
    },
    fundMeta: {
      marginTop: 3,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: fonts.inter.regular,
      color: colors.textMuted,
    },
  })
}
