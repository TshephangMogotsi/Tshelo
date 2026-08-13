import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTheme } from '../../../context/ThemeContext'
import { useAuth } from '../../../context/AuthContext'
import { useRequireOnline } from '../../../context/ConnectivityContext'
import { supabase } from '../../../lib/supabase'
import { hapticError, hapticSuccess } from '../../../lib/haptics'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import type { SponsorshipItem } from './types'
import { formatMoney } from './types'

const SPONSOR_INTRO_DISMISSED_KEY = 'tshelo:sponsor-intro-dismissed'

type Props = {
  fundId: string
  currencyCode: string
  goalAmount: number
  canManageSponsorships: boolean
  canRecordContributions: boolean
  canRecordExpenses: boolean
  isFundActive: boolean
  items: SponsorshipItem[]
  onItemsChange: (items: SponsorshipItem[]) => void
  onRecordPayment: (item: SponsorshipItem) => void
  onRecordPurchase: (item: SponsorshipItem, direct: boolean) => void
}

function statusLabel(item: SponsorshipItem, userId: string | null) {
  if (item.status === 'open') return 'Available'
  if (item.status === 'claimed') {
    return item.claimed_by_user_id === userId
      ? 'Claimed by you'
      : `Claimed by ${item.sponsor_name ?? 'a member'}`
  }
  if (item.status === 'funded') return `Funded by ${item.sponsor_name ?? 'a member'}`
  if (item.status === 'fulfilled') return 'Purchased'
  return 'Cancelled'
}

