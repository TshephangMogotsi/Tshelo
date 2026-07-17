export type Tab = 'contributions' | 'expenses' | 'members'

export type MemberRole = 'owner' | 'admin' | 'member'

export type Contribution = {
  id:              string
  contributor_name: string
  amount:          number
  payment_method:  string | null
  reference_number: string | null
  detected_via:    string
  status:          string
  is_refunded:     boolean
  confirmed_at:    string | null
  notes:           string | null
}

export type Expense = {
  id:              string
  vendor_name:     string | null
  description:     string
  category:        string | null
  amount:          number
  created_at:      string
  notes?:          string | null
  has_open_query:  boolean
}

export type Member = {
  id:           string
  user_id:      string | null
  display_name: string
  phone:        string
  role:         MemberRole
  joined_at:    string
}

export type PendingRequest = {
  id:           string
  user_id:      string | null
  display_name: string
  phone:        string
  requested_at: string
}

export type FundDetail = {
  id:                  string
  owner_id:            string
  title:               string
  status:              string
  currency_code:       string
  goal_amount:         number
  total_contributions: number
  total_expenses:      number
  balance:             number
  member_count:        number
  fund_code:           string
  linked_event_id:     string | null
  contribution_deadline: string | null
  is_private:          boolean
}

export const PROVIDER_COLORS: Record<string, string> = {
  orange_money: '#FF6B00',
  myzaka:       '#009FE3',
  smega:        '#8B2FC9',
}

export function formatMoney(amount: number, currencyCode: string): string {
  const symbol = currencyCode === 'BWP' ? 'P' : currencyCode
  return `${symbol} ${amount.toLocaleString('en-BW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-BW', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
