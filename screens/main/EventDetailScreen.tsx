import { useCallback, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  Clipboard,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Calendar from 'expo-calendar'
import * as Contacts from 'expo-contacts'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'
import { supabase } from '../../lib/supabase'
import { mapsSearchUrl, normalizeMapsUrl } from '../../lib/maps'
import LoadingOverlay from '../../components/LoadingOverlay'
import type { Contribution, Expense } from './fundDetail/types'
import { isFundReadOnly } from './fundDetail/finance'
import { buildCalendarEventDetails } from './eventDetail/calendar'
import { parseEstimatedSpend, summarizeEventGuests } from './eventDetail/eventOnly'
import { loadMyFundPermissions } from '../../lib/useFundPermissions'
import type { FundPermission } from '../../lib/fundPermissions'
import { linkedEventCapabilities } from '../../lib/fundPermissionPolicy'
import FundDetailScreen from './FundDetailScreen'
import InviteDetailsModal from '../../components/InviteDetailsModal'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'EventDetail'>
  route: RouteProp<MainStackParamList, 'EventDetail'>
}

type EventTab = 'guests' | 'announcements' | 'budget'
type EventFundWorkspace = 'event' | 'fund'
type GuestStatus = 'confirmed' | 'pending' | 'declined'

type EventGuest = {
  id: string
  name: string
  status: GuestStatus
  plusOnes: number
}

type EventAnnouncement = {
  id: string
  authorId: string
  authorName: string
  title: string
  body: string
  createdAt: string
}

type EventView = {
  creatorId: string
  title: string
  status: string
  completedAt: string | null
  estimatedSpendAmount: number | null
  description: string | null
  date: string
  dateIso: string
  time: string | null
  endDateIso: string | null
  endTime: string | null
  venue: string
  venueMapLink: string | null
  venueSearchText: string
  confirmed: number
  pending: number
  declined: number
  shareCode: string | null
  rsvpLink: string
  budgetAmount: number | null
  budgetCurrency: string
  linkedFundId: string | null
}

type EmbeddedFund = {
  id: string
  ownerId: string
  title: string
  status: string
  currency: string
  goal: number
  contributions: number
  expenses: number
  code: string
  deadline: string | null
  isPrivate: boolean
}

const EVENT_HEADER_PURPLE = '#E8DDFF'
const INK = '#0D0D0D'
const MUTED = '#A1A1AA'
const BORDER = '#E4E4E7'
const EVENT_FIELDS = 'creator_id, name, description, event_date, event_time, event_end_date, event_end_time, venue_name, venue_address, share_code, linked_fund_id, currency_code, status, completed_at'
const EVENT_OUTCOME_FIELDS = `${EVENT_FIELDS}, estimated_spend_amount`

async function loadEventRow(eventId: string) {
  const result = await supabase
    .from('events')
    .select(EVENT_OUTCOME_FIELDS)
    .eq('id', eventId)
    .single()

  const missingOutcomeColumn = result.error?.code === '42703'
    || result.error?.message?.includes('estimated_spend_amount')
  if (!missingOutcomeColumn) return result

  const fallback = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('id', eventId)
    .single()

  return {
    ...fallback,
    data: fallback.data
      ? { ...fallback.data, estimated_spend_amount: null }
      : null,
  }
}

