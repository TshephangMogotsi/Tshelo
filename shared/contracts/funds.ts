import type {
  ApiResponse,
  CurrencyCode,
  EmptyResponse,
  ExtensibleString,
  IsoDate,
  IsoDateTime,
  IsoTime,
  JsonObject,
  ListRequest,
  MoneyAmount,
  OneOrMany,
  PaginatedResponse,
  PhoneNumber,
  SearchFilter,
  Uuid,
} from './common'

export type KnownFundType = 'funeral' | 'tombstone' | 'lobola' | 'graduation' | 'baby_shower' | 'kitchen_party' | 'stokvel' | 'other' | 'fund' | 'eventFund'
export type FundType = ExtensibleString<KnownFundType>

export const FUND_STATUSES = ['active', 'closed', 'completed', 'cancelled'] as const
export type FundStatus = (typeof FUND_STATUSES)[number]

export const FUND_MEMBER_ROLES = ['owner', 'admin', 'member'] as const
export type FundMemberRole = (typeof FUND_MEMBER_ROLES)[number]

export const FUND_MEMBER_STATUSES = ['pending', 'joined', 'declined', 'removed', 'left'] as const
export type FundMemberStatus = (typeof FUND_MEMBER_STATUSES)[number]

export type FundSummary = {
  id: Uuid
  owner_id: Uuid
  title: string
  fund_code: string
  fund_type: FundType
  fund_emoji: string | null
  currency_code: CurrencyCode
  goal_amount: MoneyAmount | null
  status: FundStatus
  contribution_deadline: IsoDate | null
  linked_event_id: Uuid | null
  is_private: boolean
  created_at: IsoDateTime
}

export type Fund = FundSummary & {
  description: string | null
  type_specific_data: JsonObject
  event_date: IsoDate | null
  event_time: IsoTime | null
  event_location: string | null
  attendees: number | null
  auto_close_date: IsoDate | null
  cover_photo_url: string | null
  share_code: string | null
  show_leaderboard: boolean
  closed_at: IsoDateTime | null
  updated_at: IsoDateTime
}

export type FundMembership = {
  id: Uuid
  fund_id: Uuid
  user_id: Uuid | null
  invited_phone: PhoneNumber | null
  invited_name: string | null
  role: FundMemberRole
  status: FundMemberStatus
  suggested_contribution: MoneyAmount | null
  contribution_goal: MoneyAmount | null
  joined_at: IsoDateTime | null
  created_at: IsoDateTime
}

export type FundTotals = {
  raised: MoneyAmount
  spent: MoneyAmount
  balance: MoneyAmount
  contribution_count: number
  member_count: number
}

export type FundDetail = Fund & {
  membership: FundMembership | null
  totals: FundTotals
}

export type FundFilters = SearchFilter & {
  owner_id?: Uuid
  member_user_id?: Uuid
  type?: OneOrMany<FundType>
  status?: OneOrMany<FundStatus>
  linked_event_id?: Uuid
}

export type FundSortField = 'created_at' | 'title' | 'goal_amount' | 'contribution_deadline'
export type ListFundsRequest = ListRequest<FundFilters, FundSortField>

export type GetFundRequest = {
  fund_id: Uuid
}

export type CreateFundRequest = {
  title: string
  description?: string | null
  fund_type: FundType
  fund_emoji?: string | null
  currency_code: CurrencyCode
  goal_amount?: MoneyAmount | null
  type_specific_data?: JsonObject
  event_date?: IsoDate | null
  event_time?: IsoTime | null
  event_location?: string | null
  contribution_deadline?: IsoDate | null
  linked_event_id?: Uuid | null
  is_private?: boolean
}

export type UpdateFundRequest = Partial<Omit<CreateFundRequest, 'fund_type' | 'currency_code'>> & {
  fund_id: Uuid
  status?: FundStatus
}

export type JoinFundRequest = {
  code: string
}

export type LeaveFundRequest = {
  fund_id: Uuid
}

export type ListFundsResponse = PaginatedResponse<FundSummary>
export type GetFundResponse = ApiResponse<FundDetail>
export type CreateFundResponse = ApiResponse<Fund>
export type UpdateFundResponse = ApiResponse<Fund>
export type JoinFundResponse = ApiResponse<{ fund: FundSummary; membership: FundMembership }>
export type LeaveFundResponse = EmptyResponse
