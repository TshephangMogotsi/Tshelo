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
  event_id: Uuid
  status?: EventStatus
}

export type JoinEventRequest = {
  code: string
}

export type LeaveEventRequest = {
  event_id: Uuid
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
