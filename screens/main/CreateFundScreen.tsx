import { useCallback, useEffect, useState } from 'react'
import { Alert, Share } from 'react-native'
import * as Contacts from 'expo-contacts'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import type { ConnectionSummary } from '@shared/contracts/users'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { useHardwareBack } from '../../lib/useHardwareBack'
import { hapticSuccess, hapticError } from '../../lib/haptics'
import { api } from '../../lib/api'
import { runApiRead, toApiUiError } from '../../lib/apiScreen'
import { normalizeMapsUrl } from '../../lib/maps'
import { TOKEN_FEATURE_PRICES } from '../../lib/tokenPricing'
import { HomeItem } from './home/helpers'
import { loadHomeItems } from './home/loadHomeItems'
import {
  CUSTOM_EVENT_EMOJIS,
  CreateOption,
  CreatedEvent,
  EMOJI_OPTIONS,
  EVENT_TYPES,
  FUND_CURRENCIES,
  FundCurrency,
  PickedOrganiser,
  QuickActionId,
} from './createFund/constants'
import { formatDateISO, formatTimeISO, getInitials, parseAmount, sanitizeAmountInput } from './createFund/format'
import CreateOptionChooser from './createFund/CreateOptionChooser'
import CurrencyStep from './createFund/CurrencyStep'
import FundFormStep from './createFund/FundFormStep'
import EventTypeStep from './createFund/EventTypeStep'
import EventDetailsStep from './createFund/EventDetailsStep'
import EventOrganisersStep from './createFund/EventOrganisersStep'
import EventCreatedScreen from './createFund/EventCreatedScreen'
import EventFundTypeStep from './createFund/EventFundTypeStep'
import EventFundDetailsStep from './createFund/EventFundDetailsStep'
import EventFundOrganisersStep from './createFund/EventFundOrganisersStep'
import EventFundBudgetStep from './createFund/EventFundBudgetStep'
import { useFundPermissions } from '../../lib/useFundPermissions'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'CreateFund'>
  route:      RouteProp<MainStackParamList, 'CreateFund'>
}

