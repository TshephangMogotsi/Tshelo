import type {
  ApiResponse,
  CurrencyCode,
  EmptyResponse,
  ExtensibleString,
  IsoDate,
  IsoDateTime,
  IsoTime,
  JsonObject,
  JsonValue,
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
  status?: FundStatus
}

export type JoinFundRequest = {
  code: string
}

export type LeaveFundRequest = {
  fund_id: Uuid
}

export const FUND_PERMISSION_KEYS = [
  'record_contributions', 'edit_contributions', 'record_expenses', 'edit_expenses',
  'manage_members', 'manage_sponsorships', 'award_recognition', 'export_reports',
  'manage_event_guests', 'post_event_announcements', 'manage_event_budget',
] as const
export type FundPermission = (typeof FUND_PERMISSION_KEYS)[number]

export type FundInvitePreview = {
  fund_id: Uuid
  title: string
  organiser_name: string
  goal_amount: MoneyAmount
  currency_code: CurrencyCode
  status: FundStatus
  member_count: number
  is_private: boolean
  existing_membership_status: FundMemberStatus | null
}

export type JoinFundResult = {
  fund_id: Uuid
  membership_status: FundMemberStatus
  is_private: boolean
}

export type LeaveFundResult = {
  fund_id: Uuid
  membership_status: FundMemberStatus
}

export type FundMemberDirectoryItem = {
  id: Uuid
  user_id: Uuid | null
  display_name: string
  phone: PhoneNumber | null
  role: FundMemberRole
  status: FundMemberStatus
  joined_at: IsoDateTime | null
  requested_at: IsoDateTime | null
  is_rich_auntie: boolean
}

export type FundMemberAward = {
  id: Uuid
  reason_label: string
  created_at: IsoDateTime
}

export type FundMemberDetails = {
  member: FundMemberDirectoryItem
  confirmed_total: MoneyAmount
  pledged_total: MoneyAmount
  awards: FundMemberAward[]
  sponsored_items: Array<{ title: string; status: string }>
}

export type UpdateFundMemberRequest = {
  status: Extract<FundMemberStatus, 'joined' | 'declined' | 'removed'>
}

export type FundAdminPermissionRow = {
  member_id: Uuid
  admin_user_id: Uuid
  permission_key: FundPermission
}

export type ConfigureFundAdminRequest = {
  permissions: FundPermission[]
}

export type FundSponsorshipStatus = 'open' | 'claimed' | 'funded' | 'fulfilled' | 'cancelled'

export type FundSponsorshipItem = {
  id: Uuid
  fund_id: Uuid
  title: string
  description: string | null
  category: string | null
  target_amount: MoneyAmount
  allocated_amount: MoneyAmount
  outstanding_amount: MoneyAmount
  status: FundSponsorshipStatus
  claimed_by_user_id: Uuid | null
  sponsor_name: string | null
  claimed_at: IsoDateTime | null
  funded_at: IsoDateTime | null
  fulfilled_at: IsoDateTime | null
  linked_expense_id: Uuid | null
  created_at: IsoDateTime
}

export type CreateFundSponsorshipRequest = {
  title: string
  description?: string | null
  category?: string | null
  target_amount: MoneyAmount
}

export type UpdateFundSponsorshipRequest = Partial<CreateFundSponsorshipRequest> & {
  status?: FundSponsorshipStatus
}

export type FundWorkspaceContribution = {
  id: Uuid
  contributor_id: Uuid
  contributor_name: string
  contributor_type: 'member' | 'guest'
  amount: MoneyAmount
  pledged_amount: MoneyAmount | null
  allocated_amount: MoneyAmount
  outstanding_amount: MoneyAmount | null
  pledge_state: 'pledged' | 'partially_paid' | 'fulfilled' | null
  payment_method: string | null
  reference_number: string | null
  detected_via: string
  status: string
  is_refunded: boolean
  confirmed_at: IsoDateTime | null
  created_at: IsoDateTime
  notes: string | null
}

export type FundWorkspaceExpense = {
  id: Uuid
  vendor_name: string | null
  description: string
  category: string | null
  amount: MoneyAmount
  created_at: IsoDateTime
  notes: string | null
  has_open_query: boolean
  is_sponsored: boolean
  sponsored_by_user_id: Uuid | null
  sponsored_by_name: string | null
}

export type FundWorkspace = {
  fund: FundDetail
  contributions: FundWorkspaceContribution[]
  expenses: FundWorkspaceExpense[]
  members: FundMemberDirectoryItem[]
  sponsorship_items: FundSponsorshipItem[]
  permissions: FundPermission[]
}

export type FundActivityEntry = {
  id: Uuid
  entity_id: Uuid
  user_id: Uuid | null
  action: string
  entity_type: string
  old_values: Record<string, JsonValue> | null
  new_values: Record<string, JsonValue> | null
  created_at: IsoDateTime
}

export type ListFundActivityRequest = {
  cursor?: string
  limit?: number
  entity_type?: string
  edits_only?: boolean
}

export type FundActivityDetail = {
  entry: FundActivityEntry
  current_record: Record<string, JsonValue> | null
}

export type HomeSummaryItem = {
  id: string
  fund_id?: Uuid
  event_id?: Uuid
  kind: 'fund' | 'event' | 'eventFund'
  title: string
  status: string
  goal_amount: MoneyAmount
  budget_amount: MoneyAmount | null
  budget_currency_code: CurrencyCode
  total_contributions: MoneyAmount
  balance: MoneyAmount
  member_count: number
  guest_count: number
  role: FundMemberRole | 'organiser'
  event_date: IsoDate | null
  venue_name: string | null
  category: string
  emoji: string
  currency_code: CurrencyCode
  created_at: IsoDateTime
}

export type HomeSummary = {
  items: HomeSummaryItem[]
  unread_notification_count: number
}

export type ListFundsResponse = PaginatedResponse<FundSummary>
export type GetFundResponse = ApiResponse<FundDetail>
export type CreateFundResponse = ApiResponse<Fund>
export type UpdateFundResponse = ApiResponse<Fund>
export type JoinFundResponse = ApiResponse<JoinFundResult>
export type LeaveFundResponse = ApiResponse<LeaveFundResult>
