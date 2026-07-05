import { useState } from 'react'
import { Alert } from 'react-native'
import * as Contacts from 'expo-contacts'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { useHardwareBack } from '../../lib/useHardwareBack'
import { hapticSuccess, hapticError } from '../../lib/haptics'
import { supabase } from '../../lib/supabase'
import {
  CUSTOM_EVENT_EMOJIS,
  CreateOption,
  CreatedEvent,
  EMOJI_OPTIONS,
  EVENT_TYPES,
  FUND_CURRENCIES,
  FundCurrency,
  PickedOrganiser,
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

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'CreateFund'>
  route:      RouteProp<MainStackParamList, 'CreateFund'>
}

export default function CreateFundScreen({ navigation }: Props) {
  const { userId } = useAuth()
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
  const [eventBudget, setEventBudget] = useState('50,000')
  const [fundGoalPercent] = useState(65)
  const [eventName,      setEventName]      = useState('')
  const [eventDate,      setEventDate]      = useState<Date | null>(null)
  const [eventTime,      setEventTime]      = useState<Date | null>(null)
  const [eventVenue,     setEventVenue]     = useState('')
  const [isCreatingFund, setIsCreatingFund] = useState(false)
  const [isPrivate,      setIsPrivate]      = useState(false)

  const isValid = name.trim().length >= 3
  const eventDetailsValid = eventName.trim().length >= 3 && eventDate !== null && eventTime !== null && eventVenue.trim().length >= 3
  const isOtherEvent = eventType.id === 'other'
  const selectedEventLabel = isOtherEvent ? customEventType.trim() || 'Other' : eventType.label
  const selectedEventEmoji = isOtherEvent ? customEventEmoji : eventType.emoji
  const eventTypeStepValid = !isOtherEvent || customEventType.trim().length >= 2
  const selectedCurrency = FUND_CURRENCIES.find(item => item.id === currency) ?? FUND_CURRENCIES[0]

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
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          creator_id: userId,
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
        hapticError()
        Alert.alert('Could not create event', eventError?.message ?? 'Please try again.')
        return
      }

      const organiserRows = pickedOrganisers
        .filter(person => person.name.trim().length > 0 || person.phone?.trim())
        .map(person => ({
          event_id: event.id,
          invited_name: person.name.trim() || null,
          invited_phone: person.phone?.trim() || null,
          invited_by: userId,
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
      const goalAmount = goalBWP ? parseAmount(goalBWP) : null

      const isEventFund = createOption === 'eventFund' && createdEvent != null

      const { data: fund, error: fundError } = await supabase
        .from('funds')
        .insert({
          owner_id:              userId,
          title:                 name.trim(),
          fund_type:             isEventFund ? 'eventFund' : 'fund',
          fund_emoji:            selectedEmoji.emoji,
          goal_amount:           goalAmount,
          contribution_deadline: targetDate ? formatDateISO(targetDate) : null,
          currency_code:         currency,
          status:                'active',
          is_private:            isPrivate,
          ...(isEventFund ? { linked_event_id: createdEvent!.id } : {}),
        })
        .select('id, fund_code')
        .single()

      if (fundError || !fund) {
        hapticError()
        Alert.alert('Could not create fund', fundError?.message ?? 'Please try again.')
        return
      }

      const { error: memberError } = await supabase.from('fund_members').insert({
        fund_id:    fund.id,
        user_id:    userId,
        invited_by: userId,
        role:       'owner',
        status:     'joined',
        joined_at:  new Date().toISOString(),
      })

      if (memberError) {
        hapticError()
        Alert.alert('Could not create fund', memberError.message)
        return
      }

      if (isEventFund) {
        await Promise.all([
          supabase
            .from('events')
            .update({ linked_fund_id: fund.id })
            .eq('id', createdEvent!.id),
          supabase
            .from('event_fund_links')
            .insert({
              event_id:   createdEvent!.id,
              fund_id:    fund.id,
              linked_by:  userId,
              link_type:  'eventFund',
              is_active:  true,
            }),
        ])
      }

      hapticSuccess()
      navigation.replace('FundCreated', {
        fundName:   name.trim(),
        category:   selectedEmoji.label,
        emoji:      selectedEmoji.emoji,
        goalBWP:    goalBWP || undefined,
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
    return <CreateOptionChooser onSelect={setCreateOption} onBack={handleBack} />
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
        eventName={eventName}
        onCreate={fundGoalAmount => {
          hapticSuccess()
      navigation.replace('FundCreated', {
            fundName:   name.trim() || `${eventName.trim()} Fund`,
            category:   selectedEventLabel,
            emoji:      selectedEventEmoji,
            goalBWP:    `${fundGoalAmount}`,
            targetDate: eventDate ? formatDateISO(eventDate) : undefined,
          })
        }}
        onBack={handleBack}
      />
    )
  }

  if (createOption === 'eventFund') {
    return (
      <EventFundTypeStep
        eventType={eventType}
        onSelectType={setEventType}
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
          onShare={() => navigation.popToTop()}
          onDone={() => navigation.popToTop()}
        />
      )
    }

    if (eventStep === 3) {
      return (
        <EventOrganisersStep
          organiserSearch={organiserSearch}
          onOrganiserSearchChange={setOrganiserSearch}
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
