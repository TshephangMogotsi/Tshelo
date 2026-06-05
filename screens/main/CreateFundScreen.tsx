import { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Alert,
  FlatList,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import * as Contacts from 'expo-contacts'
import emojiData from '@emoji-mart/data'
import type { EmojiMartData } from '@emoji-mart/data'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'
import { supabase } from '../../lib/supabase'

const BRAND_PURPLE = '#7657F0'
const BRAND_PURPLE_DARK = '#7439E0'
const BRAND_PURPLE_MID = '#8874E1'
const BRAND_LAVENDER = '#EAE4FB'
const BRAND_ACCENT = '#F59E0B'
const BACK_HIT_SLOP = { top: 10, right: 10, bottom: 10, left: 10 }

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'CreateFund'>
  route:      RouteProp<MainStackParamList, 'CreateFund'>
}

type CreateOption = 'event' | 'fund' | 'eventFund'
type FundCurrency = 'BWP' | 'ZAR' | 'USD' | 'KES'
type PickedOrganiser = {
  id: string
  name: string
  phone?: string
  initials: string
}
type EmojiPickerItem = {
  id: string
  native: string
  name: string
  keywords: string[]
  category: string
}
type CreatedEvent = {
  id: string
  share_code: string | null
}

const EVENT_TYPES: { id: string; label: string; emoji: string }[] = [
  { id: 'wedding',    label: 'Wedding',    emoji: '🏠' },
  { id: 'funeral',    label: 'Funeral',    emoji: '🕯️' },
  { id: 'graduation', label: 'Graduation', emoji: '🎓' },
  { id: 'birthday',   label: 'Birthday',   emoji: '🎂' },
  { id: 'baby',       label: 'Baby shower', emoji: '👶' },
  { id: 'other',      label: 'Other',      emoji: '🎉' },
]

const EMOJI_OPTIONS: { id: string; label: string; emoji: string }[] = [
  { id: 'heart',      label: 'Support',    emoji: '💜' },
  { id: 'funeral',    label: 'Funeral',    emoji: '🕯️' },
  { id: 'celebration', label: 'Event',      emoji: '🏠' },
  { id: 'graduation', label: 'Graduation', emoji: '🎓' },
]

const CUSTOM_EVENT_EMOJIS = ['🎉', '✨', '💜', '🙏']
const EMOJI_CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  people: 'Smileys',
  nature: 'Nature',
  foods: 'Food',
  activity: 'Events',
  places: 'Places',
  objects: 'Objects',
  symbols: 'Symbols',
  flags: 'Flags',
}

const GOAL_PRESETS = [
  { label: 'P5k',  value: '5,000' },
  { label: 'P10k', value: '10,000' },
  { label: 'P15k', value: '15,000' },
  { label: 'P25k', value: '25,000' },
]

const EVENT_BUDGET_PRESETS = [
  { label: 'P10k',  value: '10,000' },
  { label: 'P25k',  value: '25,000' },
  { label: 'P50k',  value: '50,000' },
  { label: 'P100k', value: '100,000' },
]

const CREATE_OPTIONS: {
  id: CreateOption
  title: string
  description: string
  price: string
  icon: keyof typeof Ionicons.glyphMap
  tint: string
  iconBg: string
  featured?: boolean
}[] = [
  {
    id: 'event',
    title: 'Event only',
    description: 'Guest list & budget tracking',
    price: 'FREE',
    icon: 'calendar-outline',
    tint: BRAND_PURPLE,
    iconBg: BRAND_LAVENDER,
  },
  {
    id: 'fund',
    title: 'Fund only',
    description: 'Track contributions',
    price: 'FREE',
    icon: 'wallet-outline',
    tint: BRAND_PURPLE_MID,
    iconBg: BRAND_LAVENDER,
  },
  {
    id: 'eventFund',
    title: 'Event + Fund',
    description: 'Plan event & collect contributions',
    price: '15',
    icon: 'albums-outline',
    tint: BRAND_PURPLE_DARK,
    iconBg: BRAND_PURPLE,
    featured: true,
  },
]

const FUND_CURRENCIES: {
  id: FundCurrency
  code: string
  name: string
  helper?: string
  symbol: string
}[] = [
  { id: 'BWP', code: 'BWP', name: 'Pula',     helper: 'Your home currency', symbol: 'P' },
  { id: 'ZAR', code: 'ZAR', name: 'Rand',     symbol: 'R' },
  { id: 'USD', code: 'USD', name: 'Dollar',   symbol: '$' },
  { id: 'KES', code: 'KES', name: 'Shilling', symbol: 'KSh' },
]

