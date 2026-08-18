#!/usr/bin/env node

import { pathToFileURL } from 'node:url'

const REQUEST_TIMEOUT_MS = 10_000
const TEST_UUID = '00000000-0000-4000-8000-000000000000'

const unauthenticatedCases = [
  ['list users', 'GET', '/api/v1/users'],
  ['get user', 'GET', `/api/v1/users/${TEST_UUID}`],
  ['list funds', 'GET', '/api/v1/funds'],
  ['get fund', 'GET', `/api/v1/funds/${TEST_UUID}`],
  ['create fund', 'POST', '/api/v1/funds'],
  ['list events', 'GET', '/api/v1/events'],
  ['get event', 'GET', `/api/v1/events/${TEST_UUID}`],
  ['create event', 'POST', '/api/v1/events'],
  ['list contributions', 'GET', '/api/v1/contributions'],
  ['get contribution', 'GET', `/api/v1/contributions/${TEST_UUID}`],
  ['list support tickets', 'GET', '/api/v1/admin/support-tickets'],
  ['update support ticket', 'PATCH', '/api/v1/admin/support-tickets'],
  ['list admin audit', 'GET', '/api/v1/admin/audit'],
  ['moderate user', 'POST', '/api/v1/admin/users/moderate'],
  ['moderate fund', 'POST', '/api/v1/admin/funds/moderate'],
  ['manage platform admin', 'PUT', '/api/v1/admin/platform-admins'],
].map(([name, method, path]) => ({
  name: `unauthenticated ${name}`,
  method,
  path,
  expectedStatus: 401,
  expectedCode: 'UNAUTHENTICATED',
  body: method === 'GET' ? undefined : {},
}))

const authenticatedReadCases = [
  ['list funds', '/api/v1/funds?limit=1'],
  ['list events', '/api/v1/events?limit=1'],
  ['list contributions', '/api/v1/contributions?limit=1'],
].map(([name, path]) => ({
  name: `authenticated ${name}`,
  method: 'GET',
  path,
  expectedStatus: 200,
  expectedOk: true,
  paginated: true,
  tokenKind: 'user',
}))

const authenticatedValidationCases = [
  ['reject invalid limit', '/api/v1/funds?limit=0'],
  ['reject unknown query field', '/api/v1/events?unexpected=true'],
  ['reject inverted date range', '/api/v1/contributions?from=2026-12-31&to=2026-01-01'],
].map(([name, path]) => ({
  name,
  method: 'GET',
  path,
  expectedStatus: 422,
  expectedCode: 'VALIDATION_FAILED',
  tokenKind: 'user',
}))

const adminReadCases = [
  ['list users', '/api/v1/users?limit=1'],
  ['list support tickets', '/api/v1/admin/support-tickets?limit=1'],
  ['list audit entries', '/api/v1/admin/audit?limit=1'],
].map(([name, path]) => ({
  name: `platform admin ${name}`,
  method: 'GET',
  path,
  expectedStatus: 200,
  expectedOk: true,
  paginated: true,
  tokenKind: 'admin',
}))

const detailEnvironment = [
  ['API_TEST_USER_ID', 'user detail', '/api/v1/users/', 'user'],
  ['API_TEST_FUND_ID', 'fund detail', '/api/v1/funds/', 'user'],
  ['API_TEST_EVENT_ID', 'event detail', '/api/v1/events/', 'user'],
  ['API_TEST_CONTRIBUTION_ID', 'contribution detail', '/api/v1/contributions/', 'user'],
]

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

