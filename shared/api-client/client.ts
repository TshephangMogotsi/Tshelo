import type {
  AdminAuditEntry,
  Contribution,
  ContributionSummary,
  CreateEventRequest,
  CreateFundRequest,
  Event,
  EventGuest,
  EventSummary,
  Fund,
  FundDetail,
  FundSummary,
  ListAdminAuditRequest,
  ListContributionsRequest,
  ListEventsRequest,
  ListFundsRequest,
  ListSupportTicketsRequest,
  ListUsersRequest,
  ModerateFundRequest,
  ModerateUserRequest,
  Paginated,
  PlatformAdmin,
  SupportTicketSummary,
  UpdateSupportTicketRequest,
  UpsertPlatformAdminRequest,
  User,
  UserSummary,
} from '../contracts'
import { API_ERROR_CODES, type ApiError, type ApiResponse } from '../contracts/common'
import { toQueryString } from './query'

export type ApiAccessTokenProvider = () => Promise<string | null>

export type TsheloApiClientOptions = {
  baseUrl: string
  getAccessToken: ApiAccessTokenProvider
  refreshAccessToken?: ApiAccessTokenProvider
  fetch?: typeof fetch
  timeoutMs?: number
}

export type ApiCallOptions = {
  signal?: AbortSignal
}

type RequestOptions = ApiCallOptions & {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT'
  body?: object
}

export class TsheloApiError extends Error {
  readonly status: number
  readonly requestId: string | null
  readonly apiError: ApiError

  constructor(status: number, requestId: string | null, apiError: ApiError) {
    super(apiError.message)
    this.name = 'TsheloApiError'
    this.status = status
    this.requestId = requestId
    this.apiError = apiError
  }

  get code() {
    return this.apiError.code
  }

  get retryable() {
    return this.apiError.retryable
  }
}

export class TsheloApiProtocolError extends Error {
  readonly status: number
  readonly requestId: string | null

  constructor(message: string, status: number, requestId: string | null) {
    super(message)
    this.name = 'TsheloApiProtocolError'
    this.status = status
    this.requestId = requestId
  }
}

function normalizeBaseUrl(input: string) {
  const url = new URL(input)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Tshelo API base URL must use HTTP or HTTPS.')
  }
  if (url.username || url.password) {
    throw new Error('Tshelo API base URL must not contain credentials.')
  }
  url.pathname = url.pathname.replace(/\/$/, '')
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!value || typeof value !== 'object') return false
  const envelope = value as {
    ok?: unknown
    data?: unknown
    error?: { code?: unknown; message?: unknown; retryable?: unknown }
    request_id?: unknown
  }
  if (typeof envelope.ok !== 'boolean' || typeof envelope.request_id !== 'string') return false
  if (envelope.ok) return Object.prototype.hasOwnProperty.call(envelope, 'data')
  return Boolean(
    envelope.error &&
    typeof envelope.error.code === 'string' &&
    (API_ERROR_CODES as readonly string[]).includes(envelope.error.code) &&
    typeof envelope.error.message === 'string' &&
    typeof envelope.error.retryable === 'boolean',
  )
}

function joinSignals(callerSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('Tshelo API request timed out.')), timeoutMs)
  const abortFromCaller = () => controller.abort(callerSignal?.reason)

  if (callerSignal?.aborted) abortFromCaller()
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true })

  return {
    signal: controller.signal,
    release() {
      clearTimeout(timeout)
      callerSignal?.removeEventListener('abort', abortFromCaller)
    },
  }
}