export default function CreateFundScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  const isFirst = route.params?.isFirst === true

  const [name,           setName]           = useState('')
  const [goalBWP,        setGoalBWP]        = useState('')
  const [targetDate,     setTargetDate]     = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [createOption,   setCreateOption]   = useState<CreateOption | null>(null)
  const [currency,       setCurrency]       = useState<FundCurrency>('BWP')
  const [currencyDone,   setCurrencyDone]   = useState(false)
  const [selectedEmoji,  setSelectedEmoji]  = useState(EMOJI_OPTIONS[1])
  const [eventType,      setEventType]      = useState(EVENT_TYPES[0])
  const [customEventType, setCustomEventType] = useState('')
  const [customEventEmoji, setCustomEventEmoji] = useState(CUSTOM_EVENT_EMOJIS[0])
  const [showCustomEmojiDialog, setShowCustomEmojiDialog] = useState(false)
  const [emojiSearch, setEmojiSearch] = useState('')
  const [emojiCategory, setEmojiCategory] = useState('all')
  const [eventStep,      setEventStep]      = useState<1 | 2 | 3>(1)
  const [eventCreated,   setEventCreated]   = useState(false)
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null)
  const [eventFundTypeDone, setEventFundTypeDone] = useState(false)
  const [eventFundDetailsDone, setEventFundDetailsDone] = useState(false)
  const [eventFundOrganisersDone, setEventFundOrganisersDone] = useState(false)
  const [organiserSearch, setOrganiserSearch] = useState('')
  const [pickedOrganisers, setPickedOrganisers] = useState<PickedOrganiser[]>([])
  const [eventBudget, setEventBudget] = useState('50,000')
  const [fundGoalPercent, setFundGoalPercent] = useState(65)
  const [eventName,      setEventName]      = useState('')
  const [eventDate,      setEventDate]      = useState<Date | null>(null)
  const [eventTime,      setEventTime]      = useState<Date | null>(null)
  const [eventVenue,     setEventVenue]     = useState('')
  const [showEventDatePicker, setShowEventDatePicker] = useState(false)
  const [showEventTimePicker, setShowEventTimePicker] = useState(false)

  const isValid = name.trim().length >= 3
  const eventDetailsValid = eventName.trim().length >= 3 && eventDate !== null && eventTime !== null && eventVenue.trim().length >= 3
  const isOtherEvent = eventType.id === 'other'
  const selectedEventLabel = isOtherEvent ? customEventType.trim() || 'Other' : eventType.label
  const selectedEventEmoji = isOtherEvent ? customEventEmoji : eventType.emoji
  const eventTypeStepValid = !isOtherEvent || customEventType.trim().length >= 2
  const selectedCurrency = FUND_CURRENCIES.find(item => item.id === currency) ?? FUND_CURRENCIES[0]
  const emojiPickerData = emojiData as EmojiMartData
  const emojiCategoryOptions = useMemo(() => [
    'all',
    ...emojiPickerData.categories.map(category => category.id),
  ], [emojiPickerData.categories])
  const emojiPickerItems = useMemo<EmojiPickerItem[]>(() => {
    return emojiPickerData.categories.flatMap(category => (
      category.emojis
        .map(id => {
          const emoji = emojiPickerData.emojis[id]
          const native = emoji?.skins?.[0]?.native

          if (!emoji || !native) return null

          return {
            id: emoji.id,
            native,
            name: emoji.name,
            keywords: emoji.keywords ?? [],
            category: category.id,
          }
        })
        .filter((item): item is EmojiPickerItem => item !== null)
    ))
  }, [emojiPickerData.categories, emojiPickerData.emojis])
  const filteredEmojiItems = useMemo(() => {
    const query = emojiSearch.trim().toLowerCase()

    return emojiPickerItems.filter(item => {
      const categoryMatches = emojiCategory === 'all' || item.category === emojiCategory
      if (!categoryMatches) return false
      if (!query) return true

      return item.name.toLowerCase().includes(query)
        || item.id.toLowerCase().includes(query)
        || item.keywords.some(keyword => keyword.toLowerCase().includes(query))
    })
  }, [emojiCategory, emojiPickerItems, emojiSearch])

  function handleGoalChange(text: string) {
    setGoalBWP(text.replace(/[^0-9.,]/g, ''))
  }

  function handleEventBudgetChange(text: string) {
    setEventBudget(text.replace(/[^0-9.,]/g, ''))
  }

  function parseAmount(text: string) {
    const parsed = parseFloat(text.replace(/,/g, ''))
    return isNaN(parsed) ? 0 : parsed
  }

  function formatWholeAmount(amount: number) {
    return `P${amount.toLocaleString('en-BW', { maximumFractionDigits: 0 })}`
  }

  function formatDateDisplay(date: Date): string {
    return date.toLocaleDateString('en-BW', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatEventDateDisplay(date: Date): string {
    return date.toLocaleDateString('en-BW', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatTimeDisplay(date: Date): string {
    return date.toLocaleTimeString('en-BW', { hour: 'numeric', minute: '2-digit' })
  }

  function formatDateISO(date: Date): string {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  function formatTimeISO(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')

    return `${hours}:${minutes}:${seconds}`
  }

  function getInitials(value: string) {
    const initials = value
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    return initials || '?'
  }

  async function handleAddFromContacts() {
    try {
      const permission = await Contacts.requestPermissionsAsync()

      if (permission.status !== Contacts.PermissionStatus.GRANTED) {
        Alert.alert(
          'Contacts permission needed',
          'Allow contacts access to add organisers from your phone book.'
        )
        return
      }

      const contact = await Contacts.presentContactPickerAsync()
      if (!contact) return

      const contactName = contact.name
        || [contact.firstName, contact.lastName].filter(Boolean).join(' ')
        || 'Selected contact'
      const phone = contact.phoneNumbers?.find(item => item.number)?.number

      setPickedOrganisers(previous => {
        if (previous.some(item => item.id === contact.id)) return previous

        return [
          ...previous,
          {
            id: contact.id,
            name: contactName,
            phone,
            initials: getInitials(contactName),
          },
        ]
      })
    } catch {
      Alert.alert('Could not open contacts', 'Please try again or add the organiser later.')
    }
  }

  function removePickedOrganiser(id: string) {
    setPickedOrganisers(previous => previous.filter(item => item.id !== id))
  }

  function renderPickedOrganisers() {
    return pickedOrganisers.map(person => (
      <View key={person.id} style={styles.organiserCard}>
        <View style={styles.contactAvatar}>
          <Text style={styles.organiserAvatarText}>{person.initials}</Text>
        </View>
        <View style={styles.organiserBody}>
          <Text style={styles.organiserName} numberOfLines={1}>{person.name}</Text>
          {person.phone ? (
            <Text style={styles.organiserPhone} numberOfLines={1}>{person.phone}</Text>
          ) : (
            <Text style={styles.organiserPhone} numberOfLines={1}>From contacts</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.organiserRemove}
          activeOpacity={0.75}
          onPress={() => removePickedOrganiser(person.id)}
        >
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    ))
  }

  async function handleCreateEvent() {
    if (!eventDetailsValid || isCreatingEvent) return
    if (!eventDate || !eventTime) return

    setIsCreatingEvent(true)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        Alert.alert('Sign in required', 'Please sign in again before creating an event.')
        return
      }

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          creator_id: user.id,
          name: eventName.trim(),
          event_type: isOtherEvent ? customEventType.trim() : eventType.id,
          event_emoji: selectedEventEmoji,
          event_date: formatDateISO(eventDate),
          event_time: formatTimeISO(eventTime),
          venue_name: eventVenue.trim(),
        })
        .select('id, share_code')
        .single()

      if (eventError || !event) {
        Alert.alert('Could not create event', eventError?.message ?? 'Please try again.')
        return
      }

      const organiserRows = pickedOrganisers
        .filter(person => person.name.trim().length > 0 || person.phone?.trim())
        .map(person => ({
          event_id: event.id,
          invited_name: person.name.trim() || null,
          invited_phone: person.phone?.trim() || null,
          invited_by: user.id,
          status: 'pending',
        }))

      if (organiserRows.length > 0) {
        const { error: organisersError } = await supabase
          .from('event_organisers')
          .insert(organiserRows)

        if (organisersError) {
          Alert.alert(
            'Event created',
            'Your event was created, but the organisers could not be added. You can add them later.'
          )
        }
      }

      setCreatedEvent(event)
      setEventCreated(true)
    } catch (error) {
      Alert.alert(
        'Could not create event',
        error instanceof Error ? error.message : 'Please try again.'
      )
    } finally {
      setIsCreatingEvent(false)
    }
  }

  function handleBack() {
    if (createOption === 'event' && eventStep === 3) {
      setEventStep(2)
      return
    }
    if (createOption === 'event' && eventStep === 2) {
      setEventStep(1)
      return
    }
    if (createOption === 'eventFund' && !currencyDone && eventFundDetailsDone) {
      if (eventFundOrganisersDone) {
        setEventFundOrganisersDone(false)
        return
      }
      setEventFundDetailsDone(false)
      return
    }
    if (createOption === 'eventFund' && !currencyDone && eventFundTypeDone) {
      setEventFundTypeDone(false)
      return
    }
    if (currencyDone) {
      setCurrencyDone(false)
      return
    }
    if (createOption) {
      setCreateOption(null)
      return
    }
    navigation.goBack()
  }

  if (!createOption) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

        <View style={styles.createHeader}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} hitSlop={BACK_HIT_SLOP}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.createTitle}>Create</Text>
          <View style={styles.titleBarSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.optionScroll} showsVerticalScrollIndicator={false}>
          {CREATE_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[styles.optionCard, option.featured && styles.optionCardFeatured]}
              activeOpacity={0.86}
              onPress={() => {
                setCreateOption(option.id)
              }}
            >
              {option.featured && (
                <View style={styles.bestValueBadge}>
                  <Text style={styles.bestValueText}>BEST VALUE</Text>
                </View>
              )}

              <View style={[styles.optionIconRail, { backgroundColor: option.iconBg }]}>
                <Ionicons
                  name={option.icon}
                  size={28}
                  color={option.featured ? '#FFFFFF' : option.tint}
                />
              </View>

              <View style={styles.optionBody}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>

              <View style={[styles.priceBadge, option.featured && styles.tokenBadge]}>
                <Text style={[styles.priceBadgeText, option.featured && styles.tokenBadgeText]}>
                  {option.price}
                </Text>
                {option.featured && (
                  <View style={styles.tokenCoin}>
                    <Ionicons name="server" size={12} color="#FFFFFF" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (createOption === 'eventFund' && eventFundTypeDone && !eventFundDetailsDone) {
    const eventFundDetailsValid = eventName.trim().length >= 3 && eventDate !== null && eventTime !== null && eventVenue.trim().length >= 3
    const derivedFundName = name.trim() || `${eventName.trim() || `${selectedEventLabel} Event`} Fund`

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND_PURPLE} />

        <View style={styles.eventFundHero}>
          <View style={styles.eventFundHeroTop}>
            <TouchableOpacity style={styles.eventFundBack} onPress={handleBack} hitSlop={BACK_HIT_SLOP}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.eventFundPillCompact}>
              <Text style={styles.eventFundPillTextSingle}>Event + Fund</Text>
            </View>

            <View style={styles.eventFundCostInline}>
              <Text style={styles.eventFundCostText}>15</Text>
              <View style={styles.eventFundCoin}>
                <Ionicons name="server" size={12} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <View style={styles.eventFundProgress}>
            <View style={[styles.eventFundProgressSegment, styles.eventFundProgressActive]} />
            <View style={[styles.eventFundProgressSegment, styles.eventFundProgressActive]} />
            <View style={styles.eventFundProgressSegment} />
            <View style={styles.eventFundProgressSegment} />
          </View>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={styles.eventFundDetailsScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.eventFundDetailsIntro}>
              <Text style={styles.eventFundDetailsEmoji}>{selectedEventEmoji}</Text>
              <View style={styles.eventFundDetailsIntroText}>
                <Text style={styles.eventFundDetailsTitle}>Event details</Text>
                <Text style={styles.eventFundDetailsSubtitle}>Tell us about your {selectedEventLabel.toLowerCase()}</Text>
              </View>
            </View>

            <View style={styles.eventFundDetailsField}>
              <Text style={styles.eventFundDetailsLabel}>Event name</Text>
              <TextInput
                style={styles.eventFundDetailsNameInput}
                  placeholder={`${selectedEventLabel} Event`}
                placeholderTextColor={colors.textMuted}
                value={eventName}
                onChangeText={text => {
                  setEventName(text)
                  if (!name.trim()) setName(text.trim() ? `${text.trim()} Fund` : '')
                }}
                maxLength={90}
                autoCapitalize="words"
                multiline
                textAlignVertical="center"
              />
            </View>

            <View style={styles.eventFundDateTimeRow}>
              <View style={styles.eventFundDateTimeField}>
                <Text style={styles.eventFundDetailsLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.eventFundDateTimeBox}
                  activeOpacity={0.84}
                  onPress={() => setShowEventDatePicker(true)}
                >
                  <Text style={[styles.eventFundDateTimeText, !eventDate && { color: colors.textMuted }]}>
                    {eventDate ? eventDate.toLocaleDateString('en-BW', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.eventFundDateTimeField}>
                <Text style={styles.eventFundDetailsLabel}>Time</Text>
                <TouchableOpacity
                  style={styles.eventFundDateTimeBox}
                  activeOpacity={0.84}
                  onPress={() => setShowEventTimePicker(true)}
                >
                  <Text style={[styles.eventFundDateTimeText, !eventTime && { color: colors.textMuted }]}>
                    {eventTime ? formatTimeDisplay(eventTime) : 'Select time'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.eventFundDetailsField}>
              <Text style={styles.eventFundDetailsLabel}>Venue</Text>
              <View style={styles.eventFundVenueBox}>
                <TextInput
                  style={styles.eventFundVenueInput}
                  placeholder="Cresta Lodge, Gaborone"
                  placeholderTextColor={colors.textMuted}
                  value={eventVenue}
                  onChangeText={setEventVenue}
                  multiline
                  maxLength={120}
                  textAlignVertical="center"
                />
              </View>
            </View>

            <View style={styles.eventFundNameCard}>
              <View style={styles.eventFundNameHeader}>
                <Text style={styles.eventFundNameLabel}>💜  Fund name</Text>
                <TouchableOpacity onPress={() => setName(derivedFundName)} activeOpacity={0.8}>
                  <Text style={styles.eventFundEditText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.eventFundDerivedName}>{derivedFundName}</Text>
            </View>

            {Platform.OS === 'android' && showEventDatePicker && (
              <DateTimePicker
                value={eventDate ?? new Date()}
                mode="date"
                minimumDate={new Date()}
                onChange={(_, date) => {
                  setShowEventDatePicker(false)
                  if (date) setEventDate(date)
                }}
              />
            )}
            {Platform.OS === 'android' && showEventTimePicker && (
              <DateTimePicker
                value={eventTime ?? new Date()}
                mode="time"
                onChange={(_, date) => {
                  setShowEventTimePicker(false)
                  if (date) setEventTime(date)
                }}
              />
            )}
            {Platform.OS === 'ios' && (
              <>
                <Modal visible={showEventDatePicker} transparent animationType="slide">
                  <View style={styles.dateModalBackdrop}>
                    <View style={[styles.dateModalSheet, { backgroundColor: colors.surface }]}>
                      <View style={styles.dateModalHeader}>
                        <TouchableOpacity onPress={() => setShowEventDatePicker(false)}>
                          <Text style={[styles.dateModalAction, { color: colors.textMuted }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowEventDatePicker(false)}>
                          <Text style={[styles.dateModalAction, { color: BRAND_PURPLE, fontWeight: '700' }]}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={eventDate ?? new Date()}
                        mode="date"
                        display="spinner"
                        minimumDate={new Date()}
                        onChange={(_, date) => {
                          if (date) setEventDate(date)
                        }}
                      />
                    </View>
                  </View>
                </Modal>

                <Modal visible={showEventTimePicker} transparent animationType="slide">
                  <View style={styles.dateModalBackdrop}>
                    <View style={[styles.dateModalSheet, { backgroundColor: colors.surface }]}>
                      <View style={styles.dateModalHeader}>
                        <TouchableOpacity onPress={() => setShowEventTimePicker(false)}>
                          <Text style={[styles.dateModalAction, { color: colors.textMuted }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowEventTimePicker(false)}>
                          <Text style={[styles.dateModalAction, { color: BRAND_PURPLE, fontWeight: '700' }]}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={eventTime ?? new Date()}
                        mode="time"
                        display="spinner"
                        onChange={(_, date) => {
                          if (date) setEventTime(date)
                        }}
                      />
                    </View>
                  </View>
                </Modal>
              </>
            )}

            <TouchableOpacity
              style={[styles.eventFundContinue, !eventFundDetailsValid && styles.eventContinueDisabled]}
              activeOpacity={eventFundDetailsValid ? 0.86 : 1}
              onPress={() => {
                if (!eventFundDetailsValid) return
                if (!name.trim()) setName(derivedFundName)
                setEventFundDetailsDone(true)
              }}
            >
              <Text style={styles.eventFundContinueText}>Continue</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  if (createOption === 'eventFund' && eventFundDetailsDone && !eventFundOrganisersDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND_PURPLE} />

        <View style={styles.eventFundHero}>
          <View style={styles.eventFundHeroTop}>
            <TouchableOpacity style={styles.eventFundBack} onPress={handleBack} hitSlop={BACK_HIT_SLOP}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.eventFundPillCompact}>
              <Text style={styles.eventFundPillTextSingle}>Event + Fund</Text>
            </View>

            <View style={styles.eventFundCostInline}>
              <Text style={styles.eventFundCostText}>15</Text>
              <View style={styles.eventFundCoin}>
                <Ionicons name="server" size={12} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <View style={styles.eventFundProgress}>
            <View style={[styles.eventFundProgressSegment, styles.eventFundProgressActive]} />
            <View style={[styles.eventFundProgressSegment, styles.eventFundProgressActive]} />
            <View style={[styles.eventFundProgressSegment, styles.eventFundProgressActive]} />
            <View style={styles.eventFundProgressSegment} />
          </View>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={styles.organisersScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.organisersTitle}>Add organisers</Text>
            <Text style={styles.organisersSubtitle}>
              Who's on the planning committee? They'll manage both the event and fund.
            </Text>

            <TouchableOpacity
              style={styles.addContactsButton}
              activeOpacity={0.84}
              onPress={handleAddFromContacts}
            >
              <View style={styles.addContactsIcon}>
                <Ionicons name="people-outline" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.addContactsBody}>
                <Text style={styles.addContactsTitle}>Add people from contacts</Text>
                <Text style={styles.addContactsSubtitle}>Choose organisers from your phone book</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <Text style={styles.previousConnectionsLabel}>Search previous connections</Text>
            <View style={styles.organiserSearchBox}>
              <Text style={styles.organiserSearchIcon}>🔍</Text>
              <TextInput
                style={styles.organiserSearchInput}
                placeholder="Search connected users"
                placeholderTextColor={colors.textMuted}
                value={organiserSearch}
                onChangeText={setOrganiserSearch}
                returnKeyType="search"
              />
            </View>

            <Text style={styles.organisersSectionTitle}>ORGANISERS ({3 + pickedOrganisers.length})</Text>

            <View style={[styles.organiserCard, styles.creatorOrganiserCard]}>
              <View style={styles.creatorAvatar}>
                <Text style={styles.organiserAvatarText}>TM</Text>
              </View>
              <View style={styles.organiserBody}>
                <Text style={styles.organiserName} numberOfLines={1}>Tshephang Moagi</Text>
                <Text style={styles.creatorMeta} numberOfLines={1}>👑 You (creator)</Text>
              </View>
            </View>

            {renderPickedOrganisers()}

            <View style={styles.organiserCard}>
              <View style={styles.blueAvatar}>
                <Text style={styles.organiserAvatarText}>MK</Text>
              </View>
              <View style={styles.organiserBody}>
                <Text style={styles.organiserName} numberOfLines={1}>Mpho Kgosi</Text>
                <Text style={styles.organiserPhone} numberOfLines={1}>+267 74 123 456</Text>
              </View>
              <TouchableOpacity style={styles.organiserRemove} activeOpacity={0.75}>
                <Ionicons name="close" size={28} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.organiserCard}>
              <View style={styles.orangeAvatar}>
                <Text style={styles.organiserAvatarText}>KM</Text>
              </View>
              <View style={styles.organiserBody}>
                <Text style={styles.organiserName} numberOfLines={1}>Kago Modise</Text>
                <Text style={styles.organiserPhone} numberOfLines={1}>+267 74 789 012</Text>
              </View>
              <TouchableOpacity style={styles.organiserRemove} activeOpacity={0.75}>
                <Ionicons name="close" size={28} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.organisersNote}>You can add more organisers later</Text>

            <TouchableOpacity style={styles.eventFundContinue} activeOpacity={0.86} onPress={() => setEventFundOrganisersDone(true)}>
              <Text style={styles.eventFundContinueText}>Continue</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  if (createOption === 'eventFund' && eventFundOrganisersDone) {
    const budgetAmount = parseAmount(eventBudget)
    const fundGoalAmount = Math.round(budgetAmount * fundGoalPercent / 100)
    const youPayAmount = Math.max(budgetAmount - fundGoalAmount, 0)
    const canCreateEventFund = budgetAmount > 0 && eventName.trim().length >= 3

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND_PURPLE} />

        <View style={styles.eventFundHero}>
          <View style={styles.eventFundHeroTop}>
            <TouchableOpacity style={styles.eventFundBack} onPress={handleBack} hitSlop={BACK_HIT_SLOP}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.eventFundPillCompact}>
              <Text style={styles.eventFundPillTextSingle}>Event + Fund</Text>
            </View>

            <View style={styles.eventFundCostInline}>
              <Text style={styles.eventFundCostText}>15</Text>
              <View style={styles.eventFundCoin}>
                <Ionicons name="server" size={12} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <View style={styles.eventFundProgress}>
            <View style={[styles.eventFundProgressSegment, styles.eventFundProgressActive]} />
            <View style={[styles.eventFundProgressSegment, styles.eventFundProgressActive]} />
            <View style={[styles.eventFundProgressSegment, styles.eventFundProgressActive]} />
            <View style={[styles.eventFundProgressSegment, styles.eventFundProgressActive]} />
          </View>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={styles.budgetScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.budgetTitle}>Budget &amp; Goal</Text>
            <Text style={styles.budgetSubtitle}>Set your event budget and fund goal</Text>

            <View style={styles.budgetSectionTitleRow}>
              <Text style={styles.budgetSectionIcon}>📋</Text>
              <Text style={styles.budgetSectionTitle}>Event Budget</Text>
            </View>
            <Text style={styles.budgetPrompt}>How much will this event cost in total?</Text>

            <View style={styles.eventBudgetInputBox}>
              <Text style={styles.eventBudgetCurrency}>P</Text>
              <TextInput
                style={styles.eventBudgetInput}
                value={eventBudget}
                onChangeText={handleEventBudgetChange}
                keyboardType="decimal-pad"
                placeholder="50,000"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.eventBudgetPresetRow}>
              {EVENT_BUDGET_PRESETS.map(preset => {
                const active = eventBudget.replace(/,/g, '') === preset.value.replace(/,/g, '')
                return (
                  <TouchableOpacity
                    key={preset.value}
                    style={[styles.eventBudgetPreset, active && styles.eventBudgetPresetActive]}
                    activeOpacity={0.84}
                    onPress={() => setEventBudget(preset.value)}
                  >
                    <Text style={[styles.eventBudgetPresetText, active && styles.eventBudgetPresetTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.fundGoalHeaderRow}>
              <Text style={styles.fundGoalIcon}>💜</Text>
              <Text style={styles.budgetSectionTitle}>Fund Goal</Text>
            </View>
            <Text style={styles.budgetPrompt}>How much do you want to raise?</Text>

            <Text style={styles.percentValue}>{fundGoalPercent}%</Text>
            <Text style={styles.percentCaption}>of budget</Text>

            <View style={styles.percentTrack}>
              <View style={[styles.percentFill, { width: `${fundGoalPercent}%` as any }]} />
              <View style={[styles.percentThumb, { left: `${fundGoalPercent}%` as any }]} />
            </View>
            <View style={styles.percentLabels}>
              <Text style={styles.percentLabel}>0%</Text>
              <Text style={styles.percentLabel}>50%</Text>
              <Text style={styles.percentLabel}>100%</Text>
            </View>

            <View style={styles.fundGoalCard}>
              <Text style={styles.fundGoalCardLabel}>Your fund goal</Text>
              <Text style={styles.fundGoalCardValue}>{formatWholeAmount(fundGoalAmount)}</Text>
            </View>

            <View style={styles.budgetSummaryCard}>
              <View style={styles.budgetSummaryItem}>
                <Text style={styles.budgetSummaryLabel}>BUDGET</Text>
                <Text style={styles.budgetSummaryBudget}>{formatWholeAmount(budgetAmount)}</Text>
              </View>
              <View style={styles.budgetSummaryItem}>
                <Text style={styles.budgetSummaryLabel}>RAISE</Text>
                <Text style={styles.budgetSummaryRaise}>{formatWholeAmount(fundGoalAmount)}</Text>
              </View>
              <View style={styles.budgetSummaryItem}>
                <Text style={styles.budgetSummaryLabel}>YOU PAY</Text>
                <Text style={styles.budgetSummaryPay}>{formatWholeAmount(youPayAmount)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.createEventFundButton, !canCreateEventFund && styles.eventContinueDisabled]}
              activeOpacity={canCreateEventFund ? 0.86 : 1}
              onPress={() => {
                if (!canCreateEventFund) return
                navigation.replace('FundCreated', {
                  fundName:   name.trim() || `${eventName.trim()} Fund`,
                  category:   selectedEventLabel,
                  emoji:      selectedEventEmoji,
                  goalBWP:    `${fundGoalAmount}`,
                  targetDate: eventDate ? formatDateISO(eventDate) : undefined,
                })
              }}
            >
              <Text style={styles.createEventFundButtonText}>✨ Create Event +{'\n'}Fund</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  if (createOption === 'eventFund' && !eventFundTypeDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND_PURPLE} />

        <View style={styles.eventFundHero}>
          <View style={styles.eventFundHeroTop}>
            <TouchableOpacity style={styles.eventFundBack} onPress={handleBack} hitSlop={BACK_HIT_SLOP}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.eventFundPill}>
              <Text style={styles.eventFundSparkle}>✨</Text>
              <Text style={styles.eventFundPillText}>Event +{'\n'}Fund</Text>
            </View>

            <View style={styles.eventFundCost}>
              <Text style={styles.eventFundCostText}>15</Text>
              <View style={styles.eventFundCoin}>
                <Ionicons name="server" size={12} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <View style={styles.eventFundProgress}>
            <View style={[styles.eventFundProgressSegment, styles.eventFundProgressActive]} />
            <View style={styles.eventFundProgressSegment} />
            <View style={styles.eventFundProgressSegment} />
            <View style={styles.eventFundProgressSegment} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.eventFundScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.eventFundTitle}>Event type</Text>
          <Text style={styles.eventFundSubtitle}>What are you planning?</Text>

          <View style={styles.eventFundGrid}>
            {EVENT_TYPES.slice(0, 4).map(item => {
              const active = eventType.id === item.id
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.eventFundTypeCard, active && styles.eventFundTypeCardActive]}
                  activeOpacity={0.84}
                  onPress={() => setEventType(item)}
                >
                  <Text style={styles.eventFundTypeEmoji}>{item.emoji}</Text>
                  <Text style={[styles.eventFundTypeLabel, active && styles.eventFundTypeLabelActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            style={styles.eventFundContinue}
            activeOpacity={0.86}
            onPress={() => {
              setSelectedEmoji({ id: eventType.id, label: selectedEventLabel, emoji: selectedEventEmoji })
              setEventFundTypeDone(true)
            }}
          >
            <Text style={styles.eventFundContinueText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (createOption === 'event') {
    if (eventCreated) {
      const createdEventName = eventName.trim() || `${selectedEventLabel} Event`
      return (
        <SafeAreaView style={styles.safe}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

          <View style={styles.eventCreatedScreen}>
            <View style={styles.eventCreatedConfetti}>
              <Text style={styles.confettiLeft}>🎉</Text>
              <Text style={styles.confettiMiddle}>🎊</Text>
              <Text style={styles.confettiRight}>✨</Text>
            </View>

            <View style={styles.eventCreatedIconCircle}>
              <Ionicons name="checkmark" size={36} color="#16A34A" />
            </View>

            <Text style={styles.eventCreatedTitle}>Event Created!</Text>

            <View style={styles.eventCreatedCard}>
              <Text style={styles.eventCreatedEmoji}>{selectedEventEmoji}</Text>
              <View style={styles.eventCreatedCardBody}>
                <Text style={styles.eventCreatedName}>{createdEventName}</Text>
                <View style={styles.eventCreatedMetaRow}>
                  <Ionicons name="calendar-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.eventCreatedMeta}>
                    {eventDate ? formatEventDateDisplay(eventDate) : 'Date to be confirmed'}
                  </Text>
                </View>
                <View style={styles.eventCreatedMetaRow}>
                  <Ionicons name="location-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.eventCreatedMeta}>
                    {eventVenue.trim() || 'Venue to be confirmed'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.eventCreatedInviteText}>Now invite your guests!</Text>

            <TouchableOpacity
              style={styles.shareRsvpButton}
              activeOpacity={0.86}
              onPress={() => navigation.popToTop()}
            >
              <Ionicons name="link-outline" size={22} color="#FFFFFF" />
              <Text style={styles.shareRsvpButtonText}>Share RSVP{'\n'}Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.eventCreatedDoneButton}
              activeOpacity={0.78}
              onPress={() => navigation.popToTop()}
            >
              <Text style={styles.eventCreatedDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )
    }

    if (eventStep === 3) {
      return (
        <SafeAreaView style={styles.safe}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

          <View style={styles.eventHeader}>
            <TouchableOpacity style={styles.fundBackButton} onPress={handleBack} hitSlop={BACK_HIT_SLOP}>
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.eventHeaderText}>
              <Text style={styles.eventHeaderTitle}>Add Organisers</Text>
              <Text style={styles.eventHeaderStep}>Step 3 of 3</Text>
            </View>
            <View style={styles.titleBarSpacer} />
          </View>

          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              contentContainerStyle={styles.eventOnlyOrganisersScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.organisersTitle}>Add organisers</Text>
              <Text style={styles.organisersSubtitle}>
                Who's on the planning committee? They'll help manage your event.
              </Text>

              <TouchableOpacity
                style={styles.addContactsButton}
                activeOpacity={0.84}
                onPress={handleAddFromContacts}
              >
                <View style={styles.addContactsIcon}>
                  <Ionicons name="people-outline" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.addContactsBody}>
                  <Text style={styles.addContactsTitle}>Add people from contacts</Text>
                  <Text style={styles.addContactsSubtitle}>Choose organisers from your phone book</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.previousConnectionsLabel}>Search previous connections</Text>
              <View style={styles.organiserSearchBox}>
                <Text style={styles.organiserSearchIcon}>🔍</Text>
                <TextInput
                  style={styles.organiserSearchInput}
                  placeholder="Search connected users"
                  placeholderTextColor={colors.textMuted}
                  value={organiserSearch}
                  onChangeText={setOrganiserSearch}
                  returnKeyType="search"
                />
              </View>

              <Text style={styles.organisersSectionTitle}>ORGANISERS ({1 + pickedOrganisers.length})</Text>

              <View style={[styles.organiserCard, styles.creatorOrganiserCard]}>
                <View style={styles.creatorAvatar}>
                  <Text style={styles.organiserAvatarText}>ME</Text>
                </View>
                <View style={styles.organiserBody}>
                  <Text style={styles.organiserName} numberOfLines={1}>You</Text>
                  <Text style={styles.creatorMeta} numberOfLines={1}>👑 You (creator)</Text>
                </View>
              </View>

              {renderPickedOrganisers()}

              <Text style={styles.organisersNote}>You can add more organisers later</Text>

              <TouchableOpacity
                style={[styles.eventContinueButton, isCreatingEvent && styles.eventContinueDisabled]}
                activeOpacity={isCreatingEvent ? 1 : 0.86}
                onPress={handleCreateEvent}
              >
                <Text style={styles.eventContinueText}>{isCreatingEvent ? 'Creating...' : 'Create Event'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      )
    }

    if (eventStep === 2) {
      return (
        <SafeAreaView style={styles.safe}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

          <View style={styles.eventHeader}>
            <TouchableOpacity style={styles.fundBackButton} onPress={handleBack} hitSlop={BACK_HIT_SLOP}>
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.eventHeaderText}>
              <Text style={styles.eventHeaderTitle}>Event Details</Text>
              <Text style={styles.eventHeaderStep}>Step 2 of 3</Text>
            </View>
            <View style={styles.titleBarSpacer} />
          </View>

          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              contentContainerStyle={styles.eventDetailsScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.eventDetailsField}>
                <Text style={styles.eventDetailsLabel}>Event name</Text>
                <TextInput
                  style={styles.eventDetailsInput}
                  placeholder={`${selectedEventLabel} event`}
                  placeholderTextColor={colors.textMuted}
                  value={eventName}
                  onChangeText={setEventName}
                  maxLength={90}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.eventDetailsField}>
                <Text style={styles.eventDetailsLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.eventDetailsPicker}
                  activeOpacity={0.84}
                  onPress={() => setShowEventDatePicker(true)}
                >
                  <Text style={[styles.eventDetailsPickerText, !eventDate && { color: colors.textMuted }]}>
                    {eventDate ? formatEventDateDisplay(eventDate) : 'Select date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.eventDetailsField}>
                <Text style={styles.eventDetailsLabel}>Time</Text>
                <TouchableOpacity
                  style={styles.eventDetailsPicker}
                  activeOpacity={0.84}
                  onPress={() => setShowEventTimePicker(true)}
                >
                  <Text style={[styles.eventDetailsPickerText, !eventTime && { color: colors.textMuted }]}>
                    {eventTime ? formatTimeDisplay(eventTime) : 'Select time'}
                  </Text>
                  <Ionicons name="time-outline" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.eventDetailsField}>
                <Text style={styles.eventDetailsLabel}>Venue</Text>
                <View style={styles.eventDetailsVenueRow}>
                  <TextInput
                    style={styles.eventDetailsVenueInput}
                    placeholder="Cresta Lodge, Gaborone"
                    placeholderTextColor={colors.textMuted}
                    value={eventVenue}
                    onChangeText={setEventVenue}
                    multiline
                    maxLength={120}
                    textAlignVertical="center"
                  />
                  <Ionicons name="location-outline" size={22} color={colors.textMuted} />
                </View>
              </View>

              {Platform.OS === 'android' && showEventDatePicker && (
                <DateTimePicker
                  value={eventDate ?? new Date()}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    setShowEventDatePicker(false)
                    if (date) setEventDate(date)
                  }}
                />
              )}
              {Platform.OS === 'android' && showEventTimePicker && (
                <DateTimePicker
                  value={eventTime ?? new Date()}
                  mode="time"
                  onChange={(_, date) => {
                    setShowEventTimePicker(false)
                    if (date) setEventTime(date)
                  }}
                />
              )}
              {Platform.OS === 'ios' && (
                <>
                  <Modal visible={showEventDatePicker} transparent animationType="slide">
                    <View style={styles.dateModalBackdrop}>
                      <View style={[styles.dateModalSheet, { backgroundColor: colors.surface }]}>
                        <View style={styles.dateModalHeader}>
                          <TouchableOpacity onPress={() => setShowEventDatePicker(false)}>
                            <Text style={[styles.dateModalAction, { color: colors.textMuted }]}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setShowEventDatePicker(false)}>
                            <Text style={[styles.dateModalAction, { color: BRAND_PURPLE, fontWeight: '700' }]}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={eventDate ?? new Date()}
                          mode="date"
                          display="spinner"
                          minimumDate={new Date()}
                          onChange={(_, date) => {
                            if (date) setEventDate(date)
                          }}
                        />
                      </View>
                    </View>
                  </Modal>

                  <Modal visible={showEventTimePicker} transparent animationType="slide">
                    <View style={styles.dateModalBackdrop}>
                      <View style={[styles.dateModalSheet, { backgroundColor: colors.surface }]}>
                        <View style={styles.dateModalHeader}>
                          <TouchableOpacity onPress={() => setShowEventTimePicker(false)}>
                            <Text style={[styles.dateModalAction, { color: colors.textMuted }]}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setShowEventTimePicker(false)}>
                            <Text style={[styles.dateModalAction, { color: BRAND_PURPLE, fontWeight: '700' }]}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={eventTime ?? new Date()}
                          mode="time"
                          display="spinner"
                          onChange={(_, date) => {
                            if (date) setEventTime(date)
                          }}
                        />
                      </View>
                    </View>
                  </Modal>
                </>
              )}

              <TouchableOpacity
                style={[styles.eventContinueButton, !eventDetailsValid && styles.eventContinueDisabled]}
                activeOpacity={eventDetailsValid ? 0.86 : 1}
                onPress={() => {
                  if (!eventDetailsValid) return
                  setEventStep(3)
                }}
              >
                <Text style={styles.eventContinueText}>Continue</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      )
    }

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

        <View style={styles.eventHeader}>
          <TouchableOpacity style={styles.fundBackButton} onPress={handleBack} hitSlop={BACK_HIT_SLOP}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.eventHeaderText}>
            <Text style={styles.eventHeaderTitle}>Create Event</Text>
            <Text style={styles.eventHeaderStep}>Step 1 of 3</Text>
          </View>
          <View style={styles.titleBarSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.eventScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eventQuestion}>What are you planning?</Text>

          <View style={styles.eventGrid}>
            {EVENT_TYPES.map(item => {
              const active = eventType.id === item.id
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.eventTypeCard, active && styles.eventTypeCardActive]}
                  activeOpacity={0.84}
                  onPress={() => setEventType(item)}
                >
                  <Text style={styles.eventTypeEmoji}>{item.emoji}</Text>
                  <Text style={[styles.eventTypeLabel, active && styles.eventTypeLabelActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {isOtherEvent && (
            <View style={styles.customEventPanel}>
              <Text style={styles.customEventLabel}>Custom event type</Text>
              <TextInput
                style={styles.customEventInput}
                placeholder="Name your event type"
                placeholderTextColor={colors.textMuted}
                value={customEventType}
                onChangeText={setCustomEventType}
                maxLength={32}
                autoCapitalize="words"
                returnKeyType="done"
              />

              <Text style={styles.customEmojiLabel}>Choose an emoji</Text>
              <View style={styles.customEmojiRow}>
                {CUSTOM_EVENT_EMOJIS.map(emoji => {
                  const active = customEventEmoji === emoji
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[styles.customEmojiButton, active && styles.customEmojiButtonActive]}
                      activeOpacity={0.84}
                      onPress={() => setCustomEventEmoji(emoji)}
                    >
                      <Text style={styles.customEmojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  )
                })}
                <TouchableOpacity
                  style={styles.customEmojiMoreButton}
                  activeOpacity={0.84}
                  onPress={() => setShowCustomEmojiDialog(true)}
                >
                  <Ionicons name="add" size={22} color={BRAND_PURPLE} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Modal
            visible={showCustomEmojiDialog}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCustomEmojiDialog(false)}
          >
            <View style={styles.emojiDialogBackdrop}>
              <View style={styles.emojiDialogCard}>
                <View style={styles.emojiDialogHeader}>
                  <Text style={styles.emojiDialogTitle}>Choose emoji</Text>
                  <TouchableOpacity
                    style={styles.emojiDialogClose}
                    activeOpacity={0.75}
                    onPress={() => setShowCustomEmojiDialog(false)}
                  >
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.emojiSearchBox}>
                  <Ionicons name="search" size={18} color={colors.textMuted} />
                  <TextInput
                    style={styles.emojiSearchInput}
                    placeholder="Search emojis"
                    placeholderTextColor={colors.textMuted}
                    value={emojiSearch}
                    onChangeText={setEmojiSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.emojiCategoryRow}
                >
                  {emojiCategoryOptions.map(category => {
                    const active = emojiCategory === category
                    return (
                      <TouchableOpacity
                        key={category}
                        style={[styles.emojiCategoryChip, active && styles.emojiCategoryChipActive]}
                        activeOpacity={0.84}
                        onPress={() => setEmojiCategory(category)}
                      >
                        <Text style={[styles.emojiCategoryText, active && styles.emojiCategoryTextActive]}>
                          {EMOJI_CATEGORY_LABELS[category] ?? category}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}

                </ScrollView>

                <FlatList
                  data={filteredEmojiItems}
                  keyExtractor={item => item.id}
                  numColumns={6}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.emojiDialogGrid}
                  columnWrapperStyle={styles.emojiDialogGridRow}
                  initialNumToRender={48}
                  maxToRenderPerBatch={60}
                  windowSize={8}
                  ListEmptyComponent={(
                    <Text style={styles.emojiEmptyText}>No emojis found</Text>
                  )}
                  renderItem={({ item }) => {
                    const active = customEventEmoji === item.native
                    return (
                      <TouchableOpacity
                        style={[styles.emojiDialogChoice, active && styles.emojiDialogChoiceActive]}
                        activeOpacity={0.84}
                        onPress={() => {
                          setCustomEventEmoji(item.native)
                          setShowCustomEmojiDialog(false)
                        }}
                      >
                        <Text style={styles.emojiDialogChoiceText}>{item.native}</Text>
                      </TouchableOpacity>
                    )
                  }}
                />
              </View>
            </View>
          </Modal>

          <TouchableOpacity
            style={[styles.eventContinueButton, !eventTypeStepValid && styles.eventContinueDisabled]}
            activeOpacity={eventTypeStepValid ? 0.86 : 1}
            onPress={() => {
              if (!eventTypeStepValid) return
              setEventStep(2)
            }}
          >
            <Text style={styles.eventContinueText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (createOption !== 'eventFund' || eventFundOrganisersDone) {
  if (!currencyDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

        <View style={styles.currencyHeader}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} hitSlop={BACK_HIT_SLOP}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.currencyTitle}>New Fund</Text>
          <View style={styles.titleBarSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.currencyScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.currencyIntro}>
            <Text style={styles.currencyIntroTitle}>Fund Currency</Text>
            <Text style={styles.currencyIntroText}>You can create funds in any currency</Text>
          </View>

          <View style={styles.currencyList}>
            {FUND_CURRENCIES.map(item => {
              const active = item.id === currency
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.currencyCard, active && styles.currencyCardActive]}
                  activeOpacity={0.86}
                  onPress={() => setCurrency(item.id)}
                >
                  {active && <Text style={styles.currencyWatermark}>{item.code.slice(0, 2)}</Text>}
                  <View style={styles.currencyCardBody}>
                    <Text style={styles.currencyCode}>{item.code}</Text>
                    <Text style={styles.currencyName}>({item.name})</Text>
                    {item.helper && <Text style={styles.currencyHelper}>{item.helper}</Text>}
                  </View>
                  <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                    {active && (
                      <View style={styles.radioInner}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={styles.currencyTip}>
            <Text style={styles.currencyTipIcon}>💡</Text>
            <Text style={styles.currencyTipText}>
              Choose based on where contributors are. Diaspora family? Use their local currency.
            </Text>
          </View>

          <TouchableOpacity style={styles.currencyContinue} activeOpacity={0.86} onPress={() => setCurrencyDone(true)}>
            <Text style={styles.currencyContinueText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.fundHeader}>
        <TouchableOpacity style={styles.fundBackButton} onPress={handleBack} hitSlop={BACK_HIT_SLOP}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.fundHeaderText}>
          <Text style={styles.fundHeaderTitle}>{isFirst ? 'Create Fund' : 'Create Fund'}</Text>
          <Text style={styles.fundHeaderStep}>Step 1 of 2 • {selectedCurrency.code}</Text>
        </View>
        <View style={styles.titleBarSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.fundFormScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.fundFormField}>
            <Text style={styles.fundFormLabel}>Fund name</Text>
            <TextInput
              style={styles.fundNameInput}
              placeholder="Mma's Funeral Fund"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={80}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fundFormField}>
            <Text style={styles.fundFormLabel}>Choose an emoji</Text>
            <View style={styles.emojiRow}>
              {EMOJI_OPTIONS.map(item => {
                const active = selectedEmoji.id === item.id
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.emojiChoice, active && styles.emojiChoiceActive]}
                    activeOpacity={0.84}
                    onPress={() => setSelectedEmoji(item)}
                  >
                    <Text style={styles.emojiChoiceText}>{item.emoji}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={styles.fundFormField}>
            <Text style={styles.fundFormLabel}>Fundraising goal <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.goalInputRow}>
              <Text style={styles.goalCurrencySymbol}>{selectedCurrency.symbol}</Text>
              <TextInput
                style={styles.goalInput}
                placeholder="15,000"
                placeholderTextColor={colors.textMuted}
                value={goalBWP}
                onChangeText={handleGoalChange}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            <View style={styles.goalPresetRow}>
              {GOAL_PRESETS.map(preset => {
                const active = goalBWP.replace(/,/g, '') === preset.value.replace(/,/g, '')
                return (
                  <TouchableOpacity
                    key={preset.value}
                    style={[styles.goalPreset, active && styles.goalPresetActive]}
                    activeOpacity={0.84}
                    onPress={() => setGoalBWP(preset.value)}
                  >
                    <Text style={[styles.goalPresetText, active && styles.goalPresetTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={styles.fundFormField}>
            <Text style={styles.fundFormLabel}>Target date <Text style={styles.optional}>(optional)</Text></Text>
            <TouchableOpacity
              style={styles.dateRow}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dateInput, !targetDate && { color: colors.textMuted }]}>
                {targetDate ? formatDateDisplay(targetDate) : 'Select date'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── Date picker (Android: inline dialog, iOS: modal) ── */}
          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker
              value={targetDate ?? new Date()}
              mode="date"
              minimumDate={new Date()}
              onChange={(_, date) => {
                setShowDatePicker(false)
                if (date) setTargetDate(date)
              }}
            />
          )}
          {Platform.OS === 'ios' && (
            <Modal visible={showDatePicker} transparent animationType="slide">
              <View style={styles.dateModalBackdrop}>
                <View style={[styles.dateModalSheet, { backgroundColor: colors.surface }]}>
                  <View style={styles.dateModalHeader}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={[styles.dateModalAction, { color: colors.textMuted }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={[styles.dateModalAction, { color: BRAND_PURPLE, fontWeight: '700' }]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={targetDate ?? new Date()}
                    mode="date"
                    display="spinner"
                    minimumDate={new Date()}
                    onChange={(_, date) => {
                      if (date) setTargetDate(date)
                    }}
                  />
                </View>
              </View>
            </Modal>
          )}

          <TouchableOpacity
            style={[styles.fundContinueButton, !isValid && styles.fundContinueDisabled]}
            activeOpacity={isValid ? 0.85 : 1}
            onPress={() => {
              if (!isValid) return
              navigation.replace('FundCreated', {
                fundName:   name.trim(),
                category:   selectedEmoji.label,
                emoji:      selectedEmoji.emoji,
                goalBWP:    goalBWP || undefined,
                targetDate: targetDate ? formatDateISO(targetDate) : undefined,
              })
            }}
          >
            <Text style={styles.fundContinueText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },

    // ── Create type picker ─────────────────────────────────────
    createHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 10,
    },
    createTitle: {
      flex: 1,
      fontSize: 34,
      fontFamily: fonts.display.bold,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    optionScroll: {
      flexGrow: 1,
      paddingHorizontal: 28,
      paddingTop: 28,
      paddingBottom: 48,
      gap: 24,
    },
    optionCard: {
      minHeight: 154,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 24,
      paddingVertical: 26,
      paddingLeft: 24,
      paddingRight: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.04,
      shadowRadius: 14,
      elevation: 2,
    },
    optionCardFeatured: {
      borderColor: BRAND_PURPLE,
      borderWidth: 2,
      backgroundColor: BRAND_LAVENDER,
      shadowColor: BRAND_PURPLE,
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 5,
    },
    optionIconRail: {
      width: 48,
      height: 84,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 22,
    },
    optionBody: {
      flex: 1,
      paddingRight: 10,
    },
    optionTitle: {
      fontSize: 22,
      lineHeight: 29,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 10,
    },
    optionDescription: {
      fontSize: 16,
      lineHeight: 23,
      fontWeight: '500',
      color: colors.textMuted,
    },
    priceBadge: {
      minWidth: 76,
      minHeight: 40,
      borderRadius: 20,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_LAVENDER,
      marginRight: -24,
    },
    priceBadgeText: {
      fontSize: 16,
      fontWeight: '900',
      color: BRAND_PURPLE_DARK,
    },
    tokenBadge: {
      minWidth: 76,
      flexDirection: 'row',
      gap: 8,
      backgroundColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    tokenBadgeText: {
      color: BRAND_PURPLE,
    },
    tokenCoin: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_ACCENT,
    },
    bestValueBadge: {
      position: 'absolute',
      top: -18,
      left: '50%',
      width: 142,
      marginLeft: -71,
      backgroundColor: BRAND_ACCENT,
      borderRadius: 18,
      paddingVertical: 7,
      paddingHorizontal: 18,
      zIndex: 1,
    },
    bestValueText: {
      fontSize: 13,
      fontWeight: '900',
      color: '#FFFFFF',
    },

    // ── Event + Fund event type picker ─────────────────────────
    eventFundHero: {
      backgroundColor: BRAND_PURPLE,
      paddingHorizontal: 26,
      paddingTop: 20,
      paddingBottom: 26,
    },
    eventFundHeroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 26,
    },
    eventFundBack: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventFundPill: {
      minWidth: 188,
      minHeight: 74,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: 36,
      paddingHorizontal: 24,
    },
    eventFundSparkle: {
      fontSize: 22,
    },
    eventFundPillText: {
      fontSize: 19,
      lineHeight: 25,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    eventFundPillCompact: {
      minWidth: 172,
      minHeight: 68,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: 32,
      paddingHorizontal: 22,
    },
    eventFundPillTextSingle: {
      fontSize: 18,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    eventFundCost: {
      width: 46,
      alignItems: 'center',
    },
    eventFundCostInline: {
      width: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    eventFundCostText: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '900',
      color: '#FFFFFF',
      marginBottom: 6,
    },
    eventFundCoin: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_ACCENT,
    },
    eventFundProgress: {
      flexDirection: 'row',
      gap: 12,
    },
    eventFundProgressSegment: {
      flex: 1,
      height: 7,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.32)',
    },
    eventFundProgressActive: {
      backgroundColor: '#55CFC6',
    },
    eventFundScroll: {
      flexGrow: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: 28,
      paddingTop: 38,
      paddingBottom: 44,
    },
    eventFundTitle: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    eventFundSubtitle: {
      fontSize: 19,
      lineHeight: 25,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 28,
    },
    eventFundGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 20,
      marginBottom: 34,
    },
    eventFundTypeCard: {
      width: '47%',
      minHeight: 164,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 24,
    },
    eventFundTypeCardActive: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    eventFundTypeEmoji: {
      fontSize: 48,
      marginBottom: 20,
    },
    eventFundTypeLabel: {
      fontSize: 20,
      lineHeight: 25,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    eventFundTypeLabelActive: {
      color: BRAND_PURPLE,
      fontWeight: '900',
    },
    eventFundContinue: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE_DARK,
      borderRadius: 28,
      paddingVertical: 17,
      shadowColor: BRAND_PURPLE,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 6,
    },
    eventFundContinueText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    eventFundDetailsScroll: {
      flexGrow: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: 28,
      paddingTop: 34,
      paddingBottom: 44,
    },
    eventFundDetailsIntro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      marginBottom: 28,
    },
    eventFundDetailsEmoji: {
      width: 76,
      fontSize: 48,
      textAlign: 'center',
    },
    eventFundDetailsIntroText: {
      flex: 1,
    },
    eventFundDetailsTitle: {
      fontSize: 27,
      lineHeight: 33,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    eventFundDetailsSubtitle: {
      fontSize: 18,
      lineHeight: 25,
      color: colors.textMuted,
    },
    eventFundDetailsField: {
      marginBottom: 24,
    },
    eventFundDetailsLabel: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 10,
    },
    eventFundDetailsNameInput: {
      minHeight: 116,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
      borderRadius: 16,
      paddingHorizontal: 22,
      paddingVertical: 18,
      fontSize: 21,
      lineHeight: 27,
      color: colors.textPrimary,
    },
    eventFundDateTimeRow: {
      flexDirection: 'row',
      gap: 20,
      marginBottom: 24,
    },
    eventFundDateTimeField: {
      flex: 1,
    },
    eventFundDateTimeBox: {
      minHeight: 92,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 16,
    },
    eventFundDateTimeText: {
      fontSize: 19,
      lineHeight: 25,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    eventFundVenueBox: {
      minHeight: 100,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 22,
    },
    eventFundVenueInput: {
      flex: 1,
      fontSize: 19,
      lineHeight: 26,
      color: colors.textPrimary,
      paddingVertical: 18,
    },
    eventFundNameCard: {
      backgroundColor: BRAND_LAVENDER,
      borderRadius: 18,
      paddingHorizontal: 22,
      paddingVertical: 20,
      marginBottom: 28,
    },
    eventFundNameHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    eventFundNameLabel: {
      fontSize: 16,
      fontWeight: '900',
      color: BRAND_PURPLE,
    },
    eventFundEditText: {
      fontSize: 16,
      fontWeight: '700',
      color: BRAND_PURPLE,
    },
    eventFundDerivedName: {
      fontSize: 21,
      lineHeight: 28,
      color: colors.textPrimary,
    },
    organisersScroll: {
      flexGrow: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: 28,
      paddingTop: 34,
      paddingBottom: 44,
    },
    eventOnlyOrganisersScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
    },
    organisersTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 10,
    },
    organisersSubtitle: {
      fontSize: 16,
      lineHeight: 23,
      color: colors.textMuted,
      marginBottom: 22,
    },
    addContactsButton: {
      minHeight: 74,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
      marginBottom: 18,
    },
    addContactsIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE,
    },
    addContactsBody: {
      flex: 1,
    },
    addContactsTitle: {
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    addContactsSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    previousConnectionsLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    organiserSearchBox: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 18,
      gap: 10,
      marginBottom: 22,
    },
    organiserSearchIcon: {
      fontSize: 20,
    },
    organiserSearchInput: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
      paddingVertical: 12,
    },
    organisersSectionTitle: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '900',
      color: colors.textMuted,
      marginBottom: 12,
    },
    organiserCard: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 12,
      marginBottom: 10,
    },
    creatorOrganiserCard: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: '#D8B4FE',
    },
    creatorAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE,
    },
    blueAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#2454D9',
    },
    orangeAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_ACCENT,
    },
    contactAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0F9F8D',
    },
    organiserAvatarText: {
      fontSize: 16,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    organiserBody: {
      flex: 1,
    },
    organiserName: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    creatorMeta: {
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '700',
      color: BRAND_PURPLE,
    },
    organiserPhone: {
      fontSize: 13,
      lineHeight: 17,
      color: colors.textMuted,
    },
    organiserRemove: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    organisersNote: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 2,
      marginBottom: 22,
    },
    budgetScroll: {
      flexGrow: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: 28,
      paddingTop: 34,
      paddingBottom: 44,
    },
    budgetTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    budgetSubtitle: {
      fontSize: 18,
      lineHeight: 26,
      color: colors.textMuted,
      marginBottom: 28,
    },
    budgetSectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    budgetSectionIcon: {
      fontSize: 24,
      width: 34,
      textAlign: 'center',
    },
    budgetSectionTitle: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    budgetPrompt: {
      fontSize: 16,
      lineHeight: 23,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 16,
    },
    eventBudgetInputBox: {
      minHeight: 108,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
      borderRadius: 16,
      paddingHorizontal: 22,
      marginBottom: 14,
    },
    eventBudgetCurrency: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.textMuted,
      marginRight: 2,
    },
    eventBudgetInput: {
      minWidth: 150,
      fontSize: 39,
      fontWeight: '900',
      color: colors.textPrimary,
      paddingVertical: 16,
      textAlign: 'center',
    },
    eventBudgetPresetRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 32,
    },
    eventBudgetPreset: {
      flex: 1,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F7F7FA',
      borderRadius: 9,
    },
    eventBudgetPresetActive: {
      backgroundColor: BRAND_PURPLE,
    },
    eventBudgetPresetText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textMuted,
    },
    eventBudgetPresetTextActive: {
      color: '#FFFFFF',
    },
    fundGoalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    fundGoalIcon: {
      fontSize: 25,
      width: 34,
      textAlign: 'center',
    },
    percentValue: {
      fontSize: 60,
      lineHeight: 68,
      fontWeight: '900',
      color: BRAND_PURPLE,
      textAlign: 'center',
      marginTop: 2,
    },
    percentCaption: {
      fontSize: 17,
      lineHeight: 23,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 20,
    },
    percentTrack: {
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.border,
      marginBottom: 12,
      overflow: 'visible',
    },
    percentFill: {
      height: '100%',
      borderRadius: 7,
      backgroundColor: BRAND_PURPLE,
    },
    percentThumb: {
      position: 'absolute',
      top: -8,
      width: 30,
      height: 30,
      borderRadius: 15,
      marginLeft: -15,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    percentLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 26,
    },
    percentLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textMuted,
    },
    fundGoalCard: {
      alignItems: 'center',
      backgroundColor: BRAND_LAVENDER,
      borderRadius: 18,
      paddingVertical: 24,
      marginBottom: 20,
    },
    fundGoalCardLabel: {
      fontSize: 18,
      color: BRAND_PURPLE,
      marginBottom: 8,
    },
    fundGoalCardValue: {
      fontSize: 38,
      lineHeight: 45,
      fontWeight: '900',
      color: BRAND_PURPLE,
    },
    budgetSummaryCard: {
      flexDirection: 'row',
      backgroundColor: '#DBEAFE',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 18,
      marginBottom: 28,
    },
    budgetSummaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    budgetSummaryLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      marginBottom: 6,
    },
    budgetSummaryBudget: {
      fontSize: 19,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    budgetSummaryRaise: {
      fontSize: 19,
      fontWeight: '900',
      color: BRAND_PURPLE,
    },
    budgetSummaryPay: {
      fontSize: 19,
      fontWeight: '900',
      color: '#EF4444',
    },
    createEventFundButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#16A34A',
      borderRadius: 28,
      paddingVertical: 17,
      shadowColor: '#16A34A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 6,
    },
    createEventFundButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '700',
      textAlign: 'center',
    },

    // ── Event type picker ──────────────────────────────────────
    eventHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 22,
      paddingTop: 14,
      paddingBottom: 12,
    },
    eventHeaderText: {
      flex: 1,
      paddingLeft: 8,
    },
    eventHeaderTitle: {
      fontSize: 26,
      fontFamily: fonts.display.bold,
      fontWeight: '900',
      color: colors.heading,
      marginBottom: 4,
    },
    eventHeaderStep: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: colors.textMuted,
    },
    eventScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 28,
      paddingTop: 34,
      paddingBottom: 44,
    },
    eventQuestion: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 28,
    },
    eventGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 22,
      marginBottom: 34,
    },
    eventTypeCard: {
      width: '46%',
      minHeight: 160,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 24,
    },
    eventTypeCardActive: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    eventTypeEmoji: {
      fontSize: 46,
      marginBottom: 22,
    },
    eventTypeLabel: {
      fontSize: 19,
      lineHeight: 24,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    eventTypeLabelActive: {
      color: colors.textPrimary,
    },
    customEventPanel: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginTop: -8,
      marginBottom: 24,
    },
    customEventLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 8,
    },
    customEventInput: {
      minHeight: 56,
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: BRAND_PURPLE,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 16,
    },
    customEmojiLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 10,
    },
    customEmojiRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    customEmojiButton: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
    },
    customEmojiButtonActive: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    customEmojiMoreButton: {
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: BRAND_PURPLE,
      borderRadius: 14,
    },
    customEmojiText: {
      fontSize: 24,
    },
    emojiDialogBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.38)',
      paddingHorizontal: 28,
    },
    emojiDialogCard: {
      width: '100%',
      maxWidth: 340,
      maxHeight: '82%',
      backgroundColor: colors.surface,
      borderRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emojiDialogHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    emojiDialogTitle: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    emojiDialogClose: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
      backgroundColor: colors.background,
    },
    emojiSearchBox: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      gap: 8,
      marginBottom: 12,
    },
    emojiSearchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      paddingVertical: 10,
    },
    emojiCategoryRow: {
      gap: 8,
      paddingBottom: 14,
    },
    emojiCategoryChip: {
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 17,
      paddingHorizontal: 13,
    },
    emojiCategoryChipActive: {
      backgroundColor: BRAND_LAVENDER,
      borderColor: BRAND_PURPLE,
    },
    emojiCategoryText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    emojiCategoryTextActive: {
      color: BRAND_PURPLE,
    },
    emojiDialogGrid: {
      paddingBottom: 4,
    },
    emojiDialogGridRow: {
      gap: 8,
      marginBottom: 8,
    },
    emojiDialogChoice: {
      flex: 1,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
    },
    emojiDialogChoiceActive: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    emojiDialogChoiceText: {
      fontSize: 24,
    },
    emojiEmptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 24,
    },
    eventContinueButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE_DARK,
      borderRadius: 28,
      paddingVertical: 17,
      shadowColor: BRAND_PURPLE,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 6,
    },
    eventContinueText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    eventCreatedScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: 36,
      backgroundColor: colors.background,
    },
    eventCreatedConfetti: {
      width: 190,
      height: 74,
      position: 'relative',
      marginBottom: 8,
    },
    confettiLeft: {
      position: 'absolute',
      left: 12,
      top: 8,
      fontSize: 24,
    },
    confettiMiddle: {
      position: 'absolute',
      left: 84,
      top: 38,
      fontSize: 17,
    },
    confettiRight: {
      position: 'absolute',
      right: 10,
      top: 12,
      fontSize: 22,
    },
    eventCreatedIconCircle: {
      width: 106,
      height: 106,
      borderRadius: 53,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#D1FAE5',
      marginBottom: 28,
    },
    eventCreatedTitle: {
      fontSize: 29,
      lineHeight: 36,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 26,
    },
    eventCreatedCard: {
      width: '100%',
      maxWidth: 280,
      minHeight: 150,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      backgroundColor: BRAND_PURPLE,
      borderRadius: 18,
      paddingHorizontal: 22,
      paddingVertical: 18,
      marginBottom: 28,
    },
    eventCreatedEmoji: {
      width: 58,
      fontSize: 40,
      textAlign: 'center',
    },
    eventCreatedCardBody: {
      flex: 1,
    },
    eventCreatedName: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '900',
      color: '#FFFFFF',
      marginBottom: 12,
    },
    eventCreatedMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    eventCreatedMeta: {
      flex: 1,
      fontSize: 14,
      lineHeight: 19,
      color: 'rgba(255,255,255,0.86)',
    },
    eventCreatedInviteText: {
      fontSize: 19,
      lineHeight: 26,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 20,
    },
    shareRsvpButton: {
      width: '100%',
      maxWidth: 280,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: '#2454D9',
      borderRadius: 28,
      paddingHorizontal: 24,
      paddingVertical: 17,
    },
    shareRsvpButtonText: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    eventCreatedDoneButton: {
      width: '100%',
      maxWidth: 280,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 28,
      paddingHorizontal: 24,
      paddingVertical: 15,
      marginTop: 14,
      backgroundColor: colors.surface,
    },
    eventCreatedDoneText: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    eventContinueDisabled: {
      backgroundColor: colors.disabled,
      shadowOpacity: 0,
      elevation: 0,
    },
    eventDetailsScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
    },
    eventDetailsField: {
      marginBottom: 20,
    },
    eventDetailsLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 8,
    },
    eventDetailsInput: {
      minHeight: 56,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 16,
      color: colors.textPrimary,
    },
    eventDetailsPicker: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 10,
    },
    eventDetailsPickerText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    eventDetailsVenueRow: {
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      gap: 10,
    },
    eventDetailsVenueInput: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
      paddingVertical: 16,
    },

    // ── Currency picker ────────────────────────────────────────
    currencyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 10,
    },
    currencyTitle: {
      flex: 1,
      fontSize: 28,
      fontFamily: fonts.display.bold,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    currencyScroll: {
      flexGrow: 1,
      paddingHorizontal: 28,
      paddingTop: 22,
      paddingBottom: 40,
    },
    currencyIntro: {
      marginBottom: 24,
    },
    currencyIntroTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 10,
    },
    currencyIntroText: {
      maxWidth: 270,
      fontSize: 17,
      lineHeight: 25,
      fontWeight: '500',
      color: colors.textMuted,
    },
    currencyList: {
      gap: 18,
      marginBottom: 28,
    },
    currencyCard: {
      minHeight: 120,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.035,
      shadowRadius: 14,
      elevation: 2,
    },
    currencyCardActive: {
      backgroundColor: BRAND_LAVENDER,
      borderColor: BRAND_PURPLE,
      borderWidth: 2,
    },
    currencyWatermark: {
      position: 'absolute',
      left: 30,
      fontSize: 28,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    currencyCardBody: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    currencyCode: {
      fontSize: 23,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    currencyName: {
      fontSize: 22,
      lineHeight: 29,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    currencyHelper: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '600',
      color: BRAND_PURPLE,
      textAlign: 'center',
      marginTop: 2,
    },
    radioOuter: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    radioOuterActive: {
      borderColor: BRAND_PURPLE,
      backgroundColor: BRAND_PURPLE,
    },
    radioInner: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    currencyTip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.accentLight,
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 18,
      marginBottom: 28,
    },
    currencyTipIcon: {
      fontSize: 16,
      marginTop: 1,
    },
    currencyTipText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 23,
      fontWeight: '500',
      color: '#92400E',
    },
    currencyContinue: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE,
      borderRadius: 28,
      paddingVertical: 17,
      shadowColor: BRAND_PURPLE,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },
    currencyContinueText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },

    // ── Fund details form ──────────────────────────────────────
    fundHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 22,
      paddingTop: 14,
      paddingBottom: 12,
    },
    fundBackButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fundHeaderText: {
      flex: 1,
      paddingLeft: 8,
    },
    fundHeaderTitle: {
      fontSize: 26,
      fontFamily: fonts.display.bold,
      fontWeight: '900',
      color: colors.heading,
      marginBottom: 4,
    },
    fundHeaderStep: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: colors.textMuted,
    },
    fundFormScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
    },
    fundFormField: {
      marginBottom: 20,
    },
    fundFormLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 8,
    },
    fundNameInput: {
      minHeight: 56,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 16,
      color: colors.textPrimary,
    },
    emojiRow: {
      flexDirection: 'row',
      gap: 16,
    },
    emojiChoice: {
      width: 62,
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
    },
    emojiChoiceActive: {
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
      backgroundColor: BRAND_LAVENDER,
    },
    emojiChoiceText: {
      fontSize: 34,
    },
    goalInputRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      gap: 10,
      marginBottom: 14,
    },
    goalCurrencySymbol: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textMuted,
    },
    goalInput: {
      flex: 1,
      fontSize: 16,
      color: colors.textPrimary,
      paddingVertical: 16,
    },
    goalPresetRow: {
      flexDirection: 'row',
      gap: 12,
    },
    goalPreset: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
    },
    goalPresetActive: {
      backgroundColor: BRAND_PURPLE,
      borderColor: BRAND_PURPLE,
    },
    goalPresetText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textMuted,
    },
    goalPresetTextActive: {
      color: '#FFFFFF',
    },
    fundContinueButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE,
      borderRadius: 28,
      paddingVertical: 17,
      marginTop: 4,
      shadowColor: BRAND_PURPLE,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },
    fundContinueDisabled: {
      backgroundColor: colors.disabled,
      shadowOpacity: 0,
      elevation: 0,
    },
    fundContinueText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },

    // ── Title bar ──────────────────────────────────────────────
    titleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleBarText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    titleBarSpacer: { width: 36 },

    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 48,
    },

    // ── Illustration ───────────────────────────────────────────
    illustrationWrap: {
      alignItems: 'center',
      marginBottom: 32,
    },
    illustrationEmoji: {
      fontSize: 64,
      marginBottom: 12,
    },
    illustrationSub: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },

    // ── Fields ─────────────────────────────────────────────────
    field:      { marginBottom: 24 },
    fieldLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    optional: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textMuted,
    },
    inputHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 6,
    },

    // ── Category pills ─────────────────────────────────────────
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    categoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      width: '47%',
    },
    categoryPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    categoryEmoji: { fontSize: 18 },
    categoryLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    categoryLabelActive: {
      color: colors.primary,
    },

    // ── Text inputs ────────────────────────────────────────────
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 15,
      fontSize: 16,
      color: colors.textPrimary,
    },
    currencyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      gap: 6,
    },
    currencySymbol: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textMuted,
    },
    currencyInput: {
      flex: 1,
      fontSize: 16,
      color: colors.textPrimary,
      paddingVertical: 15,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 15,
    },
    dateInput: {
      flex: 1,
      fontSize: 16,
      color: colors.textPrimary,
    },
    dateModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    dateModalSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 32,
    },
    dateModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dateModalAction: {
      fontSize: 16,
    },

    // ── Trust card ─────────────────────────────────────────────
    trustCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: '#D1FAE5',
      borderRadius: 14,
      padding: 14,
      gap: 12,
      marginBottom: 28,
    },
    trustIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#059669',
      alignItems: 'center',
      justifyContent: 'center',
    },
    trustBody:  { flex: 1 },
    trustTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#065F46',
      marginBottom: 4,
    },
    trustSub: {
      fontSize: 12,
      color: '#059669',
      lineHeight: 18,
    },

    // ── Button ─────────────────────────────────────────────────
    primaryButton: {
      backgroundColor: colors.disabled,
      borderRadius: 28,
      paddingVertical: 17,
      alignItems: 'center',
    },
    buttonActive: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    primaryButtonText: {
      color: colors.disabledText,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    primaryButtonTextActive: {
      color: '#FFFFFF',
    },
  })
}
