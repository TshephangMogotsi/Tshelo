import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { supabase } from '../../../lib/supabase'
import { formatMoney } from './types'
import type { AuditEntry } from './ActivityLogModal'

type Props = {
  entry: AuditEntry | null
  actorName: string
  currencyCode: string
  onClose: () => void
}

type RelatedRecord = Record<string, unknown> | null

const LABELS: Record<string, string> = {
  contributor_name: 'Contributor', description: 'Item', vendor_name: 'Vendor', amount: 'Amount',
  category: 'Category', payment_method: 'Payment method', reference_number: 'Reference',
  receipt_number: 'Receipt number', receipt_url: 'Receipt', status: 'Status', is_refunded: 'Refunded',
  role: 'Role', name: 'Member', title: 'Fund name', goal_amount: 'Goal',
  contribution_deadline: 'Deadline', is_private: 'Privacy', related_contribution_id: 'Related contribution',
  related_expense_id: 'Related expense', notes: 'Notes',
}

function labelFor(key: string) {
  return LABELS[key] ?? key.replace(/_/g, ' ').replace(/^./, value => value.toUpperCase())
}

export default function ActivityDetailsModal({ entry, actorName, currencyCode, onClose }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [related, setRelated] = useState<RelatedRecord>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!entry || !['contribution', 'expense'].includes(entry.entity_type)) {
      setRelated(null)
      return
    }
    let active = true
    setIsLoading(true)
    const query = entry.entity_type === 'contribution'
      ? supabase.from('contributions').select('contributor_name, amount, payment_method, reference_number, receipt_number, status, is_refunded, notes').eq('id', entry.entity_id).maybeSingle()
      : supabase.from('expenses').select('description, vendor_name, amount, category, receipt_url, related_contribution_id, related_expense_id, notes').eq('id', entry.entity_id).maybeSingle()
    query.then(({ data }) => {
      if (!active) return
      setRelated((data as RelatedRecord) ?? null)
      setIsLoading(false)
    })
    return () => { active = false }
  }, [entry?.id])

  if (!entry) return null
  const keys = Array.from(new Set([...Object.keys(entry.old_values ?? {}), ...Object.keys(entry.new_values ?? {})]))
    .filter(key => key !== 'item_name')
  const relatedKeys = Object.keys(related ?? {}).filter(key => related?.[key] !== null && related?.[key] !== '')

  function value(key: string, raw: unknown) {
    if (raw === null || raw === undefined || raw === '') return '—'
    if (key === 'amount' || key === 'goal_amount') return formatMoney(Number(raw), currencyCode)
    if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
    return String(raw)
  }

  return (
      <View style={styles.overlay}>
        <View style={styles.details}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}><Text style={styles.backText}>←</Text></TouchableOpacity>
            <Text style={styles.title}>Activity Details</Text>
            <View style={styles.spacer} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{actorName}</Text>
              <Text style={styles.summaryText}>{entry.action} {entry.entity_type}</Text>
              <Text style={styles.time}>{new Date(entry.created_at).toLocaleString('en-BW')}</Text>
            </View>

            {keys.length > 0 && <Text style={styles.sectionTitle}>Recorded changes</Text>}
            {keys.map(key => (
              <View key={key} style={styles.detailRow}>
                <Text style={styles.label}>{labelFor(key)}</Text>
                {entry.old_values && key in entry.old_values && (
                  <Text style={styles.oldValue}>Before: {value(key, entry.old_values[key])}</Text>
                )}
                {entry.new_values && key in entry.new_values && (
                  <Text style={styles.newValue}>After: {value(key, entry.new_values[key])}</Text>
                )}
              </View>
            ))}

            {isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : relatedKeys.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Current record</Text>
                {relatedKeys.map(key => (
                  <View key={key} style={styles.currentRow}>
                    <Text style={styles.currentLabel}>{labelFor(key)}</Text>
                    <Text style={styles.currentValue} selectable>{value(key, related?.[key])}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 20,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    details: { flex: 1, padding: 20 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 22, color: colors.textPrimary },
    title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '900', color: colors.textPrimary },
    spacer: { width: 38 },
    summary: { borderRadius: 14, padding: 14, marginBottom: 20, backgroundColor: colors.background },
    summaryTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
    summaryText: { marginTop: 3, fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize' },
    time: { marginTop: 4, fontSize: 11, color: colors.textMuted },
    sectionTitle: { marginTop: 4, marginBottom: 8, fontSize: 12, fontWeight: '900', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
    detailRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
    label: { fontSize: 12, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    oldValue: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through' },
    newValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
    currentRow: { flexDirection: 'row', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
    currentLabel: { width: 120, fontSize: 12, fontWeight: '700', color: colors.textMuted },
    currentValue: { flex: 1, fontSize: 12, color: colors.textPrimary },
    loader: { marginVertical: 24 },
  })
}