export function normalizeBaseUrl(input) {
  invariant(input, 'API_BASE_URL is required.')
  const url = new URL(input)
  invariant(url.protocol === 'http:' || url.protocol === 'https:', 'API_BASE_URL must use HTTP or HTTPS.')
  invariant(!url.username && !url.password, 'API_BASE_URL must not contain credentials.')
  url.pathname = url.pathname.replace(/\/$/, '')
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export function assertApiResponse(response, body, testCase) {
  invariant(
    response.status === testCase.expectedStatus,
    `expected HTTP ${testCase.expectedStatus}, received ${response.status}`,
  )
  invariant(
    response.headers.get('content-type')?.includes('application/json'),
    'response Content-Type is not JSON',
  )
  invariant(
    response.headers.get('cache-control')?.includes('no-store'),
    'response does not disable caching',
  )

  const headerRequestId = response.headers.get('x-request-id')
  invariant(headerRequestId, 'X-Request-Id header is missing')
  invariant(body && typeof body === 'object', 'response body is not a JSON object')
  invariant(body.request_id === headerRequestId, 'request IDs in the body and header do not match')
  invariant(typeof body.ok === 'boolean', 'response body is not an ApiResponse envelope')

  if (testCase.expectedOk === true) {
    invariant(body.ok === true, `expected a successful response, received ${body.error?.code ?? 'an error'}`)
    invariant(Object.hasOwn(body, 'data'), 'successful response has no data field')
  }

  if (testCase.expectedCode) {
    invariant(body.ok === false, `expected ${testCase.expectedCode}, received a successful response`)
    invariant(
      body.error?.code === testCase.expectedCode,
      `expected ${testCase.expectedCode}, received ${body.error?.code ?? 'no error code'}`,
    )
    invariant(typeof body.error.message === 'string', 'error response has no safe message')
    invariant(typeof body.error.retryable === 'boolean', 'error response has no retryable flag')
  }

  if (testCase.paginated) {
    invariant(Array.isArray(body.data?.items), 'paginated response data.items is not an array')
    invariant(body.data?.page && typeof body.data.page === 'object', 'paginated response data.page is missing')
    invariant(typeof body.data.page.has_more === 'boolean', 'paginated response page.has_more is missing')
  }
}

export async function verifyEndpoint({
  baseUrl,
  testCase,
  token,
  fetchImpl = fetch,
}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (testCase.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetchImpl(`${baseUrl}${testCase.path}`, {
    method: testCase.method,
    headers,
    body: testCase.body === undefined ? undefined : JSON.stringify(testCase.body),
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const rawBody = await response.text()
  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    throw new Error(`response was not valid JSON: ${rawBody.slice(0, 120)}`)
  }

  assertApiResponse(response, body, testCase)
  return { name: testCase.name, status: response.status }
}

function detailCases(environment) {
  return detailEnvironment.flatMap(([variable, name, path, tokenKind]) => {
    const id = environment[variable]
    if (!id) return []
    invariant(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
      `${variable} must be a UUID.`,
    )
    return [{
      name: `authenticated ${name}`,
      method: 'GET',
      path: `${path}${id}`,
      expectedStatus: 200,
      expectedOk: true,
      tokenKind,
    }]
  })
}

export function buildVerificationCases(environment = process.env) {
  const cases = [...unauthenticatedCases]
  if (environment.API_ACCESS_TOKEN) {
    cases.push(...authenticatedReadCases, ...authenticatedValidationCases, ...detailCases(environment))
  }
  if (environment.API_ADMIN_ACCESS_TOKEN) cases.push(...adminReadCases)
  return cases
}

export async function runApiVerification({
  environment = process.env,
  fetchImpl = fetch,
  onPass = () => {},
} = {}) {
  const baseUrl = normalizeBaseUrl(environment.API_BASE_URL)
  const cases = buildVerificationCases(environment)

  for (const testCase of cases) {
    const token = testCase.tokenKind === 'admin'
      ? environment.API_ADMIN_ACCESS_TOKEN
      : testCase.tokenKind === 'user'
        ? environment.API_ACCESS_TOKEN
        : undefined
    const result = await verifyEndpoint({ baseUrl, testCase, token, fetchImpl })
    onPass(result)
  }

  return {
    passed: cases.length,
    authenticatedUserChecks: Boolean(environment.API_ACCESS_TOKEN),
    authenticatedAdminChecks: Boolean(environment.API_ADMIN_ACCESS_TOKEN),
  }
}

async function main() {
  try {
    const result = await runApiVerification({
      onPass: ({ name, status }) => console.log(`PASS ${status} ${name}`),
    })
    console.log(`\nAPI verification passed: ${result.passed} checks.`)
    if (!result.authenticatedUserChecks) {
      console.log('Authenticated app-user checks skipped: API_ACCESS_TOKEN is not set.')
    }
    if (!result.authenticatedAdminChecks) {
      console.log('Authenticated platform-admin checks skipped: API_ADMIN_ACCESS_TOKEN is not set.')
    }
  } catch (error) {
    console.error(`API verification failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
