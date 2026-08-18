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
}

export type ListUsersResponse = PaginatedResponse<UserSummary>
export type GetUserResponse = ApiResponse<User>
export type UpdateCurrentUserResponse = ApiResponse<User>
