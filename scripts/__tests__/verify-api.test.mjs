import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertApiResponse,
  buildVerificationCases,
  normalizeBaseUrl,
  runApiVerification,
  verifyEndpoint,
} from '../verify-api.mjs'

function apiResponse(status, body, requestId = 'request-123') {
  return Response.json(
    { ...body, request_id: requestId },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    },
  )
}

test('normalizes safe HTTP base URLs', () => {
  assert.equal(normalizeBaseUrl('https://api.example.com/'), 'https://api.example.com')
  assert.throws(() => normalizeBaseUrl('file:///tmp/api'), /HTTP or HTTPS/)
  assert.throws(() => normalizeBaseUrl('https://user:secret@example.com'), /credentials/)
})

test('accepts a standard paginated success envelope', () => {
  const response = apiResponse(200, {
    ok: true,
    data: { items: [], page: { has_more: false, next_cursor: null } },
  })
  assert.doesNotThrow(() => assertApiResponse(response, {
    ok: true,
    data: { items: [], page: { has_more: false, next_cursor: null } },
    request_id: 'request-123',
  }, {
    expectedStatus: 200,
    expectedOk: true,
    paginated: true,
  }))
})

test('rejects mismatched request IDs and malformed errors', () => {
  const response = apiResponse(401, {
    ok: false,
    error: { code: 'UNAUTHENTICATED', message: 'No.', retryable: false },
  })
  assert.throws(() => assertApiResponse(response, {
    ok: false,
    error: { code: 'UNAUTHENTICATED', message: 'No.', retryable: false },
    request_id: 'different-id',
  }, {
    expectedStatus: 401,
    expectedCode: 'UNAUTHENTICATED',
  }), /request IDs/)
})

test('sends bearer authentication without logging or transforming the token', async () => {
  const seen = {}
  await verifyEndpoint({
    baseUrl: 'https://api.example.com',
    token: 'short-lived-jwt',
    testCase: {
      name: 'list funds',
      method: 'GET',
      path: '/api/v1/funds?limit=1',
      expectedStatus: 200,
      expectedOk: true,
      paginated: true,
    },
    fetchImpl: async (url, options) => {
      seen.url = url
      seen.authorization = options.headers.Authorization
      return apiResponse(200, {
        ok: true,
        data: { items: [], page: { has_more: false, next_cursor: null } },
      })
    },
  })
  assert.equal(seen.url, 'https://api.example.com/api/v1/funds?limit=1')
  assert.equal(seen.authorization, 'Bearer short-lived-jwt')
})

test('always verifies every unauthenticated route and only enables token suites explicitly', () => {
  const unauthenticated = buildVerificationCases({})
  assert.equal(unauthenticated.length, 16)
  assert.ok(unauthenticated.every(testCase => testCase.expectedStatus === 401))

  const authenticated = buildVerificationCases({
    API_ACCESS_TOKEN: 'user-token',
    API_ADMIN_ACCESS_TOKEN: 'admin-token',
  })
  assert.equal(authenticated.length, 25)
  assert.ok(authenticated.some(testCase => testCase.expectedStatus === 422))
  assert.ok(authenticated.some(testCase => testCase.name === 'platform admin list audit entries'))
})

test('runs the unauthenticated black-box suite with a supplied fetch implementation', async () => {
  let calls = 0
  const passes = []
  const result = await runApiVerification({
    environment: { API_BASE_URL: 'https://api.example.com' },
    fetchImpl: async () => {
      calls += 1
      return apiResponse(401, {
        ok: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'A valid bearer access token is required.',
          retryable: false,
        },
      }, `request-${calls}`)
    },
    onPass: result => passes.push(result),
  })

  assert.equal(result.passed, 16)
  assert.equal(calls, 16)
  assert.equal(passes.length, 16)
  assert.equal(result.authenticatedUserChecks, false)
})
