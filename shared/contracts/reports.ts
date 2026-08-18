import type { IsoDate, IsoDateTime, JsonValue, MoneyAmount, Uuid } from './common'

export const FUND_EXPORT_TYPES = ['pdf', 'csv', 'share'] as const
export type FundExportType = (typeof FUND_EXPORT_TYPES)[number]

export type FundReportContribution = {
  id: Uuid
  contributor_id: Uuid | null
  contributor_name: string
  amount: MoneyAmount
  pledged_amount: MoneyAmount | null
  payment_method: string | null
  reference_number: string | null
  status: string
  is_refunded: boolean
  confirmed_at: IsoDateTime | null
  created_at: IsoDateTime
  notes: string | null
}

export type FundReportExpense = {
  id: Uuid
  description: string
  item_name: string | null
  category: string | null
  amount: MoneyAmount
  vendor_name: string | null
  receipt_url: string | null
  is_sponsored: boolean
  sponsored_by_user_id: Uuid | null
  sponsored_by_name: string | null
  has_open_query: boolean
  created_at: IsoDateTime
  updated_at: IsoDateTime
  deleted_at: IsoDateTime | null
}

export type FundReportMember = {
  id: Uuid
  user_id: Uuid | null
  invited_name: string | null
  invited_phone: string | null
  role: string
  status: string
  invited_at: IsoDateTime | null
  joined_at: IsoDateTime | null
  created_at: IsoDateTime
}

export type FundReportPledgeBalance = {
  pledge_id: Uuid
  contributor_id: Uuid | null
  contributor_name: string
  pledged_amount: MoneyAmount
  allocated_amount: MoneyAmount
  outstanding_amount: MoneyAmount
  pledge_state: string
  created_at: IsoDateTime
}

export type FundReportAuditEntry = {
  id: Uuid
  user_id: Uuid | null
  action: string
  entity_type: string
  entity_id: Uuid
  old_values: Record<string, JsonValue> | null
  new_values: Record<string, JsonValue> | null
  created_at: IsoDateTime
}

export type FundReportEdit = {
  id: Uuid
  edited_by: Uuid
  field_changed: string
  old_value: string | null
  new_value: string | null
  reason: string | null
  created_at: IsoDateTime
}

export type FundExport = {
  id: Uuid
  fund_id: Uuid
  exported_by: Uuid
  export_type: FundExportType
  was_free: boolean
  tokens_spent: number
  created_at: IsoDateTime
}

export type CreateFundExportRequest = {
  export_type: FundExportType
}

/**
 * A single-statement database snapshot used for both on-screen reporting and
 * on-device HTML/PDF rendering. History arrays belong to the same snapshot.
 */
export type FundReportBundle = {
  history_snapshot_at: IsoDateTime
  fund: {
    id: Uuid
    title: string
    description: string | null
    fund_type: string
    fund_code: string
    currency_code: string
    goal_amount: MoneyAmount | null
    status: string
    created_at: IsoDateTime
    contribution_deadline: IsoDate | null
    is_private: boolean
  }
  contributions: FundReportContribution[]
  expenses: FundReportExpense[]
  members: FundReportMember[]
  contributors: Array<{
    id: Uuid
    user_id: Uuid | null
    display_name: string
    phone: string | null
    contributor_type: string
  }>
  pledge_balances: FundReportPledgeBalance[]
  linked_event: {
    name: string
    event_date: IsoDate | null
    venue_name: string | null
  } | null
  sponsorship_items: Array<{
    id: Uuid
    title: string
    target_amount: MoneyAmount
    allocated_amount: MoneyAmount
    outstanding_amount: MoneyAmount
    status: string
    claimed_by_user_id: Uuid | null
    funded_at: IsoDateTime | null
    fulfilled_at: IsoDateTime | null
    created_at: IsoDateTime
  }>
  rich_auntie_awards: Array<{
    id: Uuid
    recipient_user_id: Uuid
    sponsorship_item_id: Uuid | null
    reason_label: string
    created_at: IsoDateTime
  }>
  member_profiles: Array<{ user_id: Uuid; name: string }>
  audit_history: FundReportAuditEntry[]
  contribution_edits: Array<FundReportEdit & { contribution_id: Uuid }>
  expense_edits: Array<FundReportEdit & { expense_id: Uuid }>
  export_history: FundExport[]
}
