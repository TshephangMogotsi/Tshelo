import {
  beginApiLoad,
  completeApiLoad,
  createApiLoadState,
  createApiPageState,
  createLatestApiRequest,
  failApiLoad,
  mergeApiPage,
  runApiRead,
  shouldRetryApiRead,
  toApiUiError,
} from '../apiScreen'
import { TsheloApiError, TsheloApiProtocolError } from '@shared/api-client'

describe('mobile API screen guardrails', () => {
  it('maps typed API errors without losing safe fields or request IDs', () => {
    const error = new TsheloApiError(422, 'request-1', {
      code: 'VALIDATION_FAILED',
      message: 'Please fix the highlighted fields.',
      retryable: false,
      field_errors: [{ field: 'title', code: 'required', message: 'Title is required.' }],
    })

    expect(toApiUiError(error)).toEqual({
      kind: 'validation',
      message: 'Please fix the highlighted fields.',
      retryable: false,
      requestId: 'request-1',
      fieldErrors: [{ field: 'title', code: 'required', message: 'Title is required.' }],
    })
  })

  it('uses generic messages for protocol, transport, and unknown errors', () => {
    expect(toApiUiError(new TsheloApiProtocolError('raw protocol detail', 502, 'request-2'))).toMatchObject({
      kind: 'protocol',
      retryable: false,
      requestId: 'request-2',
    })
    expect(toApiUiError(new TypeError('Network request failed'))).toMatchObject({
      kind: 'network',
      retryable: true,
    })
    expect(toApiUiError(new Error('private implementation detail'))).toMatchObject({
      kind: 'unknown',
      retryable: false,
    })
  })

  it('retries safe reads once for retryable failures', async () => {
    let attempts = 0
    const result = await runApiRead(async () => {
      attempts += 1
      if (attempts === 1) throw new TypeError('Network request failed')
      return 'ready'
    }, { retryDelayMs: 0 })

    expect(result).toBe('ready')
    expect(attempts).toBe(2)
  })

  it('does not retry non-retryable API failures', async () => {
    const error = new TsheloApiError(409, 'request-3', {
      code: 'CONFLICT',
      message: 'The record changed.',
      retryable: false,
    })
    let attempts = 0

    await expect(runApiRead(async () => {
      attempts += 1
      throw error
    }, { retryDelayMs: 0 })).rejects.toBe(error)
    expect(attempts).toBe(1)
    expect(shouldRetryApiRead(error)).toBe(false)
  })

  it('retains existing data for refresh errors and suppresses cancellations', () => {
    const ready = completeApiLoad({ name: 'Existing' })
    const refreshing = beginApiLoad(ready, 'refresh')
    const failed = failApiLoad(refreshing, new TypeError('Network request failed'))
    expect(failed).toMatchObject({
      status: 'ready',
      loading: null,
      data: { name: 'Existing' },
      error: { kind: 'network' },
    })

    const controller = new AbortController()
    controller.abort()
    expect(failApiLoad(beginApiLoad(createApiLoadState(), 'initial'), new Error('stale'), controller.signal))
      .toEqual(createApiLoadState())
  })

  it('replaces or appends opaque-cursor pages and removes duplicate IDs', () => {
    const first = mergeApiPage(createApiPageState<{ id: string }>(), {
      items: [{ id: 'one' }, { id: 'two' }],
      page: { limit: 2, next_cursor: 'cursor-2', has_more: true },
    }, 'replace', (item) => item.id)
    const second = mergeApiPage(first, {
      items: [{ id: 'two' }, { id: 'three' }],
      page: { limit: 2, next_cursor: null, has_more: false },
    }, 'append', (item) => item.id)

    expect(second).toEqual({
      items: [{ id: 'one' }, { id: 'two' }, { id: 'three' }],
      nextCursor: null,
      hasMore: false,
    })
  })

  it('cancels obsolete requests and identifies only the latest signal', () => {
    const requests = createLatestApiRequest()
    const first = requests.start()
    const second = requests.start()

    expect(first.aborted).toBe(true)
    expect(requests.isCurrent(first)).toBe(false)
    expect(requests.isCurrent(second)).toBe(true)

    requests.cancel()
    expect(second.aborted).toBe(true)
    expect(requests.isCurrent(second)).toBe(false)
  })
})
