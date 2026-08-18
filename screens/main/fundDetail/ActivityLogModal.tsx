import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { api } from '../../../lib/api'
import { runApiRead } from '../../../lib/apiScreen'
import { makeCommonStyles } from '../recordExpense/common'
import { CATEGORIES } from '../recordExpense/categories'
import { formatMoney } from './types'
import ActivityDetailsModal from './ActivityDetailsModal'

export type AuditEntry = {
  id:          string
  entity_id:   string
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

type LogFilter = 'all' | 'contribution' | 'expense' | 'member' | 'fund' | 'edits'

const FILTERS: { id: LogFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'contribution', label: 'Contributions' },
  { id: 'expense', label: 'Expenses' },
  { id: 'member', label: 'Members' },
  { id: 'fund', label: 'Fund' },
  { id: 'edits', label: 'Edits' },
]

const ACTION_LABELS: Record<string, string> = {
  created: 'added',
  updated: 'edited',
  deleted: 'removed',
}

const FIELD_LABELS: Record<string, string> = {
  description: 'Item',
  vendor_name: 'Vendor',
  amount:      'Amount',
  pledged_amount: 'Pledged amount',
  category:    'Category',
  contributor_name: 'Contributor',
  payment_method: 'Payment method',
  reference_number: 'Reference',
  status: 'Status',
  is_refunded: 'Refunded',
  role: 'Role',
  name: 'Member',
  title: 'Fund name',
  goal_amount: 'Goal',
  contribution_deadline: 'Deadline',
  is_private: 'Privacy',
}

export default function ActivityLogModal({ visible, fundId, currencyCode, memberNames, onClose }: Props) {
  const { colors } = useTheme()
  const common = makeCommonStyles(colors)
  const styles = makeStyles(colors)

  const [entries, setEntries]     = useState<AuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<LogFilter>('all')
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null)

  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()

    async function loadLog() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const page = await runApiRead(call => api.funds.activity(fundId, { limit: 50 }, call), { signal: controller.signal })
        if (controller.signal.aborted) return
        setEntries(page.items as AuditEntry[])
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load fund activity.')
      }
      if (!controller.signal.aborted) setIsLoading(false)
    }

    void loadLog()
    return () => controller.abort()
  }, [visible, fundId])

  function formatValue(field: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—'
    if (field === 'amount' || field === 'goal_amount' || field === 'pledged_amount') return formatMoney(Number(value), currencyCode)
    if (field === 'is_private') return value ? 'Private' : 'Public'
    if (field === 'is_refunded') return value ? 'Yes' : 'No'
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

  const visibleEntries = entries.filter(entry => {
    if (filter === 'all') return true
    if (filter === 'edits') return entry.action === 'updated'
    return entry.entity_type === filter
  })

  function entityLabel(entry: AuditEntry) {
    if (entry.entity_type === 'contribution') return 'a contribution'
    if (entry.entity_type === 'member') return 'a member'
    if (entry.entity_type === 'fund') return 'fund details'
    return 'an expense'
  }

  function createdDetail(entry: AuditEntry): string | null {
    const values = entry.new_values
    if (!values) return null
    if (entry.entity_type === 'contribution') {
      return `${formatValue('contributor_name', values.contributor_name)} · ${formatValue('amount', values.amount)}`
    }
    if (entry.entity_type === 'expense') {
      return `${formatValue('description', values.description)} · ${formatValue('amount', values.amount)}`
    }
    if (entry.entity_type === 'member') {
      const memberId = typeof values.member_user_id === 'string' ? values.member_user_id : null
      return String(values.name || (memberId && memberNames.get(memberId)) || 'Member added')
    }
    return null
  }

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={common.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[common.modalSheet, styles.sheet]}>
          <Text style={common.modalTitle}>Fund Activity</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.filterChip, filter === item.id && styles.filterChipActive]}
                onPress={() => setFilter(item.id)}
              >
                <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {isLoading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : loadError ? (
            <View style={styles.centerWrap}>
              <Text style={styles.emptyText}>Could not load activity: {loadError}</Text>
            </View>
          ) : visibleEntries.length === 0 ? (
            <View style={styles.centerWrap}>
              <Text style={styles.emptyEmoji}>🕓</Text>
              <Text style={styles.emptyText}>
                {entries.length === 0 ? 'No fund activity recorded yet.' : 'No activity matches this filter.'}
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {visibleEntries.map(entry => {
                const actorName = (entry.user_id && memberNames.get(entry.user_id)) ?? 'A member'
                const verb = ACTION_LABELS[entry.action] ?? entry.action
                const fields = changedFields(entry)

                return (
                  <TouchableOpacity key={entry.id} style={styles.entryRow} onPress={() => setSelectedEntry(entry)} activeOpacity={0.75}>
                    <View style={styles.entryDot} />
                    <View style={styles.entryBody}>
                      <Text style={styles.entryHeadline}>
                        <Text style={styles.entryActor}>{actorName}</Text> {verb} {entityLabel(entry)}
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

                      {entry.action === 'created' && createdDetail(entry) ? (
                        <Text style={styles.entryDetail} numberOfLines={1}>
                          {createdDetail(entry)}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.entryChevron}>›</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}

          <ActivityDetailsModal
            fundId={fundId}
            entry={selectedEntry}
            actorName={(selectedEntry?.user_id && memberNames.get(selectedEntry.user_id)) ?? 'A member'}
            currencyCode={currencyCode}
            onClose={() => setSelectedEntry(null)}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
    </>
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
    filters: {
      gap: 8,
      paddingBottom: 10,
    },
    filterChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.surface,
    },
    filterChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    filterText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    filterTextActive: {
      color: '#FFFFFF',
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
    entryChevron: { alignSelf: 'center', fontSize: 24, color: colors.textMuted },
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
