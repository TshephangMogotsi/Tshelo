import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { supabase } from '../../lib/supabase'
import { hapticSuccess, hapticError } from '../../lib/haptics'
import { describeSender } from '../../lib/smsWatcher'
import { PROVIDER_LABELS } from '../../lib/providers'
import { HomeItem, KIND_LABELS, formatMoney } from './home/helpers'
import { loadHomeItems } from './home/loadHomeItems'
import type { AppColors } from '../../theme/themes'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'AssignContribution'>
  route: RouteProp<MainStackParamList, 'AssignContribution'>
}

export default function AssignContributionScreen({ navigation, route }: Props) {
  const { detected } = route.params
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const requireOnline = useRequireOnline()
  const styles = makeStyles(colors)

  const [items, setItems]           = useState<HomeItem[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSaving, setIsSaving]     = useState(false)

  useFocusEffect(
    useCallback(() => {
      let active = true
      if (userId) {
        loadHomeItems(userId)
          .then(loaded => { if (active) setItems(loaded) })
          .catch(() => { if (active) setItems([]) })
      }
      return () => { active = false }
    }, [userId])
  )

  // Contributions attach to funds — events qualify only via a linked fund
  const options = (items ?? []).filter(i => i.fundId && i.status.toLowerCase() === 'active')
  const unlinkedEvents = (items ?? []).filter(i => !i.fundId)
  const selected = options.find(i => i.id === selectedId) ?? null

  async function handleSave() {
    if (!selected?.fundId || isSaving) return
    if (!requireOnline()) return
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in again before recording a contribution.')
      return
    }

    setIsSaving(true)
    try {
      const now = new Date().toISOString()

      const { error } = await supabase.from('contributions').insert({
        fund_id:           selected.fundId,
        contributor_name:  detected.senderName ?? detected.senderPhone ?? 'Unknown (SMS)',
        contributor_phone: detected.senderPhone ?? '',
        tagged_by:         userId,
        amount:            detected.amount,
        currency_code:     selected.currency_code,
        payment_method:    detected.provider,
        detected_via:      'sms',
        status:            'confirmed',
        confirmed_by:      userId,
        confirmed_at:      now,
        notes:             [detected.reference ? `Ref: ${detected.reference}` : null, detected.smsBody.trim()]
          .filter(Boolean)
          .join('\n'),
      })

      if (error) {
        hapticError()
        Alert.alert('Could not save contribution', error.message)
        return
      }

      hapticSuccess()
      navigation.replace('FundDetail', { fundId: selected.fundId })
    } catch (e) {
      hapticError()
      Alert.alert('Could not save contribution', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const canSave = selected != null && !isSaving

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Money received</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.detectedCard}>
          <Text style={styles.detectedAmount}>{formatMoney(detected.amount, 'BWP')}</Text>
          <Text style={styles.detectedFrom}>from {describeSender(detected)}</Text>
          <View style={styles.detectedMetaRow}>
            {detected.provider && (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{PROVIDER_LABELS[detected.provider]}</Text>
              </View>
            )}
            {detected.reference && (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>Ref {detected.reference}</Text>
              </View>
            )}
          </View>
          <Text style={styles.smsSnippet} numberOfLines={2}>“{detected.smsBody.trim()}”</Text>
        </View>

        <Text style={styles.sectionTitle}>ADD TO</Text>

        {items === null ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : options.length === 0 ? (
          <Text style={styles.emptyText}>
            You have no active funds yet. Create a fund or an event with a fund first, then record this contribution from its page.
          </Text>
        ) : (
          options.map(item => {
            const isSelected = item.id === selectedId
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                activeOpacity={0.8}
                onPress={() => setSelectedId(isSelected ? null : item.id)}
              >
                <Text style={styles.optionEmoji}>{item.emoji}</Text>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.optionKind}>{KIND_LABELS[item.kind]}</Text>
                </View>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isSelected ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>
            )
          })
        )}

        {unlinkedEvents.length > 0 && (
          <Text style={styles.unlinkedNote}>
            {unlinkedEvents.length === 1
              ? `“${unlinkedEvents[0].title}” has no fund linked, so it can't receive contributions.`
              : 'Events without a linked fund are not shown — they can\'t receive contributions.'}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          activeOpacity={canSave ? 0.86 : 1}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>
            {isSaving ? 'Saving...' : selected ? `Add to ${selected.title}` : 'Select a fund or event'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    scroll: { paddingHorizontal: 20, paddingBottom: 24 },
    detectedCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      marginBottom: 28,
    },
    detectedAmount: {
      fontSize: 40,
      fontWeight: '900',
      color: colors.success,
    },
    detectedFrom: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 6,
    },
    detectedMetaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    metaChip: {
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    metaChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    smsSnippet: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 14,
      fontStyle: 'italic',
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1,
      color: colors.textMuted,
      marginBottom: 12,
    },
    loading: { marginTop: 24 },
    emptyText: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: 'transparent',
      padding: 16,
      marginBottom: 10,
    },
    optionCardSelected: { borderColor: colors.primary },
    optionEmoji: { fontSize: 26, marginRight: 14 },
    optionInfo: { flex: 1 },
    optionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    optionKind: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    unlinkedNote: { fontSize: 13, color: colors.textMuted, marginTop: 8, lineHeight: 19 },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 28,
      backgroundColor: colors.background,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 17,
      alignItems: 'center',
    },
    saveBtnDisabled: { backgroundColor: colors.disabled },
    saveBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  })
}
