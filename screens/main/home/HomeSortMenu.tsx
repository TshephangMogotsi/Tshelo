import { useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import {
  HOME_SORT_LABELS,
  HomeItemKind,
  HomeSortOrder,
  HomeStatusFilter,
  KIND_LABELS,
} from './helpers'

type Props = {
  sortOrder: HomeSortOrder
  statusFilter: HomeStatusFilter
  kindFilter: 'all' | HomeItemKind
  availableKinds: HomeItemKind[]
  onSortChange: (value: HomeSortOrder) => void
  onStatusChange: (value: HomeStatusFilter) => void
  onKindChange: (value: 'all' | HomeItemKind) => void
}

type Anchor = {
  top: number
  right: number
}

const STATUS_OPTIONS: {
  value: HomeStatusFilter
  label: string
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { value: 'all', label: 'All', icon: 'apps-outline' },
  { value: 'active', label: 'Active', icon: 'play-circle-outline' },
  { value: 'closed', label: 'Closed', icon: 'checkmark-circle-outline' },
]

const SORT_OPTIONS: {
  value: HomeSortOrder
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { value: 'newest', icon: 'arrow-down-outline' },
  { value: 'oldest', icon: 'arrow-up-outline' },
]

export default function HomeSortMenu({
  sortOrder,
  statusFilter,
  kindFilter,
  availableKinds,
  onSortChange,
  onStatusChange,
  onKindChange,
}: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const buttonRef = useRef<View>(null)
  const [visible, setVisible] = useState(false)
  const [anchor, setAnchor] = useState<Anchor>({ top: 0, right: 20 })

  const filterCount = Number(statusFilter !== 'all') + Number(kindFilter !== 'all')
  const menuMaxHeight = Math.max(300, windowHeight - anchor.top - 24)

  function openMenu() {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({
        top: y + height + 7,
        right: Math.max(16, windowWidth - x - width),
      })
      setVisible(true)
    })
  }

  function clearFilters() {
    onStatusChange('all')
    onKindChange('all')
  }

  function Option({
    selected,
    icon,
    label,
    onPress,
  }: {
    selected: boolean
    icon: keyof typeof Ionicons.glyphMap
    label: string
    onPress: () => void
  }) {
    return (
      <TouchableOpacity
        style={[styles.option, selected && styles.optionSelected]}
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
      >
        <View style={styles.optionIcon}>
          <Ionicons name={icon} size={17} color={selected ? colors.primary : colors.textMuted} />
        </View>
        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
        {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
      </TouchableOpacity>
    )
  }

  return (
    <>
      <View ref={buttonRef} collapsable={false}>
        <TouchableOpacity
          style={[styles.filterButton, (visible || filterCount > 0) && styles.filterButtonActive]}
          onPress={openMenu}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Filter and sort items. ${filterCount} filters active.`}
          accessibilityState={{ expanded: visible }}
        >
          <Ionicons
            name="funnel-outline"
            size={18}
            color={visible || filterCount > 0 ? colors.primary : colors.textSecondary}
          />
          {filterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable
            style={[styles.menu, { top: anchor.top, right: anchor.right, maxHeight: menuMaxHeight }]}
            onPress={event => event.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuHeading}>FILTER & SORT</Text>
                {filterCount > 0 && (
                  <TouchableOpacity onPress={clearFilters} hitSlop={8}>
                    <Text style={styles.clearText}>Clear filters</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.sectionTitle}>STATUS</Text>
              {STATUS_OPTIONS.map(option => (
                <Option
                  key={option.value}
                  selected={statusFilter === option.value}
                  icon={option.icon}
                  label={option.label}
                  onPress={() => onStatusChange(option.value)}
                />
              ))}

              {availableKinds.length > 1 && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>TYPE</Text>
                  <Option
                    selected={kindFilter === 'all'}
                    icon="layers-outline"
                    label="All types"
                    onPress={() => onKindChange('all')}
                  />
                  {availableKinds.map(kind => (
                    <Option
                      key={kind}
                      selected={kindFilter === kind}
                      icon={kind === 'fund' ? 'wallet-outline' : kind === 'event' ? 'calendar-outline' : 'sparkles-outline'}
                      label={KIND_LABELS[kind]}
                      onPress={() => onKindChange(kind)}
                    />
                  ))}
                </>
              )}

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>SORT</Text>
              {SORT_OPTIONS.map(option => (
                <Option
                  key={option.value}
                  selected={sortOrder === option.value}
                  icon={option.icon}
                  label={HOME_SORT_LABELS[option.value]}
                  onPress={() => onSortChange(option.value)}
                />
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.doneButton} onPress={() => setVisible(false)} activeOpacity={0.82}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    filterButton: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterButtonActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    filterBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.background,
    },
    filterBadgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '900',
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(14, 10, 25, 0.16)',
    },
    menu: {
      position: 'absolute',
      width: 286,
      padding: 10,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#24173D',
      shadowOffset: { width: 0, height: 9 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
      elevation: 12,
    },
    menuHeader: {
      minHeight: 32,
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    menuHeading: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '900',
      letterSpacing: 1.1,
      color: colors.textPrimary,
    },
    clearText: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '800',
      color: colors.primary,
    },
    sectionTitle: {
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 4,
      fontSize: 9,
      lineHeight: 13,
      fontWeight: '900',
      letterSpacing: 1.1,
      color: colors.textMuted,
    },
    divider: {
      height: 1,
      marginHorizontal: 8,
      marginVertical: 7,
      backgroundColor: colors.border,
    },
    option: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 10,
      borderRadius: 11,
    },
    optionSelected: {
      backgroundColor: colors.primaryLight,
    },
    optionIcon: {
      width: 24,
      alignItems: 'center',
    },
    optionText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    optionTextSelected: {
      color: colors.primary,
      fontWeight: '800',
    },
    doneButton: {
      minHeight: 42,
      marginTop: 9,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    doneButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },
  })
}
