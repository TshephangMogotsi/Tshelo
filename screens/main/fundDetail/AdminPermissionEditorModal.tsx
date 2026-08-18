import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Switch, Text,
  TouchableOpacity, View,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { api } from '../../../lib/api'
import { toApiUiError } from '../../../lib/apiScreen'
import { hapticError, hapticSuccess } from '../../../lib/haptics'
import {
  FUND_PERMISSION_CATEGORIES,
  FUND_PERMISSION_DEFINITIONS,
  FUND_PERMISSION_PRESETS,
  matchingFundPermissionPreset,
  type FundPermission,
  type FundPermissionPresetId,
} from '../../../lib/fundPermissions'
import type { Member } from './types'

type Props = {
  fundId: string
  visible: boolean
  member: Member | null
  initialPermissions: readonly FundPermission[]
  isLoading: boolean
  onClose: () => void
  onSaved: (memberId: string, permissions: FundPermission[]) => void
  onRemoved: (memberId: string) => void
}

type SelectionMode = FundPermissionPresetId | 'custom'

export default function AdminPermissionEditorModal({
  fundId,
  visible,
  member,
  initialPermissions,
  isLoading,
  onClose,
  onSaved,
  onRemoved,
}: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [selected, setSelected] = useState<Set<FundPermission>>(new Set())
  const [mode, setMode] = useState<SelectionMode>('contributions_assistant')
  const [isSaving, setIsSaving] = useState(false)
  const isExistingAdmin = member?.role === 'admin'

  useEffect(() => {
    if (!visible || !member || isLoading) return
    const nextPermissions = initialPermissions.length
      ? [...initialPermissions]
      : [...FUND_PERMISSION_PRESETS[0].permissions]
    setSelected(new Set(nextPermissions))
    setMode(matchingFundPermissionPreset(nextPermissions))
  }, [visible, member?.id, isLoading, initialPermissions])

  const permissionCount = selected.size
  const groupedDefinitions = useMemo(() => FUND_PERMISSION_CATEGORIES.map(category => ({
    ...category,
    permissions: FUND_PERMISSION_DEFINITIONS.filter(definition => definition.category === category.id),
  })), [])

  function choosePreset(presetId: FundPermissionPresetId) {
    const preset = FUND_PERMISSION_PRESETS.find(candidate => candidate.id === presetId)
    if (!preset || isSaving) return
    setSelected(new Set(preset.permissions))
    setMode(preset.id)
  }

  function togglePermission(permission: FundPermission) {
    if (isSaving) return
    setSelected(previous => {
      const next = new Set(previous)
      if (next.has(permission)) next.delete(permission)
      else next.add(permission)
      setMode(matchingFundPermissionPreset([...next]))
      return next
    })
  }

  async function savePermissions() {
    if (!member || isSaving) return
    if (!permissionCount) {
      Alert.alert('Choose a permission', 'An admin needs at least one permission. Choose an ability or keep them as a member.')
      return
    }
    setIsSaving(true)
    const permissions = FUND_PERMISSION_DEFINITIONS
      .map(definition => definition.key)
      .filter(permission => selected.has(permission))
    try {
      await api.funds.configureAdmin(fundId, member.id, { permissions })
    } catch (error) {
      setIsSaving(false)
      hapticError()
      Alert.alert('Could not save admin access', toApiUiError(error).message)
      return
    }
    setIsSaving(false)
    hapticSuccess()
    onSaved(member.id, permissions)
  }

  function confirmRemoveAdmin() {
    if (!member || isSaving) return
    Alert.alert(
      'Remove admin access?',
      `${member.display_name} will keep normal member access but lose all delegated admin abilities.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove Admin', style: 'destructive', onPress: removeAdmin },
      ],
    )
  }

  async function removeAdmin() {
    if (!member || isSaving) return
    setIsSaving(true)
    try {
      await api.funds.removeAdmin(fundId, member.id)
    } catch (error) {
      setIsSaving(false)
      hapticError()
      Alert.alert('Could not remove admin access', toApiUiError(error).message)
      return
    }
    setIsSaving(false)
    hapticSuccess()
    onRemoved(member.id)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton} disabled={isSaving}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{isExistingAdmin ? 'Admin permissions' : 'Make admin'}</Text>
              <Text style={styles.subtitle}>{member?.display_name ?? 'Member'}</Text>
            </View>
            <View style={styles.headerButton} />
          </View>

          {isLoading ? (
            <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              <View style={styles.notice}>
                <Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} />
                <Text style={styles.noticeText}>Choose only what this person needs. They cannot manage admins, change fund settings, issue refunds, close the fund, or transfer ownership.</Text>
              </View>

              <Text style={styles.sectionLabel}>Quick roles</Text>
              {FUND_PERMISSION_PRESETS.map(preset => {
                const isSelected = mode === preset.id
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                    onPress={() => choosePreset(preset.id)}
                    disabled={isSaving}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.presetBody}>
                      <Text style={styles.presetTitle}>{preset.label}</Text>
                      <Text style={styles.presetDescription}>{preset.description}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}

              <View style={styles.customHeading}>
                <View>
                  <Text style={styles.sectionLabel}>Custom permissions</Text>
                  <Text style={styles.selectionCount}>{permissionCount} selected</Text>
                </View>
                {mode === 'custom' && <View style={styles.customBadge}><Text style={styles.customBadgeText}>Custom</Text></View>}
              </View>

              {groupedDefinitions.map(group => (
                <View key={group.id} style={styles.permissionGroup}>
                  <Text style={styles.groupLabel}>{group.label}</Text>
                  {group.permissions.map((definition, index) => (
                    <View key={definition.key} style={[styles.permissionRow, index > 0 && styles.permissionBorder]}>
                      <View style={styles.permissionCopy}>
                        <Text style={styles.permissionTitle}>{definition.label}</Text>
                        <Text style={styles.permissionDescription}>{definition.description}</Text>
                      </View>
                      <Switch
                        value={selected.has(definition.key)}
                        onValueChange={() => togglePermission(definition.key)}
                        disabled={isSaving}
                        trackColor={{ false: colors.disabled, true: colors.primary }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  ))}
                </View>
              ))}

              <TouchableOpacity
                style={[styles.saveButton, (!permissionCount || isSaving) && styles.saveButtonDisabled]}
                onPress={savePermissions}
                disabled={!permissionCount || isSaving}
              >
                {isSaving ? <ActivityIndicator color="#FFFFFF" /> : (
                  <Text style={styles.saveButtonText}>{isExistingAdmin ? 'Save Permissions' : 'Make Admin'}</Text>
                )}
              </TouchableOpacity>

              {isExistingAdmin && (
                <TouchableOpacity style={styles.removeButton} onPress={confirmRemoveAdmin} disabled={isSaving}>
                  <Text style={styles.removeButtonText}>Remove Admin Access</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
    sheet: { maxHeight: '94%', minHeight: '76%', backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1, alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '900', color: colors.textPrimary },
    subtitle: { marginTop: 2, fontSize: 12, color: colors.textMuted },
    loading: { flex: 1, minHeight: 360, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 20, paddingBottom: 36 },
    notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, padding: 14, backgroundColor: colors.primaryLight, marginBottom: 24 },
    noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.textSecondary },
    sectionLabel: { fontSize: 12, fontWeight: '900', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
    presetCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 9 },
    presetCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    radio: { width: 20, height: 20, borderWidth: 2, borderColor: colors.disabledText, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    radioSelected: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    presetBody: { flex: 1 },
    presetTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
    presetDescription: { marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
    customHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
    selectionCount: { marginTop: -5, marginBottom: 12, fontSize: 12, color: colors.textMuted },
    customBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.primaryLight },
    customBadgeText: { fontSize: 10, fontWeight: '900', color: colors.primary },
    permissionGroup: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 14, marginBottom: 12 },
    groupLabel: { paddingTop: 13, paddingBottom: 5, fontSize: 10, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.7 },
    permissionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    permissionBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    permissionCopy: { flex: 1 },
    permissionTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
    permissionDescription: { marginTop: 3, fontSize: 11, lineHeight: 16, color: colors.textMuted },
    saveButton: { minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, marginTop: 10 },
    saveButtonDisabled: { backgroundColor: colors.disabled },
    saveButtonText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
    removeButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    removeButtonText: { fontSize: 13, fontWeight: '800', color: colors.error },
  })
}
