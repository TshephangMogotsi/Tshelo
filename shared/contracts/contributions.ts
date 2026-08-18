import type {
  ApiResponse,
  CurrencyCode,
  DateRangeFilter,
  IsoDateTime,
  ListRequest,
  MoneyAmount,
  OneOrMany,
  PaginatedResponse,
  PhoneNumber,
  Uuid,
} from './common'

export const CONTRIBUTION_STATUSES = ['pledged', 'pending', 'confirmed', 'refunded', 'disputed'] as const
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number]

export const PAYMENT_METHODS = ['orange_money', 'myzaka', 'smega', 'mpesa', 'mtn_momo', 'airtel_money', 'ecocash', 'bank_transfer', 'cash', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export type ContributionSummary = {
  id: Uuid
  fund_id: Uuid
  user_id: Uuid | null
  contributor_name: string
  amount: MoneyAmount
  pledged_amount: MoneyAmount | null
  currency_code: CurrencyCode
  payment_method: PaymentMethod | null
  status: ContributionStatus
  is_refunded: boolean
  confirmed_at: IsoDateTime | null
  created_at: IsoDateTime
}

export type Contribution = ContributionSummary & {
  contributor_phone: PhoneNumber
  reference_number: string | null
  detected_via: string
  receipt_number: string | null
  notes: string | null
  updated_at: IsoDateTime
}

export type ContributionFilters = DateRangeFilter & {
  fund_id?: Uuid
  user_id?: Uuid
  status?: OneOrMany<ContributionStatus>
  payment_method?: OneOrMany<PaymentMethod>
}

export type ContributionSortField = 'created_at' | 'confirmed_at' | 'amount'
export type ListContributionsRequest = ListRequest<ContributionFilters, ContributionSortField>

export type GetContributionRequest = {
  contribution_id: Uuid
}

export type CreateContributionRequest = {
  fund_id: Uuid
  contributor_user_id?: Uuid | null
  contributor_name: string
  contributor_phone: PhoneNumber
  amount: MoneyAmount
  pledged_amount?: MoneyAmount | null
  currency_code: CurrencyCode
  payment_method?: PaymentMethod | null
  reference_number?: string | null
  status: 'pledged' | 'pending' | 'confirmed'
  notes?: string | null
  disclaimer_accepted?: boolean
}

export type UpdateContributionRequest = {
  contribution_id: Uuid
  contributor_name?: string
  amount?: MoneyAmount
  pledged_amount?: MoneyAmount | null
  payment_method?: PaymentMethod | null
  reference_number?: string | null
  status?: ContributionStatus
  notes?: string | null
}

export type RefundContributionRequest = {
  contribution_id: Uuid
  reason?: string
}

export type ListContributionsResponse = PaginatedResponse<ContributionSummary>
export type GetContributionResponse = ApiResponse<Contribution>
export type CreateContributionResponse = ApiResponse<Contribution>
export type UpdateContributionResponse = ApiResponse<Contribution>
export type RefundContributionResponse = ApiResponse<Contribution>
