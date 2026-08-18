import {
  TsheloApiError,
  TsheloApiProtocolError,
  type ApiCallOptions,
} from '@shared/api-client'
import type {
  ApiErrorCode,
  ApiFieldError,
  Paginated,
} from '@shared/contracts'

export const API_READ_MAX_ATTEMPTS = 2
export const API_READ_RETRY_DELAY_MS = 300

export type ApiUiErrorKind =
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limit'
  | 'server'
  | 'network'
  | 'protocol'
  | 'cancelled'
  | 'unknown'

export type ApiUiError = {
  kind: ApiUiErrorKind
  message: string
  retryable: boolean
  requestId: string | null
  fieldErrors: ApiFieldError[]
}

const API_ERROR_KINDS: Record<ApiErrorCode, ApiUiErrorKind> = {
  BAD_REQUEST: 'validation',
  UNAUTHENTICATED: 'authentication',
  FORBIDDEN: 'authorization',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  VALIDATION_FAILED: 'validation',
  RATE_LIMITED: 'rate_limit',
  INTERNAL_ERROR: 'server',
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && error.message === 'Tshelo API request timed out.'
}

export function isApiCancellation(error: unknown, signal?: AbortSignal) {
  return Boolean(
    signal?.aborted ||
    (error instanceof Error && error.name === 'AbortError'),
  )
}

export function toApiUiError(error: unknown, signal?: AbortSignal): ApiUiError {
  if (isApiCancellation(error, signal)) {
    return {
      kind: 'cancelled',
      message: 'Request cancelled.',
      retryable: false,
      requestId: null,
      fieldErrors: [],
    }
  }

  if (error instanceof TsheloApiError) {
    return {
      kind: API_ERROR_KINDS[error.code],
      message: error.message,
      retryable: error.retryable,
      requestId: error.requestId,
      fieldErrors: error.apiError.field_errors ?? [],
    }
  }

  if (error instanceof TsheloApiProtocolError) {
    return {
      kind: 'protocol',
      message: 'The server returned an unexpected response. Please try again later.',
      retryable: false,
      requestId: error.requestId,
      fieldErrors: [],
    }
  }

  if (error instanceof TypeError || isTimeoutError(error)) {
    return {
      kind: 'network',
      message: 'Check your connection and try again.',
      retryable: true,
      requestId: null,
      fieldErrors: [],
    }
  }

  return {
    kind: 'unknown',
    message: 'Something went wrong. Please try again.',
    retryable: false,
    requestId: null,
    fieldErrors: [],
  }
}

export function shouldRetryApiRead(error: unknown, signal?: AbortSignal) {
  if (isApiCancellation(error, signal)) return false
  if (error instanceof TsheloApiError) return error.retryable
  return error instanceof TypeError || isTimeoutError(error)
}

function abortError() {
  const error = new Error('Request cancelled.')
  error.name = 'AbortError'
  return error
}

async function waitForRetry(delayMs: number, signal?: AbortSignal) {
  if (signal?.aborted) throw abortError()
  if (delayMs === 0) return

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', cancel)
      resolve()
    }, delayMs)
    const cancel = () => {
      clearTimeout(timeout)
      reject(abortError())
    }
    signal?.addEventListener('abort', cancel, { once: true })
  })
}

export type ApiReadOptions = {
  signal?: AbortSignal
  maxAttempts?: number
  retryDelayMs?: number
}

/**
 * Retries read-only API calls once when the server marks an error retryable or
 * the transport fails. Mutations must call the typed API method directly.
 */
export async function runApiRead<T>(
  operation: (call: ApiCallOptions) => Promise<T>,
  options: ApiReadOptions = {},
) {
  const maxAttempts = options.maxAttempts ?? API_READ_MAX_ATTEMPTS
  const retryDelayMs = options.retryDelayMs ?? API_READ_RETRY_DELAY_MS
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new Error('API read maxAttempts must be an integer from 1 to 3.')
  }
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
    throw new Error('API read retryDelayMs must be zero or greater.')
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw abortError()
    try {
      return await operation({ signal: options.signal })
    } catch (error) {
      if (attempt === maxAttempts || !shouldRetryApiRead(error, options.signal)) throw error
      await waitForRetry(retryDelayMs * attempt, options.signal)
    }
  }

  throw new Error('API read exhausted without returning or throwing.')
}

export type ApiLoadingKind = 'initial' | 'refresh' | 'more'
export type ApiLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ApiLoadState<T> = {
  status: ApiLoadStatus
  loading: ApiLoadingKind | null
  data: T | null
  error: ApiUiError | null
}

export function createApiLoadState<T>(data: T | null = null): ApiLoadState<T> {
  return {
    status: data === null ? 'idle' : 'ready',
    loading: null,
    data,
    error: null,
  }
}

export function beginApiLoad<T>(state: ApiLoadState<T>, loading: ApiLoadingKind): ApiLoadState<T> {
  return { ...state, status: 'loading', loading, error: null }
}

export function completeApiLoad<T>(data: T): ApiLoadState<T> {
  return { status: 'ready', loading: null, data, error: null }
}

export function failApiLoad<T>(
  state: ApiLoadState<T>,
  error: unknown,
  signal?: AbortSignal,
): ApiLoadState<T> {
  const uiError = toApiUiError(error, signal)
  if (uiError.kind === 'cancelled') {
    return {
      ...state,
      status: state.data === null ? 'idle' : 'ready',
      loading: null,
      error: null,
    }
  }
  return {
    ...state,
    status: state.data === null ? 'error' : 'ready',
    loading: null,
    error: uiError,
  }
}

export type ApiPageState<T> = {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export function createApiPageState<T>(): ApiPageState<T> {
  return { items: [], nextCursor: null, hasMore: false }
}

export function mergeApiPage<T>(
  current: ApiPageState<T>,
  incoming: Paginated<T>,
  mode: 'replace' | 'append',
  itemKey?: (item: T) => string,
): ApiPageState<T> {
  let items = mode === 'replace' ? [...incoming.items] : [...current.items, ...incoming.items]

  if (itemKey) {
    const seen = new Set<string>()
    items = items.filter((item) => {
      const key = itemKey(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  return {
    items,
    nextCursor: incoming.page.next_cursor,
    hasMore: incoming.page.has_more,
  }
}

export type LatestApiRequest = {
  start(): AbortSignal
  cancel(): void
  isCurrent(signal: AbortSignal): boolean
}

/** Cancels an obsolete load when parameters change, a refresh starts, or a screen unmounts. */
export function createLatestApiRequest(): LatestApiRequest {
  let active: AbortController | null = null

  return {
    start() {
      active?.abort()
      active = new AbortController()
      return active.signal
    },
    cancel() {
      active?.abort()
      active = null
    },
    isCurrent(signal) {
      return active?.signal === signal && !signal.aborted
    },
  }
}
