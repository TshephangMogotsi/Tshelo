import type {
  ApiResponse,
  CurrencyCode,
  DateRangeFilter,
  IsoDateTime,
  ListRequest,
  MoneyAmount,
  PaginatedResponse,
  Uuid,
} from './common'

/** Values accepted by the database's `expense_category` enum. */
export const EXPENSE_CATEGORIES = [
  'casket_coffin', 'burial_site', 'hearse_transport', 'mortuary_fees',
  'death_certificate', 'grave_preparation', 'tombstone', 'flowers_wreaths',
  'church_fees', 'venue_hire', 'tent_marquee', 'chairs_tables',
  'sound_system', 'generator', 'catering_full', 'catering_tea',
  'meat_livestock', 'groceries', 'drinks_beverages', 'cooking_equipment',
  'transport_family', 'transport_general', 'accommodation', 'fuel',
  'photography', 'videography', 'programs_printing', 'decorations',
  'lobola_cattle', 'lobola_cash', 'lobola_gifts', 'baby_gifts',
  'baby_essentials', 'kitchen_items', 'graduation_gown',
  'graduation_photos', 'miscellaneous', 'other',
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && (EXPENSE_CATEGORIES as readonly string[]).includes(value)
}

export type Expense = {
  id: Uuid
  fund_id: Uuid
  added_by: Uuid
  description: string
  item_name: string | null
  category: string | null
  custom_category: string | null
  amount: MoneyAmount
  currency_code: CurrencyCode
  quantity: MoneyAmount | null
  unit_price: MoneyAmount | null
  vendor_name: string | null
  receipt_path: string | null
  is_sponsored: boolean
  sponsored_by_user_id: Uuid | null
  sponsored_by_name: string | null
  has_open_query: boolean
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

export type ExpenseFilters = DateRangeFilter & {
  fund_id?: Uuid
  sponsored_by_user_id?: Uuid
}

export type ExpenseSortField = 'created_at' | 'amount'
export type ListExpensesRequest = ListRequest<ExpenseFilters, ExpenseSortField>

export type CreateExpenseItem = {
  description: string
  item_name?: string | null
  category?: string | null
  custom_category?: string | null
  amount: MoneyAmount
  currency_code: CurrencyCode
  quantity?: MoneyAmount | null
  unit_price?: MoneyAmount | null
  vendor_name?: string | null
  receipt_path?: string | null
  sponsored_by_user_id?: Uuid | null
  sponsored_by_name?: string | null
}

export type CreateExpensesRequest = {
  fund_id: Uuid
  items: CreateExpenseItem[]
  fulfill_sponsorship_item_id?: Uuid | null
}

export type UpdateExpenseRequest = Partial<Omit<CreateExpenseItem, 'currency_code' | 'receipt_path'>>

export type CreateExpensesResult = {
  expenses: Expense[]
  sponsorship_fulfilled: boolean
}

export type ListExpensesResponse = PaginatedResponse<Expense>
export type CreateExpensesResponse = ApiResponse<CreateExpensesResult>
export type UpdateExpenseResponse = ApiResponse<Expense>
