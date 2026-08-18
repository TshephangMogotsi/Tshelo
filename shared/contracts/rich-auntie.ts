import type {
  ApiResponse,
  IsoDateTime,
  ListRequest,
  MoneyAmount,
  PaginatedResponse,
  Uuid,
} from './common'

export const RICH_AUNTIE_REASON_CODES = [
  'bought_outfit',
  'paid_catering',
  'covered_tent',
  'bought_cake',
  'major_contribution',
  'transport_costs',
  'custom',
] as const
export type RichAuntieReasonCode = (typeof RICH_AUNTIE_REASON_CODES)[number]

export type RichAuntieSponsorshipProgress = {
  id: Uuid
  title: string
  target_amount: MoneyAmount
  allocated_amount: MoneyAmount
  outstanding_amount: MoneyAmount
  status: 'claimed' | 'funded' | 'fulfilled'
  already_awarded: boolean
  eligible: boolean
}

export type RichAuntieEligibility = {
  fund_id: Uuid
  recipient_user_id: Uuid
  recipient_name: string
  can_award: boolean
  sponsorship_progress: RichAuntieSponsorshipProgress[]
}

export type CreateRichAuntieAwardRequest = {
  fund_id: Uuid
  recipient_user_id: Uuid
  sponsorship_item_id?: Uuid | null
  reason_code: RichAuntieReasonCode
  reason_label: string
  notify_member: boolean
}

export type RichAuntieAward = {
  id: Uuid
  fund_id: Uuid
  fund_title: string
  recipient_user_id: Uuid
  recipient_name: string
  sponsorship_item_id: Uuid | null
  reason_code: RichAuntieReasonCode
  reason_label: string
  awarded_by: Uuid
  awarded_by_name: string
  notify_member: boolean
  created_at: IsoDateTime
}

export type RichAuntieAwardFilters = {
  fund_id?: Uuid
  recipient_user_id?: Uuid
  awarded_by?: Uuid
}
export type ListRichAuntieAwardsRequest = ListRequest<RichAuntieAwardFilters, 'created_at'>

export type RichAuntieRecipientHistory = {
  recipient_user_id: Uuid
  recipient_name: string
  cash_given: MoneyAmount
  fund_count: number
  award_count: number
  is_rich_auntie: boolean
  is_consistent_contributor: boolean
  awards: RichAuntieAward[]
}

export type RichAuntieCelebration = {
  award: RichAuntieAward
  is_recipient: boolean
}

export type GetRichAuntieEligibilityResponse = ApiResponse<RichAuntieEligibility>
export type CreateRichAuntieAwardResponse = ApiResponse<RichAuntieAward>
export type ListRichAuntieAwardsResponse = PaginatedResponse<RichAuntieAward>
export type GetRichAuntieRecipientHistoryResponse = ApiResponse<RichAuntieRecipientHistory>
export type GetRichAuntieCelebrationResponse = ApiResponse<RichAuntieCelebration>