export default function SponsorshipBoard({
  fundId,
  currencyCode,
  goalAmount,
  canManageSponsorships,
  canRecordContributions,
  canRecordExpenses,
  isFundActive,
  items,
  onItemsChange,
  onRecordPayment,
  onRecordPurchase,
}: Props) {
  const { colors } = useTheme()
  const { userId } = useAuth()
  const requireOnline = useRequireOnline()
  const styles = makeStyles(colors)

  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    let active = true
    setShowIntro(false)
    if (!userId) return () => { active = false }

    AsyncStorage.getItem(`${SPONSOR_INTRO_DISMISSED_KEY}:${userId}`)
      .then(value => {
        if (active) setShowIntro(value !== 'true')
      })
      .catch(() => {
        if (active) setShowIntro(true)
      })

    return () => { active = false }
  }, [userId])

  function dismissIntro() {
    setShowIntro(false)
    if (userId) {
      void AsyncStorage.setItem(`${SPONSOR_INTRO_DISMISSED_KEY}:${userId}`, 'true')
    }
  }

  const activeItems = items.filter(item => item.status !== 'cancelled')
  const assignedGoal = activeItems.reduce((sum, item) => sum + item.target_amount, 0)
  const availableGoal = Math.max(goalAmount - assignedGoal, 0)
  const parsedAmount = Number(amount)
  const createValid =
    title.trim().length >= 2
    && Number.isFinite(parsedAmount)
    && parsedAmount > 0
    && parsedAmount <= availableGoal

  async function createItem() {
    if (!canManageSponsorships || !isFundActive || !createValid || isCreating || !userId || !requireOnline()) return
    setIsCreating(true)
    const { data, error } = await supabase
      .from('fund_sponsorship_items')
      .insert({
        fund_id: fundId,
        title: title.trim(),
        description: description.trim() || null,
        target_amount: parsedAmount,
        created_by: userId,
      })
      .select('id, fund_id, title, description, category, target_amount, status, claimed_by_user_id, claimed_at, funded_at, fulfilled_at, linked_expense_id, created_at')
      .single()
    setIsCreating(false)

    if (error || !data) {
      hapticError()
      Alert.alert('Could not create item', error?.message ?? 'Please try again.')
      return
    }

    hapticSuccess()
    onItemsChange([...items, {
      ...data,
      target_amount: Number(data.target_amount),
      allocated_amount: 0,
      outstanding_amount: Number(data.target_amount),
      sponsor_name: null,
    } as SponsorshipItem])
    setTitle('')
    setDescription('')
    setAmount('')
    setShowCreate(false)
  }

  function confirmClaim(item: SponsorshipItem) {
    if (!isFundActive) return
    Alert.alert(
      `Sponsor ${item.title}?`,
      `You are committing to cover the full ${formatMoney(item.target_amount, currencyCode)}. The organiser will match your payment to this item.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Claim item', onPress: () => claimItem(item) },
      ],
    )
  }

  async function claimItem(item: SponsorshipItem) {
    if (!isFundActive || !userId || workingId || !requireOnline()) return
    setWorkingId(item.id)
    const { data, error } = await supabase.rpc('claim_sponsorship_item', { p_item_id: item.id })
    setWorkingId(null)

    if (error || !data) {
      hapticError()
      Alert.alert('Could not claim item', error?.message ?? 'Another member may have claimed it.')
      return
    }

    hapticSuccess()
    onItemsChange(items.map(current => current.id === item.id ? {
      ...current,
      status: 'claimed',
      claimed_by_user_id: userId,
      sponsor_name: 'You',
      claimed_at: data.claimed_at ?? new Date().toISOString(),
    } : current))
  }

  function confirmRelease(item: SponsorshipItem) {
    if (!isFundActive) return
    Alert.alert(
      'Release this item?',
      'It will become available for another member to sponsor.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Release', style: 'destructive', onPress: () => releaseItem(item) },
      ],
    )
  }

  async function releaseItem(item: SponsorshipItem) {
    if (!isFundActive || workingId || !requireOnline()) return
    setWorkingId(item.id)
    const { error } = await supabase.rpc('release_sponsorship_item', { p_item_id: item.id })
    setWorkingId(null)
    if (error) {
      hapticError()
      Alert.alert('Could not release item', error.message)
      return
    }
    onItemsChange(items.map(current => current.id === item.id ? {
      ...current,
      status: 'open',
      claimed_by_user_id: null,
      sponsor_name: null,
      claimed_at: null,
    } : current))
  }

  function confirmCancel(item: SponsorshipItem) {
    if (!canManageSponsorships || !isFundActive) return
    Alert.alert(
      'Cancel sponsorship item?',
      'Cancelled items no longer reserve part of the fund goal.',
      [
        { text: 'Keep item', style: 'cancel' },
        { text: 'Cancel item', style: 'destructive', onPress: () => cancelItem(item) },
      ],
    )
  }

  async function cancelItem(item: SponsorshipItem) {
    if (!canManageSponsorships || !isFundActive) return
    if (workingId || !requireOnline()) return
    setWorkingId(item.id)
    const { error } = await supabase
      .from('fund_sponsorship_items')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('fund_id', fundId)
    setWorkingId(null)

    if (error) {
      hapticError()
      Alert.alert('Could not cancel item', error.message)
      return
    }
    onItemsChange(items.map(current => current.id === item.id
      ? { ...current, status: 'cancelled', claimed_by_user_id: null, sponsor_name: null, claimed_at: null }
      : current
    ))
  }

  return (
    <>
      {showIntro && (
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="gift-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.introBody}>
            <Text style={styles.introTitle}>Sponsor something the fund needs</Text>
            <Text style={styles.introText}>
              Claim one whole item. When your payment arrives, the organiser will allocate it here.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.introDismiss}
            onPress={dismissIntro}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Dismiss sponsorship information"
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.goalRow}>
        <View>
          <Text style={styles.goalLabel}>Goal assigned to items</Text>
          <Text style={styles.goalValue}>{formatMoney(assignedGoal, currencyCode)}</Text>
        </View>
        <View style={styles.goalRight}>
          <Text style={styles.goalLabel}>Still unassigned</Text>
          <Text style={styles.goalValue}>{formatMoney(availableGoal, currencyCode)}</Text>
        </View>
      </View>

      {canManageSponsorships && isFundActive && availableGoal > 0 && (
        <TouchableOpacity style={styles.addButton} onPress={() => setShowCreate(true)} activeOpacity={0.82}>
          <Ionicons name="add-circle-outline" size={19} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add sponsorship item</Text>
        </TouchableOpacity>
      )}

      {activeItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎁</Text>
          <Text style={styles.emptyTitle}>No sponsorship items yet</Text>
          <Text style={styles.emptyText}>
            The organiser can turn parts of the fund goal into items members can sponsor.
          </Text>
        </View>
      ) : (
        activeItems.map(item => {
          const progress = item.target_amount > 0
            ? Math.min(item.allocated_amount / item.target_amount, 1)
            : 0
          const isMine = item.claimed_by_user_id === userId
          const isWorking = workingId === item.id
          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemTop}>
                <View style={styles.itemIcon}>
                  <Ionicons
                    name={item.status === 'open' ? 'gift-outline' : item.status === 'claimed' ? 'bookmark' : 'checkmark-circle'}
                    size={20}
                    color={item.status === 'open' ? colors.primary : item.status === 'claimed' ? colors.accent : colors.success}
                  />
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
                </View>
                <Text style={styles.itemAmount}>{formatMoney(item.target_amount, currencyCode)}</Text>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <View style={styles.statusRow}>
                <Text style={[
                  styles.statusText,
                  item.status === 'open' && { color: colors.primary },
                  item.status === 'funded' && { color: colors.success },
                ]}>
                  {statusLabel(item, userId)}
                </Text>
                {item.allocated_amount > 0 && (
                  <Text style={styles.allocatedText}>
                    {formatMoney(item.allocated_amount, currencyCode)} received
                  </Text>
                )}
              </View>

              {isWorking ? (
                <ActivityIndicator color={colors.primary} style={styles.actionLoader} />
              ) : item.status === 'open' && isFundActive && !canManageSponsorships ? (
                <TouchableOpacity style={styles.claimButton} onPress={() => confirmClaim(item)}>
                  <Text style={styles.claimButtonText}>Sponsor this item</Text>
                </TouchableOpacity>
              ) : item.status === 'claimed' && isMine && isFundActive ? (
                <TouchableOpacity style={styles.secondaryButton} onPress={() => confirmRelease(item)}>
                  <Text style={styles.secondaryButtonText}>Release item</Text>
                </TouchableOpacity>
              ) : item.status === 'claimed' && canManageSponsorships && isFundActive ? (
                <View style={styles.organiserActions}>
                  {canRecordContributions && (
                    <TouchableOpacity style={styles.claimButton} onPress={() => onRecordPayment(item)}>
                      <Text style={styles.claimButtonText}>Record payment received</Text>
                    </TouchableOpacity>
                  )}
                  {canRecordExpenses && (
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => onRecordPurchase(item, true)}>
                      <Text style={styles.secondaryButtonText}>They paid directly · Record receipt</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}

              {canManageSponsorships && isFundActive && item.status === 'open' && (
                <TouchableOpacity style={styles.cancelLink} onPress={() => confirmCancel(item)}>
                  <Text style={styles.cancelLinkText}>Cancel item</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        })
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={styles.modalFlex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New sponsorship item</Text>
              <View style={styles.modalClose} />
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.fieldLabel}>What does the fund need?</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Tent"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="sentences"
                editable={!isCreating}
              />

              <Text style={styles.fieldLabel}>Amount ({currencyCode === 'BWP' ? 'P' : currencyCode})</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={value => setAmount(value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                editable={!isCreating}
              />
              <Text style={styles.fieldHint}>
                Up to {formatMoney(availableGoal, currencyCode)} of the goal is still unassigned.
              </Text>

              <Text style={styles.fieldLabel}>Description <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Add useful details for the sponsor"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                editable={!isCreating}
              />

              <TouchableOpacity
                style={[styles.saveButton, createValid && !isCreating && styles.saveButtonActive]}
                onPress={createItem}
                disabled={!createValid || isCreating}
              >
                {isCreating
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={[styles.saveButtonText, createValid && styles.saveButtonTextActive]}>Create item</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    introCard: {
      flexDirection: 'row',
      gap: 12,
      padding: 15,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
      marginTop: 4,
      marginBottom: 14,
    },
    introIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    introBody: { flex: 1 },
    introDismiss: {
      width: 28,
      height: 28,
      marginTop: -5,
      marginRight: -5,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    introTitle: { fontSize: 15, fontFamily: fonts.inter.extraBold, color: colors.primary },
    introText: { marginTop: 4, fontSize: 12, lineHeight: 18, fontFamily: fonts.inter.regular, color: colors.textSecondary },
    goalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
    },
    goalRight: { alignItems: 'flex-end' },
    goalLabel: { fontSize: 11, fontFamily: fonts.inter.regular, color: colors.textMuted },
    goalValue: { marginTop: 3, fontSize: 15, fontFamily: fonts.inter.extraBold, color: colors.textPrimary },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: colors.primary,
      borderRadius: 24,
      paddingVertical: 13,
      marginBottom: 14,
    },
    addButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.inter.extraBold },
    empty: { alignItems: 'center', paddingVertical: 42, paddingHorizontal: 24 },
    emptyEmoji: { fontSize: 38, marginBottom: 10 },
    emptyTitle: { fontSize: 16, fontFamily: fonts.inter.extraBold, color: colors.textPrimary },
    emptyText: { marginTop: 6, fontSize: 13, lineHeight: 19, fontFamily: fonts.inter.regular, textAlign: 'center', color: colors.textMuted },
    itemCard: {
      backgroundColor: colors.surface,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 15,
      marginBottom: 12,
    },
    itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    itemIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemBody: { flex: 1 },
    itemTitle: { fontSize: 15, fontFamily: fonts.inter.extraBold, color: colors.textPrimary },
    itemDescription: { marginTop: 3, fontSize: 12, lineHeight: 17, fontFamily: fonts.inter.regular, color: colors.textSecondary },
    itemAmount: { fontSize: 14, fontFamily: fonts.inter.extraBold, color: colors.textPrimary },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginTop: 14,
    },
    progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.success },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    statusText: { flex: 1, fontSize: 11, fontFamily: fonts.inter.bold, color: colors.accent },
    allocatedText: { fontSize: 11, fontFamily: fonts.inter.regular, color: colors.textMuted },
    actionLoader: { marginTop: 13 },
    organiserActions: { marginTop: 1 },
    claimButton: {
      alignItems: 'center',
      borderRadius: 22,
      backgroundColor: colors.primary,
      paddingVertical: 11,
      marginTop: 13,
    },
    claimButtonText: { color: '#FFFFFF', fontSize: 13, fontFamily: fonts.inter.extraBold },
    secondaryButton: {
      alignItems: 'center',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      marginTop: 13,
    },
    secondaryButtonText: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.inter.bold },
    cancelLink: { alignItems: 'center', paddingTop: 11 },
    cancelLinkText: { color: colors.error, fontSize: 12, fontFamily: fonts.inter.bold },
    modalSafe: { flex: 1, backgroundColor: colors.background },
    modalFlex: { flex: 1 },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 17, fontFamily: fonts.inter.extraBold, color: colors.textPrimary },
    modalContent: { padding: 22 },
    fieldLabel: { fontSize: 13, fontFamily: fonts.inter.bold, color: colors.textPrimary, marginBottom: 7, marginTop: 17 },
    optional: { fontFamily: fonts.inter.regular, color: colors.textMuted },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 15,
      backgroundColor: colors.surface,
      paddingHorizontal: 15,
      paddingVertical: 14,
      fontSize: 15,
      fontFamily: fonts.inter.regular,
      color: colors.textPrimary,
    },
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    fieldHint: { marginTop: 6, fontSize: 11, fontFamily: fonts.inter.regular, color: colors.textMuted },
    saveButton: {
      alignItems: 'center',
      borderRadius: 26,
      backgroundColor: colors.disabled,
      paddingVertical: 15,
      marginTop: 28,
    },
    saveButtonActive: { backgroundColor: colors.primary },
    saveButtonText: { fontSize: 15, fontFamily: fonts.inter.extraBold, color: colors.disabledText },
    saveButtonTextActive: { color: '#FFFFFF' },
  })
}