export function createTsheloApiClient(options: TsheloApiClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl)
  const fetchImpl = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 15_000
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
    throw new Error('Tshelo API timeout must be a positive number.')
  }

  async function execute(path: string, token: string | null, request: RequestOptions) {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (request.body) headers['Content-Type'] = 'application/json'

    const abort = joinSignals(request.signal, timeoutMs)
    try {
      return await fetchImpl(`${baseUrl}${path}`, {
        method: request.method ?? 'GET',
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: abort.signal,
      })
    } finally {
      abort.release()
    }
  }

  async function parse<T>(response: Response): Promise<T> {
    const requestId = response.headers.get('x-request-id')
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new TsheloApiProtocolError(
        'The Tshelo API returned a non-JSON response.',
        response.status,
        requestId,
      )
    }
    if (!requestId) {
      throw new TsheloApiProtocolError(
        'The Tshelo API response is missing its request identifier.',
        response.status,
        null,
      )
    }
    let envelope: unknown
    try {
      envelope = JSON.parse(await response.text())
    } catch {
      throw new TsheloApiProtocolError(
        'The Tshelo API returned invalid JSON.',
        response.status,
        requestId,
      )
    }

    if (!isApiResponse(envelope)) {
      throw new TsheloApiProtocolError(
        'The Tshelo API returned an invalid response envelope.',
        response.status,
        requestId,
      )
    }
    if (requestId !== envelope.request_id) {
      throw new TsheloApiProtocolError(
        'The Tshelo API returned mismatched request identifiers.',
        response.status,
        requestId,
      )
    }
    if (!envelope.ok) {
      if (response.ok) {
        throw new TsheloApiProtocolError(
          'The Tshelo API returned error data with a success status.',
          response.status,
          envelope.request_id,
        )
      }
      throw new TsheloApiError(response.status, envelope.request_id, envelope.error)
    }
    if (!response.ok) {
      throw new TsheloApiProtocolError(
        'The Tshelo API returned success data with an error status.',
        response.status,
        envelope.request_id,
      )
    }

    return envelope.data as T
  }

  async function request<T>(path: string, requestOptions: RequestOptions = {}) {
    let accessToken = await options.getAccessToken()
    let response = await execute(path, accessToken, requestOptions)

    if (response.status === 401 && options.refreshAccessToken) {
      accessToken = await options.refreshAccessToken()
      if (accessToken) response = await execute(path, accessToken, requestOptions)
    }

    return parse<T>(response)
  }

  return {
    users: {
      list(input: ListUsersRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<UserSummary>>(`/api/v1/users${toQueryString(input)}`, call)
      },
      get(userId: string, call?: ApiCallOptions) {
        return request<User>(`/api/v1/users/${encodeURIComponent(userId)}`, call)
      },
    },
    funds: {
      list(input: ListFundsRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<FundSummary>>(`/api/v1/funds${toQueryString(input)}`, call)
      },
      get(fundId: string, call?: ApiCallOptions) {
        return request<FundDetail>(`/api/v1/funds/${encodeURIComponent(fundId)}`, call)
      },
      create(input: CreateFundRequest, call?: ApiCallOptions) {
        return request<Fund>('/api/v1/funds', { ...call, method: 'POST', body: input })
      },
    },
    events: {
      list(input: ListEventsRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<EventSummary>>(`/api/v1/events${toQueryString(input)}`, call)
      },
      get(eventId: string, call?: ApiCallOptions) {
        return request<{ event: Event; guests: EventGuest[] }>(
          `/api/v1/events/${encodeURIComponent(eventId)}`,
          call,
        )
      },
      create(input: CreateEventRequest, call?: ApiCallOptions) {
        return request<Event>('/api/v1/events', { ...call, method: 'POST', body: input })
      },
    },
    contributions: {
      list(input: ListContributionsRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<ContributionSummary>>(
          `/api/v1/contributions${toQueryString(input)}`,
          call,
        )
      },
      get(contributionId: string, call?: ApiCallOptions) {
        return request<Contribution>(
          `/api/v1/contributions/${encodeURIComponent(contributionId)}`,
          call,
        )
      },
    },
    admin: {
      listSupportTickets(input: ListSupportTicketsRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<SupportTicketSummary>>(
          `/api/v1/admin/support-tickets${toQueryString(input)}`,
          call,
        )
      },
      updateSupportTicket(input: UpdateSupportTicketRequest, call?: ApiCallOptions) {
        return request<SupportTicketSummary>('/api/v1/admin/support-tickets', {
          ...call,
          method: 'PATCH',
          body: input,
        })
      },
      listAudit(input: ListAdminAuditRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<AdminAuditEntry>>(
          `/api/v1/admin/audit${toQueryString(input)}`,
          call,
        )
      },
      moderateUser(input: ModerateUserRequest, call?: ApiCallOptions) {
        return request<UserSummary>('/api/v1/admin/users/moderate', {
          ...call,
          method: 'POST',
          body: input,
        })
      },
      moderateFund(input: ModerateFundRequest, call?: ApiCallOptions) {
        return request<FundSummary>('/api/v1/admin/funds/moderate', {
          ...call,
          method: 'POST',
          body: input,
        })
      },
      upsertPlatformAdmin(input: UpsertPlatformAdminRequest, call?: ApiCallOptions) {
        return request<PlatformAdmin>('/api/v1/admin/platform-admins', {
          ...call,
          method: 'PUT',
          body: input,
        })
      },
    },
  }
}

export type TsheloApiClient = ReturnType<typeof createTsheloApiClient>
