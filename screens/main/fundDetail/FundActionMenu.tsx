import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import { fundPrimaryActions, type FundPrimaryAction } from '../../../lib/fundPermissionPolicy'
import type { FundPermission } from '../../../lib/fundPermissions'

type Props = {
  canRecordContributions: boolean
  canRecordExpenses: boolean
  canManageMembers: boolean
  onRecordContribution: () => void
  onMakePledge: () => void
  onRecordExpense: () => void
  onInviteMembers: () => void
}

type Action = {
  label: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
}

export default function FundActionMenu({
  canRecordContributions,
  canRecordExpenses,
  canManageMembers,
  onRecordContribution,
  onMakePledge,
  onRecordExpense,
  onInviteMembers,
}: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = makeStyles(colors)
  const [visible, setVisible] = useState(false)

  const permissions = new Set<FundPermission>([
    ...(canRecordContributions ? ['record_contributions' as const] : []),
    ...(canRecordExpenses ? ['record_expenses' as const] : []),
    ...(canManageMembers ? ['manage_members' as const] : []),
  ])
  const actionById: Record<FundPrimaryAction, Action> = {
    record_contribution: {
          label: 'Record contribution',
          description: 'Add money received by the fund',
          icon: 'arrow-down-circle-outline',
          onPress: onRecordContribution,
    },
    make_pledge: {
          label: 'Make a pledge',
          description: 'Promise an amount to this fund',
          icon: 'hand-left-outline',
          onPress: onMakePledge,
    },
    record_expense: {
          label: 'Record expense',
          description: 'Add money paid out by the fund',
          icon: 'arrow-up-circle-outline',
          onPress: onRecordExpense,
    },
    invite_members: {
          label: 'Invite members',
          description: 'Share this fund’s invite link',
          icon: 'person-add-outline',
          onPress: onInviteMembers,
    },
  }
  const actions = fundPrimaryActions(permissions).map(actionId => actionById[actionId])

  function choose(action: Action) {
    setVisible(false)
    action.onPress()
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(insets.bottom, 16) + 12 }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.86}
        accessibilityRole="button"
        accessibilityLabel="Add to fund"
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setVisible(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Add to fund</Text>
                <Text style={styles.sheetSubtitle}>Choose what you want to record.</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close fund actions"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {actions.map(action => (
              <TouchableOpacity
                key={action.label}
                style={styles.actionRow}
                onPress={() => choose(action)}
                activeOpacity={0.78}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name={action.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.actionBody}>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                  <Text style={styles.actionDescription}>{action.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 20,
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.24,
      shadowRadius: 10,
      elevation: 8,
    },
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    sheet: {
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
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sheetTitle: {
      fontSize: 20,
      lineHeight: 25,
      fontFamily: fonts.inter.extraBold,
      color: colors.textPrimary,
    },
    sheetSubtitle: {
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
    actionRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    actionBody: {
      flex: 1,
    },
    actionLabel: {
      fontSize: 14,
      lineHeight: 19,
      fontFamily: fonts.inter.bold,
      color: colors.textPrimary,
    },
    actionDescription: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: fonts.inter.regular,
      color: colors.textMuted,
    },
  })
}