export default function CreateFundScreen({ navigation }: Props) {
  const { userId, tokenBalance, refreshProfile } = useAuth()
  const requireOnline = useRequireOnline()

  const [name,           setName]           = useState('')
  const [goalBWP,        setGoalBWP]        = useState('')
  const [targetDate,     setTargetDate]     = useState<Date | null>(null)
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
  const [connectionResults, setConnectionResults] = useState<PickedOrganiser[]>([])
  const [isSearchingConnections, setIsSearchingConnections] = useState(false)
  const [eventBudget, setEventBudget] = useState('50,000')
  const [fundGoalPercent, setFundGoalPercent] = useState(65)
  const [eventName,      setEventName]      = useState('')
  const [eventDate,      setEventDate]      = useState<Date | null>(null)
  const [eventTime,      setEventTime]      = useState<Date | null>(null)
  const [eventVenue,     setEventVenue]     = useState('')
  const [eventVenueMapLink, setEventVenueMapLink] = useState('')
  const [isCreatingFund, setIsCreatingFund] = useState(false)
  const [isPrivate,      setIsPrivate]      = useState(false)
  const [firstFundItem,  setFirstFundItem]  = useState<HomeItem | null>(null)
  const { can: canUseFundAction } = useFundPermissions(firstFundItem?.fundId)

  useFocusEffect(
    useCallback(() => {
      let active = true
      if (userId) {
        loadHomeItems(userId)
          .then(items => {
            if (!active) return
            setFirstFundItem(items.find(i => i.kind !== 'event' && i.status.toLowerCase() === 'active') ?? null)
          })
          .catch(() => { if (active) setFirstFundItem(null) })
      }
      return () => { active = false }
    }, [userId])
  )

  useEffect(() => {
    let active = true
    const query = organiserSearch.trim()
    if (query.length < 2) {
      setConnectionResults([])
      setIsSearchingConnections(false)
      return () => { active = false }
    }

    setIsSearchingConnections(true)
    const timeout = setTimeout(async () => {
      let data: ConnectionSummary[]
      try {
        data = await runApiRead(call => api.users.searchConnections({ q: query }, call))
      } catch {
        data = []
      }
      if (!active) return
      setConnectionResults(data.map(person => ({
          id: `connection:${person.user_id}`,
          userId: person.user_id,
          name: person.name,
          phone: person.phone,
          initials: getInitials(person.name),
        })).filter((person: PickedOrganiser) => !pickedOrganisers.some(picked =>
          picked.userId === person.userId || normalizePhone(picked.phone) === normalizePhone(person.phone)
        )))
      setIsSearchingConnections(false)
    }, 300)

    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [organiserSearch, pickedOrganisers])

  function normalizePhone(value?: string) {
    return (value ?? '').replace(/\D/g, '').slice(-8)
  }

  function toE164Phone(value?: string) {
    const digits = (value ?? '').replace(/\D/g, '')
    if (digits.startsWith('267') && digits.length === 11) return `+${digits}`
    if (digits.length === 8) return `+267${digits}`
    return digits.length >= 7 ? `+${digits}` : ''
  }

  function organiserInputs() {
    return pickedOrganisers
      .map(person => ({ name: person.name.trim(), phone: toE164Phone(person.phone) }))
      .filter(person => person.name.length > 0 && person.phone.length > 0)
  }

  function handleQuickAction(id: QuickActionId) {
    if (id === 'joinFund') {
      navigation.navigate('JoinFund')
      return
    }
    if (id === 'joinEvent') {
      navigation.navigate('JoinEvent')
      return
    }
    if (id === 'tokens') {
      navigation.navigate('TokenPurchase')
      return
    }

    const fund = firstFundItem
    if (!fund?.fundId) {
      Alert.alert('No active fund yet', 'Create a fund below, or join one with an invite code, to get started.')
      return
    }
    const fundId = fund.fundId

    switch (id) {
      case 'contribution':
        navigation.navigate('RecordContribution', {
          fundId,
          fundTitle:    fund.title,
          currencyCode: fund.currency_code,
          initialMode: canUseFundAction('record_contributions') ? 'received' : 'pledge',
        })
        break
      case 'expense':
        if (!canUseFundAction('record_expenses')) return
        navigation.navigate('RecordExpense', {
          fundId,
          fundTitle:    fund.title,
          currencyCode: fund.currency_code,
        })
        break
      case 'members':
        if (!canUseFundAction('manage_members')) return
        navigation.navigate('FundDetail', { fundId })
        break
    }
  }

  const isValid = name.trim().length >= 3
  const eventVenueMapLinkValid = !eventVenueMapLink.trim() || normalizeMapsUrl(eventVenueMapLink) !== null
  const eventDetailsValid = eventName.trim().length >= 3
    && eventDate !== null
    && eventTime !== null
    && eventVenue.trim().length >= 3
    && eventVenueMapLinkValid
  const isOtherEvent = eventType.id === 'other'
  const selectedEventLabel = isOtherEvent ? customEventType.trim() || 'Other' : eventType.label
  const selectedEventEmoji = isOtherEvent ? customEventEmoji : eventType.emoji
  const eventTypeStepValid = !isOtherEvent || customEventType.trim().length >= 2
  const selectedCurrency = FUND_CURRENCIES.find(item => item.id === currency) ?? {
    id: currency,
    code: currency,
    name: 'Custom currency',
    symbol: currency,
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

      if (!phone || normalizePhone(phone).length < 7) {
        Alert.alert('Phone number required', 'Choose a contact with a valid phone number so they can receive the organiser invitation.')
        return
      }

      setPickedOrganisers(previous => {
        if (previous.some(item => item.id === contact.id || normalizePhone(item.phone) === normalizePhone(phone))) return previous

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

  function addConnectedOrganiser(person: PickedOrganiser) {
    setPickedOrganisers(previous => {
      if (previous.some(item => item.userId === person.userId || normalizePhone(item.phone) === normalizePhone(person.phone))) return previous
      return [...previous, person]
    })
    setOrganiserSearch('')
  }

  type CreatedFund  = { id: string; fund_code: string | null }

  // Inserts the event + pending organiser invites. Alerts and returns
  // null on failure; a missing organiser row is non-fatal.
  async function insertEventWithOrganisers(): Promise<CreatedEvent | null> {
    if (!eventDate || !eventTime) return null

    try {
      const event = await api.events.create({
        name: eventName.trim(),
        event_type: isOtherEvent ? customEventType.trim() : eventType.id,
        event_emoji: selectedEventEmoji,
        event_date: formatDateISO(eventDate),
        event_time: formatTimeISO(eventTime),
        venue_name: eventVenue.trim(),
        venue_address: normalizeMapsUrl(eventVenueMapLink) ?? normalizeMapsUrl(eventVenue),
        currency_code: currency,
        organisers: organiserInputs(),
      })
      return { id: event.id, share_code: event.share_code }
    } catch (error) {
      hapticError()
      Alert.alert('Could not create event', toApiUiError(error).message)
      return null
    }
  }

  // Inserts the fund and links the event when given. The database creates the
  // owner's joined membership in the same transaction as the fund.
  // Alerts and returns null on failure.
  async function insertFund(opts: {
    title: string
    goalAmount: number | null
    deadline: string | null
    linkedEvent: CreatedEvent | null
  }): Promise<CreatedFund | null> {
    try {
      const fund = await api.funds.create({
        title:                 opts.title,
        fund_type:             opts.linkedEvent ? 'eventFund' : 'fund',
        fund_emoji:            selectedEmoji.emoji,
        goal_amount:           opts.goalAmount === null ? null : String(opts.goalAmount),
        contribution_deadline: opts.deadline,
        currency_code:         currency,
        is_private:            isPrivate,
        linked_event_id:       opts.linkedEvent?.id ?? null,
      })
      return { id: fund.id, fund_code: fund.fund_code }
    } catch (error) {
      hapticError()
      Alert.alert('Could not create fund', toApiUiError(error).message)
      return null
    }
  }

  async function handleCreateEvent() {
    if (!eventDetailsValid || isCreatingEvent) return
    if (!requireOnline()) return
    if (!eventDate || !eventTime) return
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in again before creating an event.')
      return
    }

    setIsCreatingEvent(true)
    try {
      const event = await insertEventWithOrganisers()
      if (!event) return

      hapticSuccess()
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

  async function handleCreateFund() {
    if (!isValid || isCreatingFund) return
    if (!requireOnline()) return
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in again before creating a fund.')
      return
    }

    setIsCreatingFund(true)
    try {
      const fund = await insertFund({
        title:       name.trim(),
        goalAmount:  goalBWP ? parseAmount(goalBWP) : null,
        deadline:    targetDate ? formatDateISO(targetDate) : null,
        linkedEvent: createOption === 'eventFund' && createdEvent ? createdEvent : null,
      })
      if (!fund) return

      hapticSuccess()
      navigation.replace('FundCreated', {
        fundName:   name.trim(),
        category:   selectedEmoji.label,
        emoji:      selectedEmoji.emoji,
        goalBWP:    goalBWP || undefined,
        currencyCode: selectedCurrency.code,
        currencySymbol: selectedCurrency.symbol,
        targetDate: targetDate ? formatDateISO(targetDate) : undefined,
        shareCode:  fund.fund_code ?? undefined,
        fundId:     fund.id,
      })
    } catch (error) {
      Alert.alert('Could not create fund', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setIsCreatingFund(false)
    }
  }

  // Final step of the Event + Fund wizard: create the event, the fund,
  // the link between them, and persist the budget the goal was derived
  // from. createdEvent survives a failed fund insert so retrying doesn't
  // duplicate the event.
  async function handleCreateEventFund(fundGoalAmount: number) {
    if (!eventDetailsValid || isCreatingFund) return
    if (!requireOnline()) return
    if (!eventDate || !eventTime) return
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in again before creating an event fund.')
      return
    }
    if (tokenBalance < TOKEN_FEATURE_PRICES.eventFund) {
      Alert.alert(
        'Not enough tokens',
        `Event + Fund costs ${TOKEN_FEATURE_PRICES.eventFund} tokens. Your current balance is ${tokenBalance}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Tokens', onPress: () => navigation.navigate('TokenPurchase') },
        ]
      )
      return
    }

    setIsCreatingFund(true)
    try {
      const budgetAmount = parseAmount(eventBudget)
      const fundTitle = name.trim() || `${eventName.trim()} Fund`
      let created
      try {
        created = await api.events.createFund({
          event_name: eventName.trim(),
          event_type: isOtherEvent ? customEventType.trim() : eventType.id,
          event_emoji: selectedEventEmoji,
          event_date: formatDateISO(eventDate),
          event_time: formatTimeISO(eventTime),
          event_venue: eventVenue.trim(),
          venue_address: normalizeMapsUrl(eventVenueMapLink) ?? normalizeMapsUrl(eventVenue),
          fund_title: fundTitle,
          currency_code: currency,
          budget: String(budgetAmount),
          goal_percentage: fundGoalPercent,
          is_private: isPrivate,
          organisers: organiserInputs(),
        })
      } catch (error) {
        const uiError = toApiUiError(error)
        if (uiError.kind === 'validation' && uiError.message.toLowerCase().includes('tokens')) {
          await refreshProfile()
          Alert.alert(
            'Not enough tokens',
            uiError.message,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Go to Tokens', onPress: () => navigation.navigate('TokenPurchase') },
            ]
          )
          return
        }
        throw error
      }
      if (!created.venue_address_saved) {
        Alert.alert('Event + Fund created', 'Your event was created, but its Maps link could not be saved. You can still find the venue by name.')
      }
      await refreshProfile()
      hapticSuccess()
      navigation.replace('FundCreated', {
        fundName:   fundTitle,
        category:   selectedEventLabel,
        emoji:      selectedEventEmoji,
        goalBWP:    `${fundGoalAmount}`,
        currencyCode: selectedCurrency.code,
        currencySymbol: selectedCurrency.symbol,
        targetDate: formatDateISO(eventDate),
        shareCode:  created.fund_code ?? undefined,
        fundId:     created.fund_id,
      })
    } catch (error) {
      Alert.alert('Could not create event fund', toApiUiError(error).message)
    } finally {
      setIsCreatingFund(false)
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

  useHardwareBack(() => {
    // Once the event exists, back means "done", same as the success
    // screen's own buttons — never back into the completed wizard
    if (eventCreated) {
      navigation.popToTop()
      return true
    }
    handleBack()
    return true
  })

  if (!createOption) {
    return (
      <CreateOptionChooser
        onSelect={setCreateOption}
        onQuickAction={handleQuickAction}
        onBack={handleBack}
        visibleQuickActions={new Set<QuickActionId>([
          'joinFund',
          'joinEvent',
          'contribution',
          ...(canUseFundAction('record_expenses') ? ['expense' as const] : []),
          ...(canUseFundAction('manage_members') ? ['members' as const] : []),
        ])}
      />
    )
  }

  if (createOption === 'eventFund' && eventFundTypeDone && !eventFundDetailsDone) {
    return (
      <EventFundDetailsStep
        selectedEventLabel={selectedEventLabel}
        selectedEventEmoji={selectedEventEmoji}
        eventName={eventName}
        onEventNameChange={setEventName}
        fundName={name}
        onFundNameChange={setName}
        eventDate={eventDate}
        onEventDateChange={setEventDate}
        eventTime={eventTime}
        onEventTimeChange={setEventTime}
        eventVenue={eventVenue}
        onEventVenueChange={setEventVenue}
        eventVenueMapLink={eventVenueMapLink}
        onEventVenueMapLinkChange={setEventVenueMapLink}
        onContinue={derivedFundName => {
          if (!name.trim()) setName(derivedFundName)
          setEventFundDetailsDone(true)
        }}
        onBack={handleBack}
      />
    )
  }

  if (createOption === 'eventFund' && eventFundDetailsDone && !eventFundOrganisersDone) {
    return (
      <EventFundOrganisersStep
        organiserSearch={organiserSearch}
        onOrganiserSearchChange={setOrganiserSearch}
        connectionResults={connectionResults}
        isSearchingConnections={isSearchingConnections}
        onAddConnection={addConnectedOrganiser}
        pickedOrganisers={pickedOrganisers}
        onAddFromContacts={handleAddFromContacts}
        onRemoveOrganiser={removePickedOrganiser}
        onContinue={() => setEventFundOrganisersDone(true)}
        onBack={handleBack}
      />
    )
  }

  if (createOption === 'eventFund' && eventFundOrganisersDone) {
    return (
      <EventFundBudgetStep
        eventBudget={eventBudget}
        onEventBudgetChange={text => setEventBudget(sanitizeAmountInput(text))}
        fundGoalPercent={fundGoalPercent}
        onFundGoalPercentChange={setFundGoalPercent}
        eventName={eventName}
        currencySymbol={selectedCurrency.symbol}
        isCreating={isCreatingFund}
        onCreate={handleCreateEventFund}
        onBack={handleBack}
      />
    )
  }

  if (createOption === 'eventFund') {
    return (
      <EventFundTypeStep
        eventType={eventType}
        onSelectType={setEventType}
        isOtherEvent={isOtherEvent}
        customEventType={customEventType}
        onCustomEventTypeChange={setCustomEventType}
        customEventEmoji={customEventEmoji}
        onCustomEventEmojiChange={setCustomEventEmoji}
        showEmojiDialog={showCustomEmojiDialog}
        onShowEmojiDialog={setShowCustomEmojiDialog}
        emojiSearch={emojiSearch}
        onEmojiSearchChange={setEmojiSearch}
        emojiCategory={emojiCategory}
        onEmojiCategoryChange={setEmojiCategory}
        isStepValid={eventTypeStepValid}
        onContinue={() => {
          setSelectedEmoji({ id: eventType.id, label: selectedEventLabel, emoji: selectedEventEmoji })
          setEventFundTypeDone(true)
        }}
        onBack={handleBack}
      />
    )
  }

  if (createOption === 'event') {
    if (eventCreated) {
      return (
        <EventCreatedScreen
          eventName={eventName.trim() || `${selectedEventLabel} Event`}
          eventEmoji={selectedEventEmoji}
          eventDate={eventDate}
          eventVenue={eventVenue}
          onShare={async () => {
            if (!createdEvent?.share_code) {
              Alert.alert('Share link unavailable', 'Open the event from Home and try again.')
              return
            }
            await Share.share({
              message: `You're invited to ${eventName.trim() || `${selectedEventLabel} Event`}. RSVP with code ${createdEvent.share_code}.`,
            })
          }}
          onDone={() => navigation.popToTop()}
        />
      )
    }

    if (eventStep === 3) {
      return (
        <EventOrganisersStep
          organiserSearch={organiserSearch}
          onOrganiserSearchChange={setOrganiserSearch}
          connectionResults={connectionResults}
          isSearchingConnections={isSearchingConnections}
          onAddConnection={addConnectedOrganiser}
          pickedOrganisers={pickedOrganisers}
          onAddFromContacts={handleAddFromContacts}
          onRemoveOrganiser={removePickedOrganiser}
          isCreatingEvent={isCreatingEvent}
          onCreateEvent={handleCreateEvent}
          onBack={handleBack}
        />
      )
    }

    if (eventStep === 2) {
      return (
        <EventDetailsStep
          selectedEventLabel={selectedEventLabel}
          eventName={eventName}
          onEventNameChange={setEventName}
          eventDate={eventDate}
          onEventDateChange={setEventDate}
          eventTime={eventTime}
          onEventTimeChange={setEventTime}
          eventVenue={eventVenue}
          onEventVenueChange={setEventVenue}
          eventVenueMapLink={eventVenueMapLink}
          onEventVenueMapLinkChange={setEventVenueMapLink}
          isStepValid={eventDetailsValid}
          onContinue={() => setEventStep(3)}
          onBack={handleBack}
        />
      )
    }

    return (
      <EventTypeStep
        eventType={eventType}
        onSelectType={setEventType}
        isOtherEvent={isOtherEvent}
        customEventType={customEventType}
        onCustomEventTypeChange={setCustomEventType}
        customEventEmoji={customEventEmoji}
        onCustomEventEmojiChange={setCustomEventEmoji}
        showEmojiDialog={showCustomEmojiDialog}
        onShowEmojiDialog={setShowCustomEmojiDialog}
        emojiSearch={emojiSearch}
        onEmojiSearchChange={setEmojiSearch}
        emojiCategory={emojiCategory}
        onEmojiCategoryChange={setEmojiCategory}
        isStepValid={eventTypeStepValid}
        onContinue={() => setEventStep(2)}
        onBack={handleBack}
      />
    )
  }

  if (!currencyDone) {
    return (
      <CurrencyStep
        currency={currency}
        onSelectCurrency={setCurrency}
        onContinue={() => setCurrencyDone(true)}
        onBack={handleBack}
      />
    )
  }

  return (
    <FundFormStep
      name={name}
      onNameChange={setName}
      selectedEmoji={selectedEmoji}
      onSelectEmoji={setSelectedEmoji}
      goalBWP={goalBWP}
      onGoalChange={text => setGoalBWP(sanitizeAmountInput(text))}
      targetDate={targetDate}
      onTargetDateChange={setTargetDate}
      isPrivate={isPrivate}
      onPrivateChange={setIsPrivate}
      currencyCode={selectedCurrency.code}
      currencySymbol={selectedCurrency.symbol}
      isValid={isValid}
      isCreatingFund={isCreatingFund}
      onSubmit={handleCreateFund}
      onBack={handleBack}
    />
  )
}
