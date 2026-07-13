import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { supabase } from '../../../lib/supabase'
import { makeCommonStyles } from '../recordExpense/common'
import { CATEGORIES } from '../recordExpense/categories'
import { formatMoney } from './types'

type AuditEntry = {
  id:          string
  user_id:     string | null
  action:      string
  entity_type: string
  old_values:  Record<string, unknown> | null
  new_values:  Record<string, unknown> | null
  created_at:  string
}

type Props = {
  visible: boolean
  fundId: string
  currencyCode: string
  memberNames: Map<string, string>
  onClose: () => void
}

const ACTION_LABELS: Record<string, string> = {
  created: 'added',
  updated: 'edited',
  deleted: 'removed',
}

const FIELD_LABELS: Record<string, string> = {
  description: 'Item',
  vendor_name: 'Vendor',
  amount:      'Amount',
  category:    'Category',
}

export default function ActivityLogModal({ visible, fundId, currencyCode, memberNames, onClose }: Props) {
  const { colors } = useTheme()
  const common = makeCommonStyles(colors)
  const styles = makeStyles(colors)

  const [entries, setEntries]     = useState<AuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    let active = true

    async function loadLog() {
      setIsLoading(true)
      setLoadError(null)

      const { data, error } = await supabase
        .from('audit_log')
        .select('id, user_id, action, entity_type, old_values, new_values, created_at')
        .eq('fund_id', fundId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!active) return
      if (error) {
        setLoadError(error.message)
      } else {
        setEntries((data ?? []) as AuditEntry[])
      }
      setIsLoading(false)
    }

    loadLog()
    return () => { active = false }
  }, [visible, fundId])

  function formatValue(field: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—'
    if (field === 'amount') return formatMoney(Number(value), currencyCode)
    if (field === 'category') {
      return CATEGORIES.find(c => c.value === value)?.label ?? String(value)
    }
    return String(value)
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString('en-BW', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  function changedFields(entry: AuditEntry): string[] {
    // item_name mirrors description; skip it in the display
    return Object.keys(entry.new_values ?? entry.old_values ?? {})
      .filter(k => k in FIELD_LABELS)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={common.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[common.modalSheet, styles.sheet]}>
          <Text style={common.modalTitle}>Fund Activity</Text>

          {isLoading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : loadError ? (
            <View style={styles.centerWrap}>
              <Text style={styles.emptyText}>Could not load activity: {loadError}</Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.centerWrap}>
              <Text style={styles.emptyEmoji}>🕓</Text>
              <Text style={styles.emptyText}>
                No activity recorded yet. New and edited expenses will show up here.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {entries.map(entry => {
                const actorName = (entry.user_id && memberNames.get(entry.user_id)) ?? 'A member'
                const verb = ACTION_LABELS[entry.action] ?? entry.action
                const fields = changedFields(entry)

                return (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={styles.entryDot} />
                    <View style={styles.entryBody}>
                      <Text style={styles.entryHeadline}>
                        <Text style={styles.entryActor}>{actorName}</Text> {verb} an expense
                      </Text>
                      <Text style={styles.entryTime}>{formatTime(entry.created_at)}</Text>

                      {entry.action === 'updated' && fields.map(field => (
                        <View key={field} style={styles.changeLine}>
                          <Text style={styles.changeField}>{FIELD_LABELS[field]}</Text>
                          <Text style={styles.changeValues} numberOfLines={2}>
                            <Text style={styles.changeOld}>{formatValue(field, entry.old_values?.[field])}</Text>
                            {'  →  '}
                            <Text style={styles.changeNew}>{formatValue(field, entry.new_values?.[field])}</Text>
                          </Text>
                        </View>
                      ))}

                      {entry.action === 'created' && entry.new_values ? (
                        <Text style={styles.entryDetail} numberOfLines={1}>
                          {formatValue('description', entry.new_values.description)}
                          {' · '}
                          {formatValue('amount', entry.new_values.amount)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )
              })}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    sheet: {
      maxHeight: '80%',
      minHeight: 280,
    },
    centerWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      gap: 10,
    },
    emptyEmoji: {
      fontSize: 28,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    entryRow: {
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    entryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 6,
      flexShrink: 0,
    },
    entryBody: {
      flex: 1,
    },
    entryHeadline: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    entryActor: {
      fontWeight: '700',
    },
    entryTime: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      marginBottom: 4,
    },
    entryDetail: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    changeLine: {
      marginTop: 4,
    },
    changeField: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 1,
    },
    changeValues: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    changeOld: {
      textDecorationLine: 'line-through',
      color: colors.textMuted,
    },
    changeNew: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
  })
}
