import { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'
import LoadingOverlay from '../../components/LoadingOverlay'
import { supabase } from '../../lib/supabase'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

type CalendarEvent = {
  id: string
  title: string
  emoji: string
  date: string
  time: string | null
  venue: string
  linkedFundId: string | null
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-BW', { month: 'long', year: 'numeric' })
}

function scheduleLabel(value: string) {
  return parseDate(value).toLocaleDateString('en-BW', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function timeLabel(value: string | null) {
  if (!value) return 'Time to be confirmed'
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${`${minute}`.padStart(2, '0')} ${suffix}`
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

export default function ActivityScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const today = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const hasLoadedRef = useRef(false)
  const lastLoadedAtRef = useRef(0)

  useFocusEffect(useCallback(() => {
    let active = true
    async function loadEvents() {
      if (hasLoadedRef.current && Date.now() - lastLoadedAtRef.current < 30_000) return
      if (!hasLoadedRef.current) setIsLoading(true)
      setLoadError(false)
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name, event_emoji, event_date, event_time, venue_name, linked_fund_id, status')
          .is('deleted_at', null)
          .eq('status', 'active')
          .order('event_date', { ascending: true })
          .order('event_time', { ascending: true })
        if (!active) return
        if (error) throw error
        setEvents((data ?? []).map(row => ({
          id: row.id,
          title: row.name,
          emoji: row.event_emoji ?? '🎉',
          date: row.event_date,
          time: row.event_time ?? null,
          venue: row.venue_name?.trim() || 'Venue to be confirmed',
          linkedFundId: row.linked_fund_id ?? null,
        })))
        hasLoadedRef.current = true
        lastLoadedAtRef.current = Date.now()
      } catch {
        if (active && !hasLoadedRef.current) setLoadError(true)
      } finally {
        if (active) setIsLoading(false)
      }
    }
    loadEvents()

    return () => { active = false }
  }, []))

  const days = useMemo(() => calendarDays(month), [month])
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach(event => map.set(event.date, [...(map.get(event.date) ?? []), event]))
    return map
  }, [events])

  const visibleEvents = useMemo(() => {
    if (selectedDate) return eventsByDate.get(selectedDate) ?? []
    return events.filter(event => {
      const date = parseDate(event.date)
      return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
    })
  }, [events, eventsByDate, month, selectedDate])

  function moveMonth(offset: number) {
    setMonth(previous => new Date(previous.getFullYear(), previous.getMonth() + offset, 1))
    setSelectedDate(null)
  }

  function showToday() {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(dateKey(today))
  }

  const listTitle = selectedDate ? scheduleLabel(selectedDate) : `${monthLabel(month)} schedule`

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Events</Text>
          <Text style={styles.headerSubtitle}>{events.length} scheduled</Text>
        </View>
        <TouchableOpacity style={styles.todayButton} onPress={showToday} activeOpacity={0.8}>
          <Ionicons name="today-outline" size={16} color={colors.primary} />
          <Text style={styles.todayText}>Today</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <TouchableOpacity style={styles.monthButton} onPress={() => moveMonth(-1)}>
              <Ionicons name="chevron-back" size={19} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedDate(null)}>
              <Text style={styles.monthTitle}>{monthLabel(month)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.monthButton} onPress={() => moveMonth(1)}>
              <Ionicons name="chevron-forward" size={19} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdays}>
            {WEEKDAYS.map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}
          </View>

          <View style={styles.calendarGrid}>
            {days.map(date => {
              const key = dateKey(date)
              const inMonth = date.getMonth() === month.getMonth()
              const selected = selectedDate === key
              const isToday = key === dateKey(today)
              const dayEvents = eventsByDate.get(key) ?? []
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.dayCell}
                  onPress={() => {
                    if (!inMonth) setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
                    setSelectedDate(key)
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.dayNumberWrap, isToday && styles.todayCell, selected && styles.selectedCell]}>
                    <Text style={[
                      styles.dayNumber,
                      !inMonth && styles.dayNumberMuted,
                      isToday && styles.todayNumber,
                      selected && styles.selectedNumber,
                    ]}>{date.getDate()}</Text>
                  </View>
                  <View style={styles.dotRow}>
                    {dayEvents.slice(0, 3).map((event, index) => (
                      <View key={`${event.id}-${index}`} style={[styles.eventDot, event.linkedFundId && styles.fundEventDot]} />
                    ))}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={styles.eventDot} /><Text style={styles.legendText}>Event</Text></View>
            <View style={styles.legendItem}><View style={[styles.eventDot, styles.fundEventDot]} /><Text style={styles.legendText}>Event + Fund</Text></View>
          </View>
        </View>

        <View style={styles.scheduleHeader}>
          <View>
            <Text style={styles.scheduleTitle}>{listTitle}</Text>
            <Text style={styles.scheduleCount}>{visibleEvents.length} event{visibleEvents.length === 1 ? '' : 's'}</Text>
          </View>
          {selectedDate && (
            <TouchableOpacity onPress={() => setSelectedDate(null)}><Text style={styles.showMonthText}>Show month</Text></TouchableOpacity>
          )}
        </View>

        {loadError ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Couldn’t load your events</Text>
            <Text style={styles.emptyText}>Check your connection and try again.</Text>
          </View>
        ) : visibleEvents.length === 0 && !isLoading ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nothing scheduled</Text>
            <Text style={styles.emptyText}>{selectedDate ? 'There are no events on this day.' : 'There are no events in this month.'}</Text>
          </View>
        ) : (
          <View style={styles.eventList}>
            {visibleEvents.map(event => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventRow}
                onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                activeOpacity={0.82}
              >
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeMonth}>{parseDate(event.date).toLocaleDateString('en-BW', { month: 'short' }).toUpperCase()}</Text>
                  <Text style={styles.dateBadgeDay}>{parseDate(event.date).getDate()}</Text>
                </View>
                <View style={styles.eventBody}>
                  <View style={styles.eventTitleRow}>
                    <Text style={styles.eventEmoji}>{event.emoji}</Text>
                    <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                  </View>
                  <View style={styles.eventMetaRow}>
                    <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.eventMeta} numberOfLines={1}>{timeLabel(event.time)} · {event.venue}</Text>
                  </View>
                  <View style={styles.kindBadge}><Text style={styles.kindText}>{event.linkedFundId ? 'Event + Fund' : 'Event'}</Text></View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {isLoading && !hasLoadedRef.current && <LoadingOverlay />}
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
    },
    heading: { fontSize: 28, fontFamily: fonts.display.bold, color: colors.heading },
    headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    todayButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8,
    },
    todayText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    scroll: { paddingHorizontal: 20, paddingBottom: 72 },
    calendarCard: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 20, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10,
      marginBottom: 22,
    },
    monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    monthButton: {
      width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.background,
    },
    monthTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
    weekdays: { flexDirection: 'row', marginBottom: 4 },
    weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.textMuted },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: { width: `${100 / 7}%`, height: 45, alignItems: 'center', paddingTop: 2 },
    dayNumberWrap: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    todayCell: { borderWidth: 1, borderColor: colors.primary },
    selectedCell: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayNumber: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
    dayNumberMuted: { color: colors.textMuted, opacity: 0.42 },
    todayNumber: { color: colors.primary, fontWeight: '800' },
    selectedNumber: { color: '#FFFFFF', fontWeight: '800' },
    dotRow: { flexDirection: 'row', gap: 2, height: 5, marginTop: 3 },
    eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
    fundEventDot: { backgroundColor: '#0F9F8D' },
    legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, marginTop: 3 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendText: { fontSize: 10, color: colors.textMuted },
    scheduleHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
    scheduleTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
    scheduleCount: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    showMonthText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    eventList: { gap: 8 },
    eventRow: {
      minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    },
    dateBadge: { width: 42, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
    dateBadgeMonth: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5, color: colors.primary },
    dateBadgeDay: { fontSize: 18, lineHeight: 21, fontWeight: '800', color: colors.textPrimary },
    eventBody: { flex: 1, minWidth: 0 },
    eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    eventEmoji: { fontSize: 16 },
    eventTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.textPrimary },
    eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
    eventMeta: { flex: 1, fontSize: 11, color: colors.textMuted },
    kindBadge: { alignSelf: 'flex-start', backgroundColor: colors.background, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    kindText: { fontSize: 9, fontWeight: '700', color: colors.textSecondary },
    emptyState: { alignItems: 'center', paddingVertical: 42, paddingHorizontal: 24 },
    emptyTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginTop: 10 },
    emptyText: { fontSize: 12, lineHeight: 17, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  })
}
