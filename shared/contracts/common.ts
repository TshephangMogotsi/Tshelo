/** Framework-neutral JSON primitives shared by the mobile app, web app, and API. */
export type Uuid = string

/** ISO 8601 calendar date (`YYYY-MM-DD`). */
export type IsoDate = string

/** ISO 8601 local time (`HH:mm:ss`). */
export type IsoTime = string

/** ISO 8601 UTC timestamp, including its timezone designator. */
export type IsoDateTime = string

/** Uppercase ISO 4217 currency code. */
export type CurrencyCode = string

/** E.164 phone number. */
export type PhoneNumber = string

/** Base-10 decimal string. Money never crosses the API as a JSON number. */
export type MoneyAmount = string

export type Money = {
  amount: MoneyAmount
  currency_code: CurrencyCode
}

export type JsonPrimitive = string | number | boolean | null
export type JsonObject = { [key: string]: JsonValue }
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject

export const SORT_DIRECTIONS = ['asc', 'desc'] as const
export type SortDirection = (typeof SORT_DIRECTIONS)[number]

export const DEFAULT_PAGE_LIMIT = 25
export const MAX_PAGE_LIMIT = 100

export type PaginationRequest = {
  cursor?: string
  limit?: number
}

export type PaginationMeta = {
  limit: number
  next_cursor: string | null
  has_more: boolean
}

export type Paginated<T> = {
  items: T[]
  page: PaginationMeta
}

export type SearchFilter = {
  q?: string
}

export type DateRangeFilter = {
  from?: IsoDate
  to?: IsoDate
}

export type OneOrMany<T> = T | T[]

export type ListRequest<TFilters, TSortField extends string> = PaginationRequest & TFilters & {
  sort_by?: TSortField
  sort_direction?: SortDirection
}

export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]
export type ApiErrorHttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500

export const API_ERROR_HTTP_STATUS: Record<ApiErrorCode, ApiErrorHttpStatus> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
}

export type ApiFieldError = {
  field: string
  code: string
  message: string
}

export type ApiError = {
  code: ApiErrorCode
  message: string
  retryable: boolean
  details?: JsonValue
  field_errors?: ApiFieldError[]
}

export type ApiSuccess<T> = {
  ok: true
  data: T
  request_id: string
}

export type ApiFailure = {
  ok: false
  error: ApiError
  request_id: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure
export type PaginatedResponse<T> = ApiResponse<Paginated<T>>
export type EmptyResponse = ApiResponse<{ success: true }>

/** Keeps documented configuration values discoverable while allowing custom values. */
export type ExtensibleString<T extends string> = T | (string & {})
