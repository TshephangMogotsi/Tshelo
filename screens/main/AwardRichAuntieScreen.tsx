import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { supabase } from '../../lib/supabase'
import { hapticError, hapticSuccess } from '../../lib/haptics'
import type { AppColors } from '../../theme/themes'
import { initials, RICH_AUNTIE_REASONS, type RichAuntieReasonCode } from './richAuntie/reasons'
import { useFundPermissions } from '../../lib/useFundPermissions'
import LoadingOverlay from '../../components/LoadingOverlay'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'AwardRichAuntie'>
  route: RouteProp<MainStackParamList, 'AwardRichAuntie'>
}

type EligibleItem = { id: string; title: string }

export default function AwardRichAuntieScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const requireOnline = useRequireOnline()
  const styles = makeStyles(colors)
  const { fundId, memberUserId, memberName } = route.params

  const [reasonCode, setReasonCode] = useState<RichAuntieReasonCode | null>(null)
  const [customReason, setCustomReason] = useState('')
  const [notifyMember, setNotifyMember] = useState(true)
  const [eligibleItems, setEligibleItems] = useState<EligibleItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { can, isLoading: permissionsLoading } = useFundPermissions(fundId)
  const canAwardRecognition = can('award_recognition')
  const permissionAlerted = useRef(false)

  useEffect(() => {
    if (permissionsLoading || canAwardRecognition || permissionAlerted.current) return
    permissionAlerted.current = true
    Alert.alert(
      'Recognition access required',
      'You do not have permission to award Rich Auntie recognition for this fund.',
      [{ text: 'Go back', onPress: () => navigation.goBack() }],
    )
  }, [canAwardRecognition, navigation, permissionsLoading])

  useEffect(() => {
    let active = true
    Promise.all([
      supabase
        .from('fund_sponsorship_item_progress')
        .select('id, title')
        .eq('fund_id', fundId)
        .eq('claimed_by_user_id', memberUserId)
        .in('status', ['funded', 'fulfilled']),
      supabase
        .from('rich_auntie_awards')
        .select('sponsorship_item_id')
        .eq('fund_id', fundId)
        .eq('recipient_user_id', memberUserId),
    ]).then(([itemsResult, awardsResult]) => {
      if (!active) return
      const awardedIds = new Set((awardsResult.data ?? []).map(row => row.sponsorship_item_id).filter(Boolean))
      setEligibleItems((itemsResult.data ?? []).filter(item => !awardedIds.has(item.id)))
    })
    return () => { active = false }
  }, [fundId, memberUserId])

  const selectedPreset = RICH_AUNTIE_REASONS.find(reason => reason.code === reasonCode)
  const reasonLabel = reasonCode === 'custom' ? customReason.trim() : selectedPreset?.label ?? ''
  const canSave = Boolean(reasonCode && reasonLabel.length >= 2 && userId)

  async function award() {
    if (!canAwardRecognition || !canSave || isSaving || !userId || !requireOnline()) return
    setIsSaving(true)
    const { data, error } = await supabase
      .from('rich_auntie_awards')
      .insert({
        fund_id: fundId,
        recipient_user_id: memberUserId,
        sponsorship_item_id: selectedItemId,
        reason_code: reasonCode,
        reason_label: reasonLabel,
        awarded_by: userId,
        notify_member: notifyMember,
      })
      .select('id')
      .single()
    setIsSaving(false)

    if (error || !data) {
      hapticError()
      Alert.alert('Could not award Rich Auntie', error?.message ?? 'Please try again.')
      return
    }
    hapticSuccess()
    navigation.replace('RichAuntieCelebration', { awardId: data.id })
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Award Rich Auntie</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(memberName)}</Text>
            <View style={styles.crownBadge}><Text style={styles.crownText}>♛</Text></View>
          </View>
          <Text style={styles.memberName}>{memberName}</Text>

          <Text style={styles.label}>Why are they a Rich Auntie?</Text>
          <View style={styles.reasonGrid}>
            {RICH_AUNTIE_REASONS.map(reason => {
              const selected = reasonCode === reason.code
              return (
                <TouchableOpacity
                  key={reason.code}
                  style={[styles.reasonChip, selected && styles.reasonChipSelected]}
                  onPress={() => setReasonCode(reason.code)}
                >
                  <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{reason.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={styles.orLabel}>Or write your own</Text>
          <TextInput
            style={[styles.input, reasonCode === 'custom' && styles.inputActive]}
            value={customReason}
            onChangeText={value => { setCustomReason(value); setReasonCode('custom') }}
            onFocus={() => setReasonCode('custom')}
            placeholder="e.g. Paid for photography"
            placeholderTextColor={colors.textMuted}
            maxLength={200}
          />

          {eligibleItems.length > 0 && (
            <>
              <Text style={styles.label}>Link a funded item <Text style={styles.optional}>(optional)</Text></Text>
              <View style={styles.itemList}>
                {eligibleItems.map(item => {
                  const selected = selectedItemId === item.id
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.itemChip, selected && styles.itemChipSelected]}
                      onPress={() => setSelectedItemId(selected ? null : item.id)}
                    >
                      <Ionicons name={selected ? 'checkmark-circle' : 'gift-outline'} size={17} color={selected ? colors.primary : colors.textMuted} />
                      <Text style={[styles.itemText, selected && { color: colors.primary }]}>{item.title}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </>
          )}

          <View style={styles.notifyRow}>
            <View style={styles.notifyBody}>
              <Text style={styles.notifyTitle}>Notify the member</Text>
              <Text style={styles.notifyHint}>They’ll get a celebration message</Text>
            </View>
            <Switch
              value={notifyMember}
              onValueChange={setNotifyMember}
              trackColor={{ false: colors.disabled, true: colors.primaryMid }}
              thumbColor="#FFFFFF"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.awardButton, canSave && !isSaving && styles.awardButtonActive]}
            onPress={award}
            disabled={!canSave || isSaving}
          >
            {isSaving
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={[styles.awardButtonText, canSave && styles.awardButtonTextActive]}>♛ Award Rich Auntie</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {permissionsLoading && <LoadingOverlay />}
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    content: { paddingHorizontal: 22, paddingBottom: 28 },
    avatar: {
      alignSelf: 'center',
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 5,
    },
    avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
    crownBadge: {
      position: 'absolute',
      right: -4,
      bottom: 0,
      width: 27,
      height: 27,
      borderRadius: 14,
      backgroundColor: '#F4A300',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    crownText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    memberName: { textAlign: 'center', marginTop: 12, marginBottom: 24, fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    label: { fontSize: 13, fontWeight: '800', color: colors.textPrimary, marginBottom: 9, marginTop: 17 },
    optional: { fontWeight: '400', color: colors.textMuted },
    reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    reasonChip: {
      width: '48%',
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 23,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
    },
    reasonChipSelected: { borderColor: '#F4A300', backgroundColor: '#FFF7D6' },
    reasonText: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    reasonTextSelected: { color: '#B87300', fontWeight: '800' },
    orLabel: { marginTop: 12, marginBottom: 6, fontSize: 11, color: colors.textMuted },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 13,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: colors.textPrimary,
    },
    inputActive: { borderColor: colors.primary },
    itemList: { gap: 8 },
    itemChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    itemChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    itemText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    notifyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 24,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    notifyBody: { flex: 1 },
    notifyTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
    notifyHint: { marginTop: 3, fontSize: 12, color: colors.textMuted },
    footer: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },
    awardButton: {
      alignItems: 'center',
      borderRadius: 26,
      backgroundColor: colors.disabled,
      paddingVertical: 16,
    },
    awardButtonActive: { backgroundColor: '#F4A300' },
    awardButtonText: { color: colors.disabledText, fontSize: 15, fontWeight: '900' },
    awardButtonTextActive: { color: '#FFFFFF' },
  })
}
