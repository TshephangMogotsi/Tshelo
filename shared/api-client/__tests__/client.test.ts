import {
  createSupabaseTokenProvider,
  createTsheloApiClient,
  TsheloApiError,
  TsheloApiProtocolError,
} from '..'

function response(
  status: number,
  body: unknown,
  requestId = 'request-123',
): Response {
  const headers = new Map<string, string>([
    ['content-type', 'application/json'],
    ['x-request-id', requestId],
  ])
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    text: async () => JSON.stringify(body),
  } as Response
}

function success<T>(data: T, requestId = 'request-123') {
  return response(200, { ok: true, data, request_id: requestId }, requestId)
}

function failure(status: number, code: string, requestId = 'request-123') {
  return response(status, {
    ok: false,
    error: { code, message: `Safe ${code} message.`, retryable: false },
    request_id: requestId,
  }, requestId)
}

describe('shared Tshelo API client', () => {
  it('serializes typed filters and sends the current Supabase access token', async () => {
    let seenUrl = ''
    let seenOptions: RequestInit | undefined
    const fetchMock = jest.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      seenUrl = String(input)
      seenOptions = options
      return success({
        items: [],
        page: { limit: 10, next_cursor: null, has_more: false },
      })
    })
    const client = createTsheloApiClient({
      baseUrl: 'https://api.tshelo.example/',
      getAccessToken: async () => 'current-access-token',
      fetch: fetchMock as typeof fetch,
    })

    await client.funds.list({
      limit: 10,
      status: ['active', 'closed'],
      member_user_id: '11111111-1111-4111-8111-111111111111',
    })

    const parsed = new URL(seenUrl)
    expect(parsed.origin).toBe('https://api.tshelo.example')
    expect(parsed.pathname).toBe('/api/v1/funds')
    expect(parsed.searchParams.get('limit')).toBe('10')
    expect(parsed.searchParams.getAll('status')).toEqual(['active', 'closed'])
    expect(parsed.searchParams.get('member_user_id')).toBe('11111111-1111-4111-8111-111111111111')
    expect((seenOptions?.headers as Record<string, string>).Authorization).toBe('Bearer current-access-token')
  })

  it('refreshes once after a 401 and retries with the new token', async () => {
    const seenAuthorizations: string[] = []
    const fetchMock = jest.fn(async (_input: RequestInfo | URL, options?: RequestInit) => {
      seenAuthorizations.push((options?.headers as Record<string, string>).Authorization)
      return seenAuthorizations.length === 1
        ? failure(401, 'UNAUTHENTICATED')
        : success({ items: [], page: { limit: 25, next_cursor: null, has_more: false } })
    })
    const refreshAccessToken = jest.fn(async () => 'refreshed-access-token')
    const client = createTsheloApiClient({
      baseUrl: 'https://api.tshelo.example',
      getAccessToken: async () => 'expired-access-token',
      refreshAccessToken,
      fetch: fetchMock as typeof fetch,
    })

    await expect(client.events.list()).resolves.toMatchObject({ items: [] })
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(seenAuthorizations).toEqual([
      'Bearer expired-access-token',
      'Bearer refreshed-access-token',
    ])
  })

  it('does not loop when refresh cannot produce a session', async () => {
    const fetchMock = jest.fn(async () => failure(401, 'UNAUTHENTICATED'))
    const client = createTsheloApiClient({
      baseUrl: 'https://api.tshelo.example',
      getAccessToken: async () => 'expired-access-token',
      refreshAccessToken: async () => null,
      fetch: fetchMock as typeof fetch,
    })

    await expect(client.contributions.list()).rejects.toMatchObject({
      name: 'TsheloApiError',
      code: 'UNAUTHENTICATED',
      status: 401,
      requestId: 'request-123',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws typed API errors with field and retry metadata intact', async () => {
    const apiFailure = response(422, {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'One or more request fields are invalid.',
        retryable: false,
        field_errors: [{ field: 'title', code: 'too_short', message: 'Title is too short.' }],
      },
      request_id: 'validation-request',
    }, 'validation-request')
    const client = createTsheloApiClient({
      baseUrl: 'https://api.tshelo.example',
      getAccessToken: async () => 'access-token',
      fetch: jest.fn(async () => apiFailure) as unknown as typeof fetch,
    })

    const promise = client.funds.create({
      title: 'x',
      fund_type: 'other',
      currency_code: 'BWP',
    })
    await expect(promise).rejects.toBeInstanceOf(TsheloApiError)
    await expect(promise).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      retryable: false,
      apiError: {
        field_errors: [{ field: 'title', code: 'too_short' }],
      },
    })
  })

  it('rejects malformed envelopes and mismatched request IDs', async () => {
    const malformedClient = createTsheloApiClient({
      baseUrl: 'https://api.tshelo.example',
      getAccessToken: async () => 'access-token',
      fetch: jest.fn(async () => response(200, { data: {} })) as unknown as typeof fetch,
    })
    await expect(malformedClient.users.get('user-id')).rejects.toBeInstanceOf(TsheloApiProtocolError)

    const mismatchClient = createTsheloApiClient({
      baseUrl: 'https://api.tshelo.example',
      getAccessToken: async () => 'access-token',
      fetch: jest.fn(async () => response(200, {
        ok: true,
        data: {},
        request_id: 'body-id',
      }, 'header-id')) as unknown as typeof fetch,
    })
    await expect(mismatchClient.users.get('user-id')).rejects.toThrow('mismatched request identifiers')
  })

  it('uses exact mutation methods and JSON bodies', async () => {
    const fetchMock = jest.fn(async () => success({ id: 'event-id' }))
    const client = createTsheloApiClient({
      baseUrl: 'https://api.tshelo.example',
      getAccessToken: async () => 'access-token',
      fetch: fetchMock as typeof fetch,
    })

    await client.events.create({
      name: 'Client integration event',
      event_type: 'other',
      event_date: '2026-10-01',
      currency_code: 'BWP',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tshelo.example/api/v1/events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Client integration event',
          event_type: 'other',
          event_date: '2026-10-01',
          currency_code: 'BWP',
        }),
      }),
    )
  })

  it('adapts Supabase getSession and refreshSession without exposing refresh tokens', async () => {
    const provider = createSupabaseTokenProvider({
      getSession: async () => ({
        data: { session: { access_token: 'current-token' } },
        error: null,
      }),
      refreshSession: async () => ({
        data: { session: { access_token: 'refreshed-token' } },
        error: null,
      }),
    })

    await expect(provider.getAccessToken()).resolves.toBe('current-token')
    await expect(provider.refreshAccessToken()).resolves.toBe('refreshed-token')
  })
})
