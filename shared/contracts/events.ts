import type {
  ApiResponse,
  CurrencyCode,
  EmptyResponse,
  ExtensibleString,
  IsoDate,
  IsoDateTime,
  IsoTime,
  ListRequest,
  MoneyAmount,
  OneOrMany,
  PaginatedResponse,
  PhoneNumber,
  SearchFilter,
  Uuid,
} from './common'
import type { FundPermission, FundWorkspace } from './funds'

export type KnownEventType = 'wedding' | 'funeral' | 'graduation' | 'birthday' | 'baby_shower' | 'kitchen_party' | 'tombstone' | 'other'
export type EventType = ExtensibleString<KnownEventType>

export const EVENT_STATUSES = ['active', 'completed', 'cancelled'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

export const RSVP_STATUSES = ['pending', 'yes', 'no', 'maybe'] as const
export type RsvpStatus = (typeof RSVP_STATUSES)[number]

export type EventSummary = {
  id: Uuid
  creator_id: Uuid
  event_code: string
  name: string
  event_type: EventType
  event_emoji: string | null
  event_date: IsoDate
  event_time: IsoTime | null
  venue_name: string | null
  currency_code: CurrencyCode
  linked_fund_id: Uuid | null
  status: EventStatus
  created_at: IsoDateTime
}

export type Event = EventSummary & {
  description: string | null
  event_end_date: IsoDate | null
  event_end_time: IsoTime | null
  venue_address: string | null
  venue_lat: number | null
  venue_lng: number | null
  cover_photo_url: string | null
  share_code: string | null
  estimated_spend_amount: MoneyAmount | null
  completed_at: IsoDateTime | null
  cancelled_at: IsoDateTime | null
  updated_at: IsoDateTime
}

export type EventGuest = {
  id: Uuid
  event_id: Uuid
  user_id: Uuid | null
  guest_name: string | null
  guest_phone: PhoneNumber | null
  guest_email: string | null
  rsvp_status: RsvpStatus
  plus_ones: number
  rsvp_note: string | null
  created_at: IsoDateTime
}

export type EventFilters = SearchFilter & {
  creator_id?: Uuid
  participant_user_id?: Uuid
  type?: OneOrMany<EventType>
  status?: OneOrMany<EventStatus>
}

export type EventSortField = 'created_at' | 'event_date' | 'name'
export type ListEventsRequest = ListRequest<EventFilters, EventSortField>

export type GetEventRequest = {
  event_id: Uuid
}

export type EventOrganiserInput = {
  name: string
  phone: PhoneNumber
}

export type CreateEventRequest = {
  name: string
  description?: string | null
  event_type: EventType
  event_emoji?: string | null
  event_date: IsoDate
  event_time?: IsoTime | null
  event_end_date?: IsoDate | null
  event_end_time?: IsoTime | null
  venue_name?: string | null
  venue_address?: string | null
  currency_code: CurrencyCode
  organisers?: EventOrganiserInput[]
}

export type UpdateEventRequest = Partial<Omit<CreateEventRequest, 'event_type' | 'currency_code' | 'organisers'>> & {
  status?: EventStatus
}

export type JoinEventRequest = {
  code: string
}

export type LeaveEventRequest = {
  event_id: Uuid
}

export type EventBudget = {
  event_id: Uuid
  total_budget: MoneyAmount
  currency_code: CurrencyCode
}

export type EventAnnouncement = {
  id: Uuid
  event_id: Uuid
  author_id: Uuid
  author_name: string
  title: string
  body: string
  created_at: IsoDateTime
}

export type EventCapabilities = {
  is_creator: boolean
  is_organiser: boolean
  can_leave_event: boolean
  linked_fund_permissions: FundPermission[]
}

export type EventWorkspace = {
  event: Event
  guests: EventGuest[]
  budget: EventBudget | null
  announcements: EventAnnouncement[]
  capabilities: EventCapabilities
  linked_fund: FundWorkspace | null
}

export type EventInvitePreview = {
  id: Uuid
  name: string
  event_type: EventType
  event_emoji: string | null
  event_date: IsoDate
  event_time: IsoTime | null
  venue_name: string | null
  status: EventStatus
  organiser_name: string
  has_linked_fund: boolean
  already_joined: boolean
}

export type JoinedEvent = {
  event_id: Uuid
  guest_id: Uuid | null
  event_name: string
  already_joined: boolean
}

export type LeftEvent = {
  event_id: Uuid
  left_as_guest: boolean
  left_as_organiser: boolean
}

export type CreateEventFundRequest = {
  event_name: string
  event_type: EventType
  event_emoji?: string | null
  event_date: IsoDate
  event_time: IsoTime
  event_venue: string
  venue_address?: string | null
  fund_title: string
  currency_code: CurrencyCode
  budget: MoneyAmount
  goal_percentage: number
  is_private?: boolean
  organisers?: EventOrganiserInput[]
}

export type CreatedEventFund = {
  event_id: Uuid
  fund_id: Uuid
  fund_code: string | null
  event_share_code: string | null
  remaining_tokens: number
  venue_address_saved: boolean
}

export type UpdateEventBudgetRequest = {
  total_budget: MoneyAmount
  currency_code: CurrencyCode
}

export type CreateEventAnnouncementRequest = {
  title: string
  body: string
}

export type InviteEventOrganiserRequest = EventOrganiserInput

export type CompleteEventRequest = {
  estimated_spend_amount: MoneyAmount | null
}

export type RespondOrganiserInviteRequest = {
  invite_id: Uuid
  accepted: boolean
}

export type RespondOrganiserInviteResult = {
  event_id: Uuid
  fund_id: Uuid
  accepted: boolean
}

export type SyncOrganiserInvitesResult = {
  synced_count: number
}

export type ListEventsResponse = PaginatedResponse<EventSummary>
export type GetEventResponse = ApiResponse<{ event: Event; guests: EventGuest[] }>
export type CreateEventResponse = ApiResponse<Event>
export type UpdateEventResponse = ApiResponse<Event>
export type JoinEventResponse = ApiResponse<{ event: EventSummary; guest: EventGuest }>
export type LeaveEventResponse = EmptyResponse
export type RespondOrganiserInviteResponse = ApiResponse<RespondOrganiserInviteResult>
export type SyncOrganiserInvitesResponse = ApiResponse<SyncOrganiserInvitesResult>
export type GetEventWorkspaceResponse = ApiResponse<EventWorkspace>
export type GetEventInvitePreviewResponse = ApiResponse<EventInvitePreview>
export type JoinEventByCodeResponse = ApiResponse<JoinedEvent>
export type LeaveEventResultResponse = ApiResponse<LeftEvent>
export type CreateEventFundResponse = ApiResponse<CreatedEventFund>
export type UpdateEventBudgetResponse = ApiResponse<EventBudget>
export type CreateEventAnnouncementResponse = ApiResponse<EventAnnouncement>
