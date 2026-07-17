import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useTheme } from '../../../context/ThemeContext'
import { useAuth } from '../../../context/AuthContext'
import type { AppColors } from '../../../theme/themes'
import { supabase } from '../../../lib/supabase'
import { hapticError, hapticSuccess } from '../../../lib/haptics'
import { makeCommonStyles } from '../recordExpense/common'
import type { FundDetail, Member, MemberRole } from './types'

type EditableFund = Pick<FundDetail, 'title' | 'goal_amount' | 'contribution_deadline' | 'is_private' | 'status'>

type Props = {
  visible: boolean
  fund: FundDetail
  members: Member[]
  onClose: () => void
  onFundSaved: (changes: Partial<EditableFund>) => void
  onMemberRoleChanged: (memberId: string, role: MemberRole) => void
  onClosed: () => void
}

function validDate(value: string) {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export default function FundSettingsModal({
  visible, fund, members, onClose, onFundSaved, onMemberRoleChanged, onClosed,
}: Props) {
  const { colors } = useTheme()
  const { userId } = useAuth()
  const common = makeCommonStyles(colors)
  const styles = makeStyles(colors)
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [deadline, setDeadline] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [changingMemberId, setChangingMemberId] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    setTitle(fund.title)
    setGoal(String(fund.goal_amount || ''))
    setDeadline(fund.contribution_deadline ?? '')
    setIsPrivate(fund.is_private)
  }, [visible, fund.id])

  const parsedGoal = goal ? Number(goal) : 0
  const isValid = title.trim().length >= 3 && Number.isFinite(parsedGoal) && parsedGoal >= 0 && validDate(deadline)
  const manageableMembers = members.filter(member => member.role !== 'owner')

  async function saveFund() {
    if (!isValid || isSaving) return
    setIsSaving(true)
    const changes = {
      title: title.trim(),
      goal_amount: parsedGoal,
      contribution_deadline: deadline || null,
      is_private: isPrivate,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('funds').update(changes).eq('id', fund.id).select('id')
    setIsSaving(false)
    if (error || !data?.length) {
      hapticError()
      Alert.alert('Could not save settings', error?.message ?? 'Only the fund owner can change these settings.')
      return
    }
    hapticSuccess()
    onFundSaved(changes)
    Alert.alert('Settings saved', 'The fund details have been updated.')
  }

  async function changeRole(member: Member, role: MemberRole) {
    if (changingMemberId) return
    setChangingMemberId(member.id)
    const { data, error } = await supabase.from('fund_members').update({
      role,
      promoted_by: role === 'admin' ? userId : null,
      promoted_to_admin_at: role === 'admin' ? new Date().toISOString() : null,
    }).eq('id', member.id).select('id')
    setChangingMemberId(null)
    if (error || !data?.length) {
      Alert.alert('Could not change role', error?.message ?? 'Only the fund owner can manage admins.')
      return
    }
    hapticSuccess()
    onMemberRoleChanged(member.id, role)
  }

  function confirmRoleChange(member: Member) {
    const nextRole: MemberRole = member.role === 'admin' ? 'member' : 'admin'
    Alert.alert(
      nextRole === 'admin' ? 'Make admin?' : 'Remove admin access?',
      nextRole === 'admin'
        ? `${member.display_name} will be able to record and edit contributions and expenses, and manage members.`
        : `${member.display_name} will return to normal member access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: nextRole === 'admin' ? 'Make Admin' : 'Remove Admin', onPress: () => changeRole(member, nextRole) },
      ]
    )
  }

  function confirmCloseFund() {
    Alert.alert(
      'Close this fund?',
      'Closing stops active collection and marks the fund as completed. Its records and history remain available.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Close Fund', style: 'destructive', onPress: closeFund },
      ]
    )
  }

  async function closeFund() {
    if (isSaving) return
    setIsSaving(true)
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('funds').update({ status: 'closed', closed_at: now, updated_at: now }).eq('id', fund.id).select('id')
    setIsSaving(false)
    if (error || !data?.length) {
      hapticError()
      Alert.alert('Could not close fund', error?.message ?? 'Only the fund owner can close this fund.')
      return
    }
    hapticSuccess()
    onClosed()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={common.modalOverlay}>
          <View style={[common.modalSheet, styles.sheet]}>
            <View style={styles.header}>
              <Text style={common.modalTitle}>Fund Settings</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>×</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionTitle}>Fund details</Text>
              <Text style={styles.label}>Fund name</Text>
              <TextInput style={[common.input, styles.inputSpacing]} value={title} onChangeText={setTitle} editable={!isSaving} maxLength={200} />

              <Text style={styles.label}>Goal amount</Text>
              <TextInput
                style={[common.input, styles.inputSpacing]}
                value={goal}
                onChangeText={text => setGoal(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                editable={!isSaving}
              />

              <Text style={styles.label}>Contribution deadline</Text>
              <TextInput
                style={[common.input, styles.inputSpacing, deadline.length > 0 && !validDate(deadline) && styles.invalidInput]}
                value={deadline}
                onChangeText={setDeadline}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                editable={!isSaving}
              />

              <View style={styles.privacyRow}>
                <View style={styles.privacyText}>
                  <Text style={styles.privacyTitle}>Private fund</Text>
                  <Text style={styles.privacyDescription}>Only approved members can view fund records.</Text>
                </View>
                <Switch value={isPrivate} onValueChange={setIsPrivate} disabled={isSaving} trackColor={{ true: colors.primary }} />
              </View>

              <TouchableOpacity
                style={[common.primaryButton, styles.saveButton, isValid && !isSaving && common.buttonActive]}
                onPress={saveFund}
                disabled={!isValid || isSaving}
              >
                {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[common.primaryButtonText, isValid && common.primaryButtonTextActive]}>Save Fund Details</Text>}
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Admins</Text>
              {manageableMembers.length === 0 ? <Text style={styles.emptyText}>No other members to manage.</Text> : manageableMembers.map(member => (
                <View key={member.id} style={styles.memberRow}>
                  <View style={styles.memberBody}>
                    <Text style={styles.memberName}>{member.display_name}</Text>
                    <Text style={styles.memberRole}>{member.role === 'admin' ? 'Admin' : 'Member'}</Text>
                  </View>
                  {changingMemberId === member.id ? <ActivityIndicator color={colors.primary} /> : (
                    <TouchableOpacity style={styles.roleButton} onPress={() => confirmRoleChange(member)}>
                      <Text style={styles.roleButtonText}>{member.role === 'admin' ? 'Remove admin' : 'Make admin'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <Text style={[styles.sectionTitle, styles.dangerTitle]}>Fund status</Text>
              <TouchableOpacity style={styles.closeFundButton} onPress={confirmCloseFund} disabled={isSaving || fund.status === 'closed'}>
                <Text style={styles.closeFundText}>{fund.status === 'closed' ? 'Fund is closed' : 'Close Fund'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    sheet: { maxHeight: '92%', minHeight: '70%' },
    header: { position: 'relative' },
    closeButton: { position: 'absolute', right: 0, top: -8, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    closeText: { fontSize: 28, color: colors.textMuted },
    sectionTitle: { fontSize: 12, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 8, marginBottom: 14 },
    label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 },
    inputSpacing: { marginBottom: 16 },
    invalidInput: { borderColor: colors.error },
    privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginBottom: 16 },
    privacyText: { flex: 1 },
    privacyTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    privacyDescription: { marginTop: 3, fontSize: 12, color: colors.textMuted },
    saveButton: { marginBottom: 24 },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    memberBody: { flex: 1 },
    memberName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    memberRole: { marginTop: 2, fontSize: 11, color: colors.textMuted },
    roleButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7 },
    roleButtonText: { fontSize: 11, fontWeight: '800', color: colors.primary },
    emptyText: { fontSize: 13, color: colors.textMuted, marginBottom: 18 },
    dangerTitle: { color: colors.error, marginTop: 28 },
    closeFundButton: { alignItems: 'center', borderWidth: 1, borderColor: colors.error, borderRadius: 18, paddingVertical: 13, marginBottom: 24 },
    closeFundText: { fontSize: 13, fontWeight: '800', color: colors.error },
  })
}
