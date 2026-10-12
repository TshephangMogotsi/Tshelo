import type {
  ApiResponse,
  CurrencyCode,
  IsoDateTime,
  ListRequest,
  OneOrMany,
  PaginatedResponse,
  PhoneNumber,
  SearchFilter,
  Uuid,
} from './common'

export const TRUST_LEVELS = ['new', 'basic', 'trusted', 'verified'] as const
export type TrustLevel = (typeof TRUST_LEVELS)[number]

export const USER_ACCOUNT_STATUSES = ['active', 'flagged', 'banned'] as const
export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number]

/** Push-alert categories a member can control. Security and account alerts
 * remain enabled so a preference cannot hide a potential account takeover. */
export const NOTIFICATION_PREFERENCE_KEYS = [
  'fund_invites',
  'contributions',
  'expenses',
  'deadlines',
  'event_reminders',
] as const
export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number]
export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  fund_invites: true,
  contributions: true,
  expenses: true,
  deadlines: true,
  event_reminders: true,
}

export type UserSummary = {
  id: Uuid
  name: string
  phone: PhoneNumber
  country_code: string | null
  trust_level: TrustLevel
  trust_score: number
  profile_completed: boolean
  status: UserAccountStatus
  created_at: IsoDateTime
}

export type User = UserSummary & {
  email: string | null
  avatar_url: string | null
  preferred_currency: CurrencyCode | null
  token_balance: number
  onboarding_completed: boolean
  notifications_enabled: boolean
  notification_preferences: NotificationPreferences
  privacy_accepted_at: IsoDateTime | null
  privacy_version: string | null
  marketing_consent: boolean
  marketing_consent_at: IsoDateTime | null
  marketing_email_enabled: boolean
  marketing_sms_enabled: boolean
  data_processing_consent: boolean
  data_processing_consent_at: IsoDateTime | null
  last_active_at: IsoDateTime | null
  updated_at: IsoDateTime
}

export type UserFilters = SearchFilter & {
  trust_level?: OneOrMany<TrustLevel>
  status?: OneOrMany<UserAccountStatus>
}

export type UserSortField = 'created_at' | 'name' | 'trust_score'
export type ListUsersRequest = ListRequest<UserFilters, UserSortField>

export type GetUserRequest = {
  user_id: Uuid
}

export type UpdateCurrentUserRequest = {
  name?: string
  email?: string | null
  avatar_url?: string | null
  country_code?: string
  preferred_currency?: CurrencyCode
  notifications_enabled?: boolean
  notification_preferences?: NotificationPreferences
  mobile_money_provider?: string | null
  bank_name?: string | null
  bank_branch_code?: string | null
  bank_account_number?: string | null
  profile_completed?: boolean
  onboarding_completed?: boolean
  terms_version?: string
  privacy_version?: string
  data_processing_consent?: boolean
  marketing_consent?: boolean
  marketing_email_enabled?: boolean
  marketing_sms_enabled?: boolean
}

export type ConnectionSummary = {
  user_id: Uuid
  name: string
  phone: PhoneNumber
}

export type SearchConnectionsRequest = {
  q: string
}

export type AccountClosureRequest = {
  id: Uuid
  ticket_number: string
  status: 'open' | 'pending' | 'in_progress'
  created_at: IsoDateTime
}

/** Categories available to signed-in members when reporting an app issue. */
export const SUPPORT_REPORT_CATEGORIES = [
  'sign_in',
  'fund_or_event',
  'contribution_or_expense',
  'report_or_export',
  'notifications',
  'technical',
  'suggestion',
  'other',
] as const
export type SupportReportCategory = (typeof SUPPORT_REPORT_CATEGORIES)[number]

export type CreateSupportReportRequest = {
  category: SupportReportCategory
  description: string
  /** Non-sensitive context recorded automatically by the app. */
  platform?: 'android' | 'ios' | 'web'
}

export type SupportReportReceipt = {
  id: Uuid
  ticket_number: string
  status: 'open'
  created_at: IsoDateTime
}

export type ListUsersResponse = PaginatedResponse<UserSummary>
export type GetUserResponse = ApiResponse<User>
export type UpdateCurrentUserResponse = ApiResponse<User>
export type SearchConnectionsResponse = ApiResponse<ConnectionSummary[]>
export type GetAccountClosureRequestResponse = ApiResponse<AccountClosureRequest | null>
export type CreateAccountClosureRequestResponse = ApiResponse<AccountClosureRequest>
export type CreateSupportReportResponse = ApiResponse<SupportReportReceipt>