function displayEventDate(value?: string | null) {
  if (!value) return 'Date to be confirmed'
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString('en-BW', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatEventMoney(amount: number, currencyCode: string) {
  const symbol = currencyCode === 'BWP' ? 'P' : `${currencyCode} `
  return `${symbol}${Math.max(0, amount).toLocaleString('en-BW', { maximumFractionDigits: 0 })}`
}

function guestStatusLabel(status: GuestStatus) {
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'declined') return 'Declined'
  return 'Pending'
}

function announcementDate(value: string) {
  const date = new Date(value)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  if (sameDay) return date.toLocaleTimeString('en-BW', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('en-BW', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function EventDetailScreen({ navigation, route }: Props) {
  const { eventId } = route.params
  const { colors } = useTheme()
  const { userId } = useAuth()
  const styles = makeStyles(colors)
  const [event, setEvent] = useState<EventView | null>(null)
  const [eventGuests, setEventGuests] = useState<EventGuest[]>([])
  const [announcements, setAnnouncements] = useState<EventAnnouncement[]>([])
  const [activeTab, setActiveTab] = useState<EventTab>(route.params.tab ?? 'guests')
  const [workspace, setWorkspace] = useState<EventFundWorkspace>(route.params.workspace ?? 'event')
  const [fundWorkspaceExpanded, setFundWorkspaceExpanded] = useState(false)
  const [eventWorkspaceExpanded, setEventWorkspaceExpanded] = useState(false)
  const [overviewHeight, setOverviewHeight] = useState(0)
  const fundExpandProgress = useRef(new Animated.Value(0)).current
  const eventExpandProgress = useRef(new Animated.Value(0)).current
  const [isEventAdmin, setIsEventAdmin] = useState(false)
  const [showAnnouncementComposer, setShowAnnouncementComposer] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [fund, setFund] = useState<EmbeddedFund | null>(null)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isDeletingEvent, setIsDeletingEvent] = useState(false)
  const [isOpeningCalendar, setIsOpeningCalendar] = useState(false)
  const [showCloseEvent, setShowCloseEvent] = useState(false)
  const [estimatedSpend, setEstimatedSpend] = useState('')
  const [isClosingEvent, setIsClosingEvent] = useState(false)
  const [canLeaveEvent, setCanLeaveEvent] = useState(false)
  const [isLeavingEvent, setIsLeavingEvent] = useState(false)
  const [linkedFundPermissions, setLinkedFundPermissions] = useState<Set<FundPermission>>(new Set())
  const eventCapabilities = linkedEventCapabilities(isEventAdmin, linkedFundPermissions)
  const canManageGuests = eventCapabilities.manageGuests
  const canPostAnnouncements = eventCapabilities.postAnnouncements
  const canManageEventBudget = eventCapabilities.manageBudget

  useFocusEffect(useCallback(() => {
    let active = true

    async function loadEvent() {
      setIsLoading(true)
      setIsEventAdmin(false)
      setLinkedFundPermissions(new Set())
      const organiserResultPromise = userId
        ? supabase
          .from('event_organisers')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle()
        : Promise.resolve({ data: null, error: null })
      const [eventResult, guestsResult, budgetResult, announcementsResult, organiserResult] = await Promise.all([
        loadEventRow(eventId),
        supabase
          .from('event_guests')
          .select('id, user_id, guest_name, guest_phone, rsvp_status, plus_ones')
          .eq('event_id', eventId)
          .order('invited_at', { ascending: false }),
        supabase.from('event_budgets').select('total_budget, currency_code').eq('event_id', eventId).maybeSingle(),
        supabase
          .from('event_announcements')
          .select('id, author_id, author_name, title, body, created_at')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false }),
        organiserResultPromise,
      ])

      if (!active) return
      if (eventResult.error || !eventResult.data) {
        setIsLoading(false)
        Alert.alert('Could not load event', eventResult.error?.message ?? 'The event is unavailable.', [
          { text: 'Go back', onPress: () => navigation.goBack() },
        ])
        return
      }

      const row = eventResult.data
      const guests: EventGuest[] = (guestsResult.data ?? []).map(guest => ({
        id: guest.id,
        name: String(guest.guest_name?.trim() || guest.guest_phone?.trim() || 'Guest'),
        status: guest.rsvp_status === 'yes' || guest.rsvp_status === 'confirmed'
          ? 'confirmed'
          : guest.rsvp_status === 'no' || guest.rsvp_status === 'declined'
            ? 'declined'
            : 'pending',
        plusOnes: Math.max(0, Number(guest.plus_ones ?? 0)),
      }))
      const count = (status: GuestStatus) => guests.filter(guest => guest.status === status).length
      const budgetAmount = budgetResult.data ? Number(budgetResult.data.total_budget) : null
      const shareCode = row.share_code?.trim() || null
      const venueName = row.venue_name?.trim() || ''
      const venueAddress = row.venue_address?.trim() || ''
      const venueNameMapLink = normalizeMapsUrl(venueName)
      const venueAddressMapLink = normalizeMapsUrl(venueAddress)
      const venueMapLink = venueAddressMapLink ?? venueNameMapLink
      const venue = venueNameMapLink
        ? 'Map location'
        : venueName || (venueAddressMapLink ? 'Map location' : venueAddress) || 'Venue to be confirmed'

      setEventGuests(guests)
      setAnnouncements((announcementsResult.data ?? []).map(item => ({
        id: item.id,
        authorId: item.author_id,
        authorName: item.author_name,
        title: item.title,
        body: item.body,
        createdAt: item.created_at,
      })))
      setIsEventAdmin(row.creator_id === userId || Boolean(organiserResult.data))
      setCanLeaveEvent(
        row.creator_id !== userId
        && (Boolean(organiserResult.data) || (guestsResult.data ?? []).some(guest => guest.user_id === userId))
      )
      setEvent({
        creatorId: row.creator_id,
        title: row.name,
        status: row.status ?? 'active',
        completedAt: row.completed_at ?? null,
        estimatedSpendAmount: row.estimated_spend_amount == null ? null : Number(row.estimated_spend_amount),
        description: row.description ?? null,
        date: displayEventDate(row.event_date),
        dateIso: row.event_date,
        time: row.event_time ?? null,
        endDateIso: row.event_end_date ?? null,
        endTime: row.event_end_time ?? null,
        venue,
        venueMapLink,
        venueSearchText: venueAddressMapLink ? venueName : venueAddress || venueName,
        confirmed: count('confirmed'),
        pending: count('pending'),
        declined: count('declined'),
        shareCode,
        rsvpLink: shareCode ? `RSVP code: ${shareCode}` : 'RSVP link unavailable',
        budgetAmount: budgetAmount !== null && Number.isFinite(budgetAmount) ? budgetAmount : null,
        budgetCurrency: budgetResult.data?.currency_code ?? row.currency_code ?? 'BWP',
        linkedFundId: row.linked_fund_id ?? null,
      })
      if (!row.linked_fund_id) {
        setActiveTab(previous => previous === 'budget' ? 'guests' : previous)
      }

      if (row.linked_fund_id) {
        const [fundResult, contributionResult, expenseResult, permissionResult] = await Promise.all([
          supabase.from('funds').select('id, owner_id, title, status, currency_code, goal_amount, fund_code, contribution_deadline, is_private').eq('id', row.linked_fund_id).single(),
          supabase.from('contributions').select('id, contributor_name, amount, pledged_amount, payment_method, reference_number, detected_via, status, is_refunded, confirmed_at, notes').eq('fund_id', row.linked_fund_id).order('confirmed_at', { ascending: false }),
          supabase.from('expenses').select('id, vendor_name, description, category, amount, created_at, has_open_query, is_sponsored, sponsored_by_user_id, sponsored_by_name').eq('fund_id', row.linked_fund_id).is('deleted_at', null).order('created_at', { ascending: false }),
          loadMyFundPermissions(row.linked_fund_id).catch(() => new Set<FundPermission>()),
        ])
        if (!active) return

        const fundRow = fundResult.data
        const contributionRows = (contributionResult.data ?? []) as Contribution[]
        const expenseRows = (expenseResult.data ?? []) as Expense[]
        if (fundRow) {
          setFund({
            id: fundRow.id,
            ownerId: fundRow.owner_id,
            title: fundRow.title,
            status: fundRow.status,
            currency: fundRow.currency_code,
            goal: Number(fundRow.goal_amount ?? 0),
            contributions: contributionRows
              .filter(item => item.status === 'confirmed' && !item.is_refunded)
              .reduce((sum, item) => sum + Number(item.amount), 0),
            expenses: expenseRows
              .filter(item => !item.is_sponsored)
              .reduce((sum, item) => sum + Number(item.amount), 0),
            code: fundRow.fund_code,
            deadline: fundRow.contribution_deadline ?? null,
            isPrivate: fundRow.is_private ?? false,
          })
        } else {
          setFund(null)
        }
        setContributions(contributionRows)
        setExpenses(expenseRows)
        setLinkedFundPermissions(permissionResult)
      } else {
        setFund(null)
        setContributions([])
        setExpenses([])
        setLinkedFundPermissions(new Set())
      }

      setIsLoading(false)
    }

    loadEvent()
    return () => { active = false }
  }, [eventId, navigation, userId]))

  const shareMessage = event ? `You're invited to ${event.title}. ${event.rsvpLink}` : ''

  function copyEventInvite() {
    if (!event) return
    Clipboard.setString(event.shareCode ?? event.rsvpLink)
    Alert.alert('Copied', event.shareCode ? 'Event invite code copied.' : 'Event invite copied.')
  }

  async function addToCalendar() {
    if (!event || isOpeningCalendar) return

    const details = buildCalendarEventDetails({
      title: event.title,
      description: event.description,
      eventDate: event.dateIso,
      eventTime: event.time,
      eventEndDate: event.endDateIso,
      eventEndTime: event.endTime,
      venue: event.venue === 'Venue to be confirmed' ? null : event.venue,
      shareCode: event.shareCode,
    })

    if (!details) {
      Alert.alert('Calendar unavailable', 'This event does not have a valid date yet.')
      return
    }

    setIsOpeningCalendar(true)
    try {
      const isAvailable = await Calendar.isAvailableAsync()
      if (!isAvailable) {
        Alert.alert('Calendar unavailable', 'No compatible calendar app is available on this device.')
        return
      }

      const result = await Calendar.createEventInCalendarAsync(details)
      if (result.action === Calendar.CalendarDialogResultActions.saved) {
        Alert.alert('Added to calendar', `${event.title} was added to your selected calendar.`)
      }
    } catch (error) {
      Alert.alert(
        'Could not open calendar',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setIsOpeningCalendar(false)
    }
  }

  async function openEventLocation() {
    if (!event || event.venue === 'Venue to be confirmed') return

    const fallbackUrl = mapsSearchUrl(
      event.venueSearchText || event.venue,
      Platform.OS === 'ios' ? 'ios' : 'android',
    )
    const locationUrl = event.venueMapLink ?? fallbackUrl

    try {
      const canOpenLocation = await Linking.canOpenURL(locationUrl)
      if (canOpenLocation) {
        await Linking.openURL(locationUrl)
        return
      }

      if (locationUrl !== fallbackUrl && await Linking.canOpenURL(fallbackUrl)) {
        await Linking.openURL(fallbackUrl)
        return
      }

      Alert.alert('Maps unavailable', 'No compatible maps app is available on this device.')
    } catch {
      Alert.alert('Could not open Maps', 'Please try again or search for the venue directly in your maps app.')
    }
  }

  function confirmOpenEventLocation() {
    if (!event || event.venue === 'Venue to be confirmed') return
    Alert.alert(
      'Open location in Maps?',
      event.venue,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Maps', onPress: () => { void openEventLocation() } },
      ],
    )
  }

  async function publishAnnouncement() {
    const cleanTitle = announcementTitle.trim()
    const cleanBody = announcementBody.trim()
    if (!userId || !canPostAnnouncements || isPostingAnnouncement) return
    if (cleanTitle.length < 3) {
      Alert.alert('Add a title', 'Use a short title such as “Venue changed”.')
      return
    }
    if (cleanBody.length < 3) {
      Alert.alert('Add the details', 'Tell guests what changed and what they need to know.')
      return
    }

    setIsPostingAnnouncement(true)
    const { data, error } = await supabase
      .from('event_announcements')
      .insert({
        event_id: eventId,
        author_id: userId,
        title: cleanTitle,
        body: cleanBody,
      })
      .select('id, author_id, author_name, title, body, created_at')
      .single()
    setIsPostingAnnouncement(false)

    if (error || !data) {
      Alert.alert('Could not publish announcement', error?.message ?? 'Please try again.')
      return
    }

    setAnnouncements(previous => [{
      id: data.id,
      authorId: data.author_id,
      authorName: data.author_name,
      title: data.title,
      body: data.body,
      createdAt: data.created_at,
    }, ...previous])
    setAnnouncementTitle('')
    setAnnouncementBody('')
    setShowAnnouncementComposer(false)
    setActiveTab('announcements')
  }

  async function addEventFundOrganiser() {
    if (!fund || fund.ownerId !== userId) return
    const permission = await Contacts.requestPermissionsAsync()
    if (permission.status !== Contacts.PermissionStatus.GRANTED) {
      Alert.alert('Contacts permission needed', 'Allow contacts access to invite an Event + Fund organiser.')
      return
    }

    const contact = await Contacts.presentContactPickerAsync()
    if (!contact) return
    const phone = contact.phoneNumbers?.find(item => item.number)?.number
    const name = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Organiser'
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      Alert.alert('Phone number required', 'Choose a contact with a valid phone number.')
      return
    }

    const { error } = await supabase.rpc('invite_event_fund_organiser', {
      p_event_id: eventId,
      p_name: name,
      p_phone: phone,
    })
    Alert.alert(
      error ? 'Could not send invitation' : 'Invitation sent',
      error?.message ?? `${name} can accept the organiser invitation from Notifications.`
    )
  }

  function openCloseEvent() {
    if (!event || event.linkedFundId || !isEventAdmin || event.status === 'completed') return
    setEstimatedSpend(event.estimatedSpendAmount == null ? '' : String(event.estimatedSpendAmount))
    setShowCloseEvent(true)
  }

  async function closeEvent() {
    if (!event || event.linkedFundId || !isEventAdmin || isClosingEvent) return
    const amount = parseEstimatedSpend(estimatedSpend)
    if (Number.isNaN(amount)) {
      Alert.alert('Check the estimate', 'Enter a valid non-negative amount, or leave it blank.')
      return
    }

    setIsClosingEvent(true)
    const completedAt = new Date().toISOString()
    const { error } = await supabase
      .from('events')
      .update({
        status: 'completed',
        completed_at: completedAt,
        estimated_spend_amount: amount,
        updated_at: completedAt,
      })
      .eq('id', eventId)
      .is('linked_fund_id', null)
    setIsClosingEvent(false)

    if (error) {
      Alert.alert('Could not close event', error.message)
      return
    }

    setEvent(previous => previous ? {
      ...previous,
      status: 'completed',
      completedAt,
      estimatedSpendAmount: amount,
    } : previous)
    setShowCloseEvent(false)
    Alert.alert('Event completed', 'The guest list and announcements remain available for reference.')
  }

  function confirmDeleteEvent() {
    if (!event || event.creatorId !== userId || event.linkedFundId || isDeletingEvent) return
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"? The event, guest list, invitations, and announcements will no longer be available in the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteEvent },
      ]
    )
  }

  async function deleteEvent() {
    if (!event || event.creatorId !== userId || event.linkedFundId || isDeletingEvent) return
    setIsDeletingEvent(true)
    const { error } = await supabase.rpc('delete_event_only', { p_event_id: eventId })
    setIsDeletingEvent(false)
    if (error) {
      Alert.alert('Could not delete event', error.message)
      return
    }
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' as any }] })
  }

  function showMoreOptions() {
    if (!event) return

    // Event + Fund already exposes calendar, location, invitations,
    // announcements, budget, and fund navigation in the main interface. Keep
    // its overflow focused on actions that do not have another visible home.
    if (event.linkedFundId) {
      const eventFundOptions: any[] = []
      if (fund?.ownerId === userId && !isFundReadOnly(fund.status)) {
        eventFundOptions.push({ text: 'Add organiser', onPress: addEventFundOrganiser })
      }
      if (canLeaveEvent) {
        eventFundOptions.push({
          text: isLeavingEvent ? 'Leaving event…' : 'Leave event',
          style: 'destructive',
          onPress: confirmLeaveEvent,
        })
      }
      eventFundOptions.push({ text: 'Cancel', style: 'cancel' })
      Alert.alert('Event options', undefined, eventFundOptions)
      return
    }

    const options: any[] = [{ text: 'Add to calendar', onPress: addToCalendar }]
    if (event.venue !== 'Venue to be confirmed') {
      options.splice(1, 0, { text: 'Open location in Maps', onPress: confirmOpenEventLocation })
    }
    if (isEventAdmin) {
      options.push({ text: 'Manage guest list', onPress: () => navigation.navigate('GuestList', { eventId }) })
      if (event.status !== 'completed') {
        options.push(
          { text: 'New announcement', onPress: () => setShowAnnouncementComposer(true) },
          { text: 'Invite guests', onPress: () => setShowShareModal(true) },
        )
      }
    }
    if (!event.linkedFundId && event.creatorId === userId) {
      if (event.status !== 'completed') {
        options.push({ text: 'Close event', onPress: openCloseEvent })
      }
      options.push({ text: isDeletingEvent ? 'Deleting event…' : 'Delete event', style: 'destructive', onPress: confirmDeleteEvent })
    }
    if (canLeaveEvent) {
      options.push({ text: isLeavingEvent ? 'Leaving event…' : 'Leave event', style: 'destructive', onPress: confirmLeaveEvent })
    }
    options.push({ text: 'Cancel', style: 'cancel' })
    Alert.alert('Event options', undefined, options)
  }

  function confirmLeaveEvent() {
    if (!event || !canLeaveEvent || isLeavingEvent) return
    const linkedFundNote = event.linkedFundId
      ? '\n\nThis will not remove you from the linked contribution fund.'
      : ''
    Alert.alert(
      'Leave Event?',
      `You will lose your guest or organiser access to this event.${linkedFundNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Event', style: 'destructive', onPress: leaveEvent },
      ],
    )
  }

  async function leaveEvent() {
    if (!event || !canLeaveEvent || isLeavingEvent) return
    setIsLeavingEvent(true)
    const { error } = await supabase.rpc('leave_event', { p_event_id: eventId })
    setIsLeavingEvent(false)

    if (error) {
      Alert.alert('Could not leave event', error.message)
      return
    }

    navigation.reset({ index: 0, routes: [{ name: 'Tabs' as any }] })
  }

  function toggleFundWorkspaceExpanded() {
    const expanding = !fundWorkspaceExpanded
    setFundWorkspaceExpanded(expanding)
    Animated.timing(fundExpandProgress, {
      toValue: expanding ? 1 : 0,
      duration: expanding ? 340 : 300,
      easing: expanding ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }

  function toggleEventWorkspaceExpanded() {
    const expanding = !eventWorkspaceExpanded
    setEventWorkspaceExpanded(expanding)
    Animated.timing(eventExpandProgress, {
      toValue: expanding ? 1 : 0,
      duration: expanding ? 340 : 300,
      easing: expanding ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }

  function openFundWorkspace() {
    if (eventWorkspaceExpanded) {
      eventExpandProgress.setValue(0)
      setEventWorkspaceExpanded(false)
    }
    setWorkspace('fund')
  }

  if (!event) return <View style={styles.loadingScreen}><LoadingOverlay /></View>

  // A code-joined guest may attend an Event + Fund without joining its fund.
  // In that case, keep financial data and the Budget tab out of their view.
  const isEventOnly = !fund
  const guestSummary = summarizeEventGuests(eventGuests)
  const totalBudget = event.budgetAmount ?? fund?.goal ?? 0
  const totalIn = fund?.contributions ?? 0
  const totalSpent = fund?.expenses ?? 0
  const remaining = Math.max(totalBudget - totalSpent, 0)
  const hasOverflowActions = !event.linkedFundId
    || canLeaveEvent
    || Boolean(fund?.ownerId === userId && !isFundReadOnly(fund.status))
  const activeExpandProgress = workspace === 'fund' ? fundExpandProgress : eventExpandProgress
  const animatedOverviewStyle = fund && overviewHeight > 0 ? {
    maxHeight: activeExpandProgress.interpolate({ inputRange: [0, 1], outputRange: [overviewHeight, 0] }),
    opacity: activeExpandProgress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 0.18, 0] }),
    transform: [{
      translateY: activeExpandProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }),
    }],
    overflow: 'hidden' as const,
  } : undefined
  const animatedWorkspaceSwitchStyle = fund ? {
    height: activeExpandProgress.interpolate({ inputRange: [0, 1], outputRange: [58, 0] }),
    opacity: activeExpandProgress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.15, 0] }),
    transform: [{
      translateY: activeExpandProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }),
    }],
  } : undefined
  const animatedSheetStyle = fund ? {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  } : undefined

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={EVENT_HEADER_PURPLE} />

      <Animated.View
        style={[styles.overview, animatedOverviewStyle]}
        onLayout={event => {
          if (fund && overviewHeight === 0) setOverviewHeight(event.nativeEvent.layout.height)
        }}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={21} color={INK} />
          </TouchableOpacity>
          <View style={styles.topActions}>
            <TouchableOpacity
              style={[styles.iconButton, styles.calendarButton, isOpeningCalendar && styles.iconButtonDisabled]}
              onPress={addToCalendar}
              disabled={isOpeningCalendar}
              accessibilityLabel="Add event to calendar"
            >
              <Ionicons name="calendar-outline" size={20} color={INK} />
            </TouchableOpacity>
            {hasOverflowActions ? (
              <TouchableOpacity style={styles.iconButton} onPress={showMoreOptions} accessibilityLabel="Event options">
                <Ionicons name="ellipsis-horizontal" size={22} color={INK} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View>
          <View style={styles.eventTitleRow}>
            <View style={styles.eventTitleCopy}>
              {fund && <Text style={styles.eventFundEyebrow}>EVENT + FUND</Text>}
              <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
            </View>
            {event.status === 'completed' && <Text style={styles.completedBadge}>COMPLETED</Text>}
          </View>

          <View style={styles.detailCard}>
          {isEventOnly ? (
            <>
              <View style={styles.rsvpSummaryHeader}>
                <Text style={styles.rsvpSummaryTitle}>RSVP SUMMARY</Text>
                {canManageGuests ? (
                  <TouchableOpacity onPress={() => navigation.navigate('GuestList', { eventId })} activeOpacity={0.75}>
                    <Text style={styles.manageGuestsLink}>Manage guests</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.metricRow}>
                <MetricCard label="Attending" value={`${guestSummary.confirmedPeople}`} styles={styles} />
                <MetricCard label="Pending" value={`${guestSummary.pendingInvitations}`} styles={styles} />
                <MetricCard label="Invited" value={`${guestSummary.invitedPeople}`} styles={styles} />
              </View>
              {event.status === 'completed' && event.estimatedSpendAmount !== null && (
                <View style={styles.estimatedSpendRow}>
                  <View>
                    <Text style={styles.estimatedSpendLabel}>ESTIMATED EVENT SPEND</Text>
                    <Text style={styles.estimatedSpendHint}>Captured when the event was closed</Text>
                  </View>
                  <Text style={styles.estimatedSpendValue}>
                    {formatEventMoney(event.estimatedSpendAmount, event.budgetCurrency)}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.metricRow}>
              <MetricCard label="Event Budget" value={formatEventMoney(totalBudget, event.budgetCurrency)} styles={styles} />
              <MetricCard label="Fund Goal" value={formatEventMoney(fund?.goal ?? 0, event.budgetCurrency)} styles={styles} />
            </View>
          )}

          <View style={styles.metricRow}>
            <MetricCard
              label="Location"
              value={event.venue}
              styles={styles}
              wide
              onPress={event.venue === 'Venue to be confirmed' ? undefined : confirmOpenEventLocation}
              accessibilityLabel={`Open ${event.venue} in Maps`}
            />
            <MetricCard label="Date" value={event.date} styles={styles} wide />
          </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.sheet, animatedSheetStyle]}>
        {fund ? (
          <Animated.View
            style={[styles.workspaceSwitchWrap, animatedWorkspaceSwitchStyle]}
            pointerEvents={fundWorkspaceExpanded || eventWorkspaceExpanded ? 'none' : 'auto'}
          >
            <View style={styles.workspaceSwitch}>
              <TouchableOpacity
                style={[styles.workspaceOption, workspace === 'event' && styles.workspaceOptionActive]}
                onPress={() => {
                  setFundWorkspaceExpanded(false)
                  setWorkspace('event')
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={15} color={workspace === 'event' ? '#FFFFFF' : MUTED} />
                <Text style={[styles.workspaceOptionText, workspace === 'event' && styles.workspaceOptionTextActive]}>Event</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.workspaceOption, workspace === 'fund' && styles.workspaceOptionActive]}
                onPress={openFundWorkspace}
                activeOpacity={0.8}
              >
                <Ionicons name="wallet-outline" size={15} color={workspace === 'fund' ? '#FFFFFF' : MUTED} />
                <Text style={[styles.workspaceOptionText, workspace === 'fund' && styles.workspaceOptionTextActive]}>Fund</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : null}

        {fund && workspace === 'event' ? (
          <View style={[styles.eventWorkspaceHeader, eventWorkspaceExpanded && styles.eventWorkspaceHeaderExpanded]}>
            {eventWorkspaceExpanded ? (
              <Text style={styles.eventWorkspaceExpandedTitle} numberOfLines={2}>{event.title}</Text>
            ) : null}
            <View style={[styles.eventWorkspaceControlsRow, eventWorkspaceExpanded && styles.eventWorkspaceControlsRowExpanded]}>
              <View style={styles.eventWorkspaceHeading}>
                {canManageGuests && event.status !== 'completed' ? (
                  <TouchableOpacity
                    style={styles.eventWorkspaceInviteLink}
                    onPress={() => setShowShareModal(true)}
                    activeOpacity={0.72}
                    accessibilityRole="button"
                    accessibilityLabel="Open event invite details"
                  >
                    <Ionicons name="copy-outline" size={17} color={colors.primary} />
                    <Text style={styles.eventWorkspaceEyebrow}>Copy Event Invite</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.eventWorkspaceActions}>
                <TouchableOpacity
                  style={styles.eventWorkspaceButton}
                  onPress={toggleEventWorkspaceExpanded}
                  accessibilityLabel={eventWorkspaceExpanded ? 'Restore Event and Fund overview' : 'Expand event workspace'}
                >
                  <Ionicons name={eventWorkspaceExpanded ? 'contract-outline' : 'expand-outline'} size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.eventWorkspaceButton}
                  onPress={() => setActiveTab('announcements')}
                  accessibilityLabel="Event history"
                >
                  <Ionicons name="time-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.eventWorkspaceButton} onPress={showMoreOptions} accessibilityLabel="Event options">
                  <Ionicons name="ellipsis-horizontal" size={19} color={INK} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {fund && workspace === 'fund' ? (
          <FundDetailScreen
            embedded
            embeddedExpanded={fundWorkspaceExpanded}
            onToggleEmbeddedExpanded={toggleFundWorkspaceExpanded}
            navigation={navigation as any}
            route={{
              key: `event-fund-${fund.id}`,
              name: 'FundDetail',
              params: { fundId: fund.id, tab: route.params.fundTab },
            } as any}
          />
        ) : (
          <>
            <View style={styles.tabBar}>
              {(isEventOnly
                ? ([['guests', 'Guests'], ['announcements', 'Announcements']] as const)
                : ([['guests', 'Guests'], ['announcements', 'Announcements'], ['budget', 'Budget']] as const)
              ).map(([id, label]) => (
                <TouchableOpacity key={id} style={[styles.tab, activeTab === id && styles.tabActive]} onPress={() => setActiveTab(id)}>
                  <Text style={[styles.tabText, activeTab === id && styles.tabTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.sheetContent} contentContainerStyle={styles.sheetContentInner} showsVerticalScrollIndicator={false}>
          {activeTab === 'guests' ? (
            <>
              {canManageGuests && (
                <View style={styles.tabInviteCard}>
                  <View style={styles.tabInviteHeader}>
                    <View style={styles.tabInviteIcon}>
                      <Ionicons name="ticket-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.tabInviteCopy}>
                      <Text style={styles.tabInviteEyebrow}>EVENT INVITE</Text>
                      <Text style={styles.tabInviteTitle}>Invite event guests</Text>
                    </View>
                  </View>
                  <Text style={styles.tabInviteHelp}>
                    This code joins the event only. It does not give access to the contribution fund or fund management.
                  </Text>
                  <View style={styles.tabInviteCodeRow}>
                    <Text style={styles.tabInviteCode} numberOfLines={1}>{event.shareCode ?? 'Invite unavailable'}</Text>
                    {event.status !== 'completed' && event.shareCode ? (
                      <View style={styles.tabInviteActions}>
                        <TouchableOpacity style={styles.tabInviteButton} onPress={copyEventInvite} accessibilityLabel="Copy event invite">
                          <Ionicons name="copy-outline" size={18} color={INK} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.tabInviteButton} onPress={() => setShowShareModal(true)} accessibilityLabel="Share event invite">
                          <Ionicons name="share-social" size={18} color={INK} />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
              {!isEventOnly && canManageGuests ? (
                <TouchableOpacity
                  style={styles.newAnnouncementButton}
                  onPress={() => navigation.navigate('GuestList', { eventId })}
                  activeOpacity={0.84}
                >
                  <Ionicons name="people-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.newAnnouncementButtonText}>Manage guest list</Text>
                </TouchableOpacity>
              ) : null}
              {eventGuests.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={26} color={MUTED} />
                  <Text style={styles.emptyTitle}>No guests yet</Text>
                  <Text style={styles.emptyText}>Share the event invite to start building your guest list.</Text>
                  {canManageGuests && event.status !== 'completed' && (
                    <TouchableOpacity style={styles.emptyAction} onPress={() => setShowShareModal(true)}>
                      <Text style={styles.emptyActionText}>Invite guests</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : eventGuests.map(guest => (
                <View key={guest.id} style={styles.guestCard}>
                  <View style={styles.guestAvatar}>
                    <Ionicons name="person" size={24} color="#A7A7B3" />
                  </View>
                  <View style={styles.guestCopy}>
                    <Text style={styles.guestName} numberOfLines={1}>{guest.name}</Text>
                    {guest.plusOnes > 0 && <Text style={styles.guestNote}>+{guest.plusOnes} guest{guest.plusOnes === 1 ? '' : 's'}</Text>}
                  </View>
                  <View style={[
                    styles.statusPill,
                    guest.status === 'confirmed' && styles.confirmedPill,
                    guest.status === 'declined' && styles.declinedPill,
                  ]}>
                    <Text style={[
                      styles.statusText,
                      guest.status === 'confirmed' && styles.confirmedText,
                      guest.status === 'declined' && styles.declinedText,
                    ]}>{guestStatusLabel(guest.status)}</Text>
                  </View>
                </View>
              ))}
            </>
          ) : activeTab === 'announcements' ? (
            <View style={styles.announcementList}>
              {canPostAnnouncements && event.status !== 'completed' && (
                <TouchableOpacity style={styles.newAnnouncementButton} onPress={() => setShowAnnouncementComposer(true)} activeOpacity={0.84}>
                  <Ionicons name="add" size={17} color="#FFFFFF" />
                  <Text style={styles.newAnnouncementButtonText}>New announcement</Text>
                </TouchableOpacity>
              )}

              {announcements.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="megaphone-outline" size={27} color={MUTED} />
                  <Text style={styles.emptyTitle}>No announcements yet</Text>
                  <Text style={styles.emptyText}>
                    {canPostAnnouncements
                      ? 'Post important event details and changes here.'
                      : 'Event admins will post important details and changes here.'}
                  </Text>
                </View>
              ) : announcements.map(announcement => (
                <View key={announcement.id} style={styles.announcementCard}>
                  <View style={styles.announcementHeader}>
                    <View style={styles.announcementIcon}>
                      <Ionicons name="megaphone-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.announcementHeading}>
                      <Text style={styles.announcementEyebrow}>ANNOUNCEMENT</Text>
                      <Text style={styles.announcementTitle}>{announcement.title}</Text>
                    </View>
                  </View>
                  <Text style={styles.announcementBody}>{announcement.body}</Text>
                  <View style={styles.announcementFooter}>
                    <Text style={styles.announcementAuthor}>{announcement.authorName}</Text>
                    <View style={styles.announcementDot} />
                    <Text style={styles.announcementDate}>{announcementDate(announcement.createdAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : !isEventOnly ? (
            <View style={styles.budgetContent}>
              <View style={styles.budgetSummaryCard}>
                <Text style={styles.budgetSummaryEyebrow}>EVENT BUDGET</Text>
                <Text style={styles.budgetSummaryValue}>{formatEventMoney(totalBudget, event.budgetCurrency)}</Text>
                <View style={styles.budgetStatsRow}>
                  <View style={styles.budgetStat}>
                    <Text style={styles.budgetStatLabel}>Total in</Text>
                    <Text style={styles.budgetStatValue}>{formatEventMoney(totalIn, event.budgetCurrency)}</Text>
                  </View>
                  <View style={styles.budgetStatDivider} />
                  <View style={styles.budgetStat}>
                    <Text style={styles.budgetStatLabel}>Spent</Text>
                    <Text style={styles.budgetStatValue}>{formatEventMoney(totalSpent, event.budgetCurrency)}</Text>
                  </View>
                  <View style={styles.budgetStatDivider} />
                  <View style={styles.budgetStat}>
                    <Text style={styles.budgetStatLabel}>Remaining</Text>
                    <Text style={styles.budgetStatValue}>{formatEventMoney(remaining, event.budgetCurrency)}</Text>
                  </View>
                </View>
              </View>

              {canManageEventBudget && (!fund || !isFundReadOnly(fund.status)) ? (
                <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('EventBudget', { eventId })}>
                  <Ionicons name="create-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>{event.budgetAmount ? 'Edit event budget' : 'Set event budget'}</Text>
                </TouchableOpacity>
              ) : null}

            </View>
          ) : null}
            </ScrollView>
          </>
        )}
      </Animated.View>

      <Modal
        visible={showAnnouncementComposer}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnnouncementComposer(false)}
      >
        <KeyboardAvoidingView
          style={styles.composerBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.composerDismissArea} activeOpacity={1} onPress={() => setShowAnnouncementComposer(false)} />
          <View style={styles.composerCard}>
            <View style={styles.composerHeader}>
              <View style={styles.composerHeaderCopy}>
                <Text style={styles.composerTitle}>New announcement</Text>
                <Text style={styles.composerSubtitle}>Everyone connected to this event will be notified.</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowAnnouncementComposer(false)}>
                <Ionicons name="close" size={19} color={INK} />
              </TouchableOpacity>
            </View>

            <Text style={styles.composerLabel}>TITLE</Text>
            <TextInput
              value={announcementTitle}
              onChangeText={setAnnouncementTitle}
              placeholder="Venue changed"
              placeholderTextColor={MUTED}
              maxLength={120}
              style={styles.composerTitleInput}
              autoCapitalize="sentences"
            />

            <View style={styles.composerBodyLabelRow}>
              <Text style={styles.composerLabel}>DETAILS</Text>
              <Text style={styles.composerCount}>{announcementBody.length}/2000</Text>
            </View>
            <TextInput
              value={announcementBody}
              onChangeText={setAnnouncementBody}
              placeholder="Share what changed and what guests need to know."
              placeholderTextColor={MUTED}
              maxLength={2000}
              multiline
              textAlignVertical="top"
              style={styles.composerBodyInput}
            />

            <TouchableOpacity
              style={[
                styles.publishButton,
                (announcementTitle.trim().length < 3 || announcementBody.trim().length < 3 || isPostingAnnouncement) && styles.publishButtonDisabled,
              ]}
              onPress={publishAnnouncement}
              disabled={announcementTitle.trim().length < 3 || announcementBody.trim().length < 3 || isPostingAnnouncement}
              activeOpacity={0.84}
            >
              <Ionicons name="megaphone-outline" size={17} color="#FFFFFF" />
              <Text style={styles.publishButtonText}>{isPostingAnnouncement ? 'Publishing…' : 'Publish announcement'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showCloseEvent} transparent animationType="slide" onRequestClose={() => setShowCloseEvent(false)}>
        <KeyboardAvoidingView
          style={styles.composerBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.composerDismissArea} activeOpacity={1} onPress={() => setShowCloseEvent(false)} />
          <View style={styles.composerCard}>
            <View style={styles.composerHeader}>
              <View style={styles.composerHeaderCopy}>
                <Text style={styles.composerTitle}>Complete event</Text>
                <Text style={styles.composerSubtitle}>
                  This closes invitations and announcements. The event record and RSVP history will remain available.
                </Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowCloseEvent(false)}>
                <Ionicons name="close" size={19} color={INK} />
              </TouchableOpacity>
            </View>

            <Text style={styles.composerLabel}>ESTIMATED TOTAL SPEND (OPTIONAL)</Text>
            <View style={styles.estimateInputRow}>
              <Text style={styles.estimateCurrency}>{event.budgetCurrency === 'BWP' ? 'P' : event.budgetCurrency}</Text>
              <TextInput
                value={estimatedSpend}
                onChangeText={value => setEstimatedSpend(value.replace(/[^0-9,.]/g, ''))}
                placeholder="0"
                placeholderTextColor={MUTED}
                keyboardType="decimal-pad"
                style={styles.estimateInput}
              />
            </View>
            <Text style={styles.estimateHelp}>
              This is a high-level estimate for event insights, not an expense report.
            </Text>

            <TouchableOpacity
              style={[styles.publishButton, isClosingEvent && styles.publishButtonDisabled]}
              onPress={closeEvent}
              disabled={isClosingEvent}
              activeOpacity={0.84}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.publishButtonText}>{isClosingEvent ? 'Completing…' : 'Complete event'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <InviteDetailsModal
        visible={showShareModal}
        inviteType="Event"
        title={event.title}
        inviteValue={event.shareCode ?? event.rsvpLink}
        helpText="This invite joins the event only. It does not give access to the contribution fund or fund management."
        shareMessage={shareMessage}
        onClose={() => setShowShareModal(false)}
      />

      {isLoading && <LoadingOverlay />}
    </SafeAreaView>
  )
}

function MetricCard({
  label,
  value,
  styles,
  wide = false,
  onPress,
  accessibilityLabel,
}: {
  label: string
  value: string
  styles: ReturnType<typeof makeStyles>
  wide?: boolean
  onPress?: () => void
  accessibilityLabel?: string
}) {
  const Card = onPress ? TouchableOpacity : View
  return (
    <Card
      style={[styles.metricCard, wide && styles.metaMetricCard]}
      {...(onPress ? { onPress, activeOpacity: 0.76, accessibilityRole: 'button' as const, accessibilityLabel } : {})}
    >
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, wide && styles.metaMetricValue]} numberOfLines={1}>{value}</Text>
        {onPress && <Ionicons name="navigate-outline" size={12} color="#7B2CFF" />}
      </View>
    </Card>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    loadingScreen: { flex: 1, backgroundColor: EVENT_HEADER_PURPLE },
    safe: { flex: 1, backgroundColor: EVENT_HEADER_PURPLE },
    overview: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
    topBar: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#F1F1F1',
    },
    calendarButton: { backgroundColor: '#FFFFFF' },
    iconButtonDisabled: { opacity: 0.45 },
    eventTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 20,
      marginBottom: 14,
    },
    eventTitleCopy: { flex: 1, minWidth: 0 },
    eventFundEyebrow: {
      marginBottom: 3,
      fontSize: 8,
      fontFamily: fonts.inter.black,
      color: '#7B2CFF',
      letterSpacing: 0.7,
    },
    eventTitle: {
      minWidth: 0,
      fontSize: 18,
      lineHeight: 23,
      fontFamily: fonts.inter.extraBold,
      color: INK,
    },
    completedBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: '#DCFCE7',
      color: '#047857',
      fontSize: 8,
      fontFamily: fonts.inter.black,
      letterSpacing: 0.35,
    },
    detailCard: { padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF' },
    rsvpSummaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 1,
    },
    rsvpSummaryTitle: { fontSize: 10, fontFamily: fonts.inter.bold, color: INK, letterSpacing: 0.35 },
    manageGuestsLink: { fontSize: 9, fontFamily: fonts.inter.bold, color: colors.primary },
    estimatedSpendRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 9,
      backgroundColor: '#F7F7F8',
      borderWidth: 1,
      borderColor: BORDER,
    },
    estimatedSpendLabel: { fontSize: 8, fontFamily: fonts.inter.bold, color: '#71717A', letterSpacing: 0.4 },
    estimatedSpendHint: { marginTop: 2, fontSize: 8, fontFamily: fonts.inter.regular, color: MUTED },
    estimatedSpendValue: { fontSize: 12, fontFamily: fonts.inter.extraBold, color: INK },
    metricRow: { flexDirection: 'row', gap: 7, marginTop: 7 },
    metricCard: {
      flex: 1,
      minWidth: 0,
      minHeight: 50,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: BORDER,
    },
    metaMetricCard: { minHeight: 48 },
    metricLabel: { marginBottom: 3, fontSize: 10, fontFamily: fonts.inter.semiBold, color: MUTED },
    metricValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metricValue: { flex: 1, minWidth: 0, fontSize: 14, fontFamily: fonts.inter.bold, color: INK },
    metaMetricValue: { fontSize: 12 },
    sheet: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
    workspaceSwitchWrap: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 4,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
    },
    workspaceSwitch: {
      height: 42,
      flexDirection: 'row',
      padding: 4,
      borderRadius: 14,
      backgroundColor: '#F1F1F3',
    },
    workspaceOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 11,
    },
    workspaceOptionActive: { backgroundColor: colors.primary },
    workspaceOptionText: { fontSize: 11, fontFamily: fonts.inter.bold, color: MUTED },
    workspaceOptionTextActive: { color: '#FFFFFF' },
    eventWorkspaceHeader: {
      minHeight: 76,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
    },
    eventWorkspaceHeaderExpanded: { minHeight: 112, justifyContent: 'flex-start', paddingTop: 14 },
    eventWorkspaceExpandedTitle: {
      paddingRight: 8,
      fontSize: 20,
      lineHeight: 25,
      fontFamily: fonts.inter.extraBold,
      color: INK,
    },
    eventWorkspaceControlsRow: { width: '100%', flexDirection: 'row', alignItems: 'center' },
    eventWorkspaceControlsRowExpanded: { marginTop: 6 },
    eventWorkspaceHeading: { flex: 1, minWidth: 0 },
    eventWorkspaceEyebrow: {
      fontSize: 12,
      fontFamily: fonts.inter.extraBold,
      letterSpacing: 0.1,
      color: colors.primary,
    },
    eventWorkspaceInviteLink: { alignSelf: 'flex-start', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7 },
    eventWorkspaceActions: { flexDirection: 'row', gap: 7, marginLeft: 10 },
    eventWorkspaceButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: EVENT_HEADER_PURPLE,
      borderWidth: 1,
      borderColor: BORDER,
    },
    tabBar: {
      height: 55,
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingHorizontal: 30,
      borderBottomWidth: 1,
      borderBottomColor: '#D4D4D8',
    },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: colors.primary },
    tabText: { fontSize: 10, fontFamily: fonts.inter.bold, color: MUTED },
    tabTextActive: { color: colors.primary },
    sheetContent: { flex: 1 },
    sheetContentInner: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
    tabInviteCard: {
      padding: 14,
      marginBottom: 14,
      borderRadius: 16,
      backgroundColor: '#F7F7F8',
      borderWidth: 1,
      borderColor: BORDER,
    },
    tabInviteHeader: { flexDirection: 'row', alignItems: 'center' },
    tabInviteIcon: {
      width: 38,
      height: 38,
      marginRight: 10,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: EVENT_HEADER_PURPLE,
    },
    tabInviteCopy: { flex: 1, minWidth: 0 },
    tabInviteEyebrow: { fontSize: 8, fontFamily: fonts.inter.black, color: colors.primary, letterSpacing: 0.55 },
    tabInviteTitle: { marginTop: 2, fontSize: 13, fontFamily: fonts.inter.extraBold, color: INK },
    tabInviteHelp: { marginTop: 10, fontSize: 10, lineHeight: 15, fontFamily: fonts.inter.regular, color: '#71717A' },
    tabInviteCodeRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 11,
      paddingLeft: 12,
      paddingRight: 6,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: BORDER,
    },
    tabInviteCode: { flex: 1, minWidth: 0, fontSize: 12, fontFamily: fonts.inter.bold, color: INK, letterSpacing: 0.3 },
    tabInviteActions: { flexDirection: 'row', gap: 5 },
    tabInviteButton: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: EVENT_HEADER_PURPLE },
    guestCard: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 8,
      borderRadius: 13,
      backgroundColor: '#F7F7F8',
      borderWidth: 1,
      borderColor: '#DEDEE1',
    },
    guestAvatar: {
      width: 42,
      height: 42,
      marginRight: 12,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'flex-end',
      overflow: 'hidden',
      backgroundColor: '#E4E4E7',
    },
    guestCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
    guestName: { fontSize: 13, lineHeight: 17, fontFamily: fonts.inter.bold, color: INK },
    guestNote: { marginTop: 2, fontSize: 9, fontFamily: fonts.inter.regular, color: MUTED },
    statusPill: { minWidth: 61, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignItems: 'center', backgroundColor: EVENT_HEADER_PURPLE },
    confirmedPill: { backgroundColor: '#DCFCE7' },
    declinedPill: { backgroundColor: '#FEF3C7' },
    statusText: { fontSize: 8, fontFamily: fonts.inter.bold, color: colors.primary },
    confirmedText: { color: '#047857' },
    declinedText: { color: '#B45309' },
    emptyState: { flex: 1, minHeight: 250, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
    emptyTitle: { marginTop: 10, fontSize: 14, fontFamily: fonts.inter.extraBold, color: INK },
    emptyText: { marginTop: 5, fontSize: 11, lineHeight: 17, fontFamily: fonts.inter.regular, color: MUTED, textAlign: 'center' },
    emptyAction: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.primary },
    emptyActionText: { fontSize: 11, fontFamily: fonts.inter.bold, color: '#FFFFFF' },
    announcementList: { gap: 10 },
    newAnnouncementButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginBottom: 2,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    newAnnouncementButtonText: { fontSize: 12, fontFamily: fonts.inter.bold, color: '#FFFFFF' },
    announcementCard: {
      padding: 14,
      borderRadius: 15,
      backgroundColor: '#F7F7F8',
      borderWidth: 1,
      borderColor: '#DEDEE1',
    },
    announcementHeader: { flexDirection: 'row', alignItems: 'center' },
    announcementIcon: {
      width: 36,
      height: 36,
      marginRight: 10,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: EVENT_HEADER_PURPLE,
    },
    announcementHeading: { flex: 1, minWidth: 0 },
    announcementEyebrow: { fontSize: 8, fontFamily: fonts.inter.bold, letterSpacing: 0.45, color: colors.primary },
    announcementTitle: { marginTop: 2, fontSize: 13, lineHeight: 17, fontFamily: fonts.inter.extraBold, color: INK },
    announcementBody: { marginTop: 10, fontSize: 11, lineHeight: 17, fontFamily: fonts.inter.regular, color: '#52525B' },
    announcementFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 11 },
    announcementAuthor: { fontSize: 9, fontFamily: fonts.inter.bold, color: '#71717A' },
    announcementDot: { width: 3, height: 3, marginHorizontal: 6, borderRadius: 2, backgroundColor: '#C4C4CA' },
    announcementDate: { fontSize: 9, fontFamily: fonts.inter.regular, color: MUTED },
    budgetContent: { gap: 12 },
    budgetSummaryCard: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, backgroundColor: '#F7F7F8', borderWidth: 1, borderColor: BORDER },
    budgetSummaryEyebrow: { fontSize: 9, fontFamily: fonts.inter.bold, letterSpacing: 0.5, color: MUTED },
    budgetSummaryValue: { marginTop: 2, fontSize: 18, lineHeight: 22, fontFamily: fonts.inter.extraBold, color: INK },
    budgetStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9 },
    budgetStat: { flex: 1 },
    budgetStatDivider: { width: 1, height: 26, marginHorizontal: 8, backgroundColor: BORDER },
    budgetStatLabel: { marginBottom: 3, fontSize: 8, fontFamily: fonts.inter.regular, color: MUTED },
    budgetStatValue: { fontSize: 11, fontFamily: fonts.inter.bold, color: INK },
    primaryButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, backgroundColor: colors.primary },
    primaryButtonText: { fontSize: 12, fontFamily: fonts.inter.bold, color: '#FFFFFF' },
    composerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
    composerDismissArea: { flex: 1 },
    composerCard: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 30,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: '#FFFFFF',
    },
    composerHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
    composerHeaderCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
    composerTitle: { fontSize: 16, fontFamily: fonts.inter.extraBold, color: INK },
    composerSubtitle: { marginTop: 3, fontSize: 10, lineHeight: 15, fontFamily: fonts.inter.regular, color: MUTED },
    composerLabel: { marginBottom: 6, fontSize: 8, fontFamily: fonts.inter.bold, letterSpacing: 0.5, color: '#71717A' },
    composerTitleInput: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: '#F7F7F8',
      fontSize: 12,
      fontFamily: fonts.inter.bold,
      color: INK,
    },
    composerBodyLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
    composerCount: { fontSize: 8, fontFamily: fonts.inter.regular, color: MUTED },
    composerBodyInput: {
      minHeight: 116,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: '#F7F7F8',
      fontSize: 11,
      lineHeight: 17,
      fontFamily: fonts.inter.regular,
      color: INK,
    },
    estimateInputRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: '#F7F7F8',
    },
    estimateCurrency: { marginRight: 8, fontSize: 18, fontFamily: fonts.inter.extraBold, color: colors.primary },
    estimateInput: { flex: 1, minWidth: 0, fontSize: 20, fontFamily: fonts.inter.extraBold, color: INK },
    estimateHelp: { marginTop: 7, fontSize: 9, lineHeight: 14, fontFamily: fonts.inter.regular, color: MUTED },
    publishButton: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 16,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    publishButtonDisabled: { opacity: 0.42 },
    publishButtonText: { fontSize: 12, fontFamily: fonts.inter.bold, color: '#FFFFFF' },
    closeButton: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F5' },
  })
}
