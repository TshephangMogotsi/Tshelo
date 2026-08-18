#!/usr/bin/env node

import { pathToFileURL } from 'node:url'

const REQUEST_TIMEOUT_MS = 10_000
const TEST_UUID = '00000000-0000-4000-8000-000000000000'

const unauthenticatedCases = [
  ['list users', 'GET', '/api/v1/users'],
  ['get user', 'GET', `/api/v1/users/${TEST_UUID}`],
  ['get current user', 'GET', '/api/v1/users/me'],
  ['update current user', 'PATCH', '/api/v1/users/me'],
  ['search connections', 'GET', '/api/v1/users/connections?q=na'],
  ['list funds', 'GET', '/api/v1/funds'],
  ['get fund', 'GET', `/api/v1/funds/${TEST_UUID}`],
  ['create fund', 'POST', '/api/v1/funds'],
  ['update fund', 'PATCH', `/api/v1/funds/${TEST_UUID}`],
  ['delete fund', 'DELETE', `/api/v1/funds/${TEST_UUID}`],
  ['preview fund invite', 'GET', '/api/v1/funds/invite-preview?code=FND-TESTCODE'],
  ['join fund', 'POST', '/api/v1/funds/join'],
  ['leave fund', 'POST', `/api/v1/funds/${TEST_UUID}/leave`],
  ['get fund workspace', 'GET', `/api/v1/funds/${TEST_UUID}/workspace`],
  ['list fund members', 'GET', `/api/v1/funds/${TEST_UUID}/members`],
  ['list fund contributors', 'GET', `/api/v1/funds/${TEST_UUID}/contributors`],
  ['list fund pledge balances', 'GET', `/api/v1/funds/${TEST_UUID}/pledges`],
  ['get fund member', 'GET', `/api/v1/funds/${TEST_UUID}/members/${TEST_UUID}`],
  ['update fund member', 'PATCH', `/api/v1/funds/${TEST_UUID}/members/${TEST_UUID}`],
  ['get fund permissions', 'GET', `/api/v1/funds/${TEST_UUID}/permissions`],
  ['list fund admin permissions', 'GET', `/api/v1/funds/${TEST_UUID}/admin-permissions`],
  ['configure fund admin', 'PUT', `/api/v1/funds/${TEST_UUID}/members/${TEST_UUID}/admin`],
  ['remove fund admin', 'DELETE', `/api/v1/funds/${TEST_UUID}/members/${TEST_UUID}/admin`],
  ['list sponsorship items', 'GET', `/api/v1/funds/${TEST_UUID}/sponsorships`],
  ['create sponsorship item', 'POST', `/api/v1/funds/${TEST_UUID}/sponsorships`],
  ['update sponsorship item', 'PATCH', `/api/v1/funds/${TEST_UUID}/sponsorships/${TEST_UUID}`],
  ['claim sponsorship item', 'POST', `/api/v1/funds/${TEST_UUID}/sponsorships/${TEST_UUID}/claim`],
  ['release sponsorship item', 'POST', `/api/v1/funds/${TEST_UUID}/sponsorships/${TEST_UUID}/release`],
  ['list fund activity', 'GET', `/api/v1/funds/${TEST_UUID}/activity`],
  ['get fund activity', 'GET', `/api/v1/funds/${TEST_UUID}/activity/${TEST_UUID}`],
  ['get fund report', 'GET', `/api/v1/funds/${TEST_UUID}/report`],
  ['record fund export', 'POST', `/api/v1/funds/${TEST_UUID}/exports`],
  ['get home summary', 'GET', '/api/v1/home/summary'],
  ['list events', 'GET', '/api/v1/events'],
  ['get event', 'GET', `/api/v1/events/${TEST_UUID}`],
  ['create event', 'POST', '/api/v1/events'],
  ['update event', 'PATCH', `/api/v1/events/${TEST_UUID}`],
  ['delete event', 'DELETE', `/api/v1/events/${TEST_UUID}`],
  ['get event workspace', 'GET', `/api/v1/events/${TEST_UUID}/workspace`],
  ['leave event', 'POST', `/api/v1/events/${TEST_UUID}/leave`],
  ['complete event', 'POST', `/api/v1/events/${TEST_UUID}/complete`],
  ['get event budget', 'GET', `/api/v1/events/${TEST_UUID}/budget`],
  ['update event budget', 'PUT', `/api/v1/events/${TEST_UUID}/budget`],
  ['create event announcement', 'POST', `/api/v1/events/${TEST_UUID}/announcements`],
  ['invite event organiser', 'POST', `/api/v1/events/${TEST_UUID}/organiser-invites`],
  ['preview event invite', 'GET', '/api/v1/events/invite-preview?code=EVT-TESTCODE'],
  ['join event', 'POST', '/api/v1/events/join'],
  ['create event fund', 'POST', '/api/v1/events/event-funds'],
  ['sync organiser invites', 'POST', '/api/v1/events/organiser-invites/sync'],
  ['respond to organiser invite', 'POST', '/api/v1/events/organiser-invites/respond'],
  ['list notifications', 'GET', '/api/v1/notifications'],
  ['get notification', 'GET', `/api/v1/notifications/${TEST_UUID}`],
  ['mark notifications read', 'PATCH', '/api/v1/notifications'],
  ['evaluate rewards', 'POST', '/api/v1/rewards/evaluate'],
  ['get reward progress', 'GET', '/api/v1/rewards/progress'],
  ['list unseen rewards', 'GET', '/api/v1/rewards/unseen'],
  ['mark reward seen', 'PATCH', `/api/v1/rewards/${TEST_UUID}/seen`],
  ['list contributions', 'GET', '/api/v1/contributions'],
  ['get contribution', 'GET', `/api/v1/contributions/${TEST_UUID}`],
  ['create contribution', 'POST', '/api/v1/contributions'],
  ['update contribution', 'PATCH', `/api/v1/contributions/${TEST_UUID}`],
  ['refund contribution', 'POST', `/api/v1/contributions/${TEST_UUID}/refund`],
  ['assign detected payment', 'POST', '/api/v1/contributions/detected-assignment'],
  ['create pledge allocation', 'POST', '/api/v1/pledge-allocations'],
  ['create sponsorship allocation', 'POST', '/api/v1/sponsorship-allocations'],
  ['list expenses', 'GET', `/api/v1/expenses?fund_id=${TEST_UUID}`],
  ['create expenses', 'POST', '/api/v1/expenses'],
  ['update expense', 'PATCH', `/api/v1/expenses/${TEST_UUID}`],
  ['create receipt upload session', 'POST', '/api/v1/receipts/upload-session'],
  ['parse receipt', 'POST', '/api/v1/receipts/parse'],
  ['get Rich Auntie eligibility', 'GET', `/api/v1/rich-auntie/eligibility?fund_id=${TEST_UUID}&recipient_user_id=${TEST_UUID}`],
  ['list Rich Auntie awards', 'GET', '/api/v1/rich-auntie/awards'],
  ['create Rich Auntie award', 'POST', '/api/v1/rich-auntie/awards'],
  ['get Rich Auntie recipient history', 'GET', `/api/v1/rich-auntie/recipients/${TEST_UUID}/history`],
  ['get Rich Auntie celebration', 'GET', `/api/v1/rich-auntie/celebrations/${TEST_UUID}`],
  ['get Rich Auntie status', 'GET', '/api/v1/rich-auntie/status'],
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
  body: method === 'GET' || method === 'DELETE' ? undefined : {},
}))

const authenticatedReadCases = [
  ['list funds', '/api/v1/funds?limit=1'],
  ['list events', '/api/v1/events?limit=1'],
  ['list contributions', '/api/v1/contributions?limit=1'],
  ['get current user', '/api/v1/users/me'],
  ['search connections', '/api/v1/users/connections?q=na'],
  ['list notifications', '/api/v1/notifications?limit=1'],
  ['get reward progress', '/api/v1/rewards/progress'],
  ['list unseen rewards', '/api/v1/rewards/unseen'],
  ['get Rich Auntie status', '/api/v1/rich-auntie/status'],
].map(([name, path]) => ({
  name: `authenticated ${name}`,
  method: 'GET',
  path,
  expectedStatus: 200,
  expectedOk: true,
  paginated: name.startsWith('list ') && name !== 'list unseen rewards',
  tokenKind: 'user',
}))

const authenticatedValidationCases = [
  ['reject invalid limit', 'GET', '/api/v1/funds?limit=0'],
  ['reject unknown query field', 'GET', '/api/v1/events?unexpected=true'],
  ['reject inverted date range', 'GET', '/api/v1/contributions?from=2026-12-31&to=2026-01-01'],
  ['reject empty profile patch', 'PATCH', '/api/v1/users/me', {}],
  ['reject empty notification IDs', 'PATCH', '/api/v1/notifications', {}],
  ['reject empty invite response', 'POST', '/api/v1/events/organiser-invites/respond', {}],
  ['reject short event invite code', 'GET', '/api/v1/events/invite-preview?code=x'],
  ['reject empty event join', 'POST', '/api/v1/events/join', {}],
  ['reject short connection search', 'GET', '/api/v1/users/connections?q=x'],
  ['reject invalid reward ID', 'PATCH', '/api/v1/rewards/not-a-uuid/seen'],
  ['reject invalid export type', 'POST', `/api/v1/funds/${TEST_UUID}/exports`, { export_type: 'spreadsheet' }],
].map(([name, method, path, body]) => ({
  name,
  method,
  path,
  body,
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
  ['API_TEST_FUND_ID', 'fund report', '/api/v1/funds/', 'user', '/report'],
  ['API_TEST_EVENT_ID', 'event detail', '/api/v1/events/', 'user'],
  ['API_TEST_EVENT_ID', 'event workspace', '/api/v1/events/', 'user', '/workspace'],
  ['API_TEST_CONTRIBUTION_ID', 'contribution detail', '/api/v1/contributions/', 'user'],
  ['API_TEST_NOTIFICATION_ID', 'notification detail', '/api/v1/notifications/', 'user'],
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
  return detailEnvironment.flatMap(([variable, name, path, tokenKind, suffix = '']) => {
    const id = environment[variable]
    if (!id) return []
    invariant(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
      `${variable} must be a UUID.`,
    )
    return [{
      name: `authenticated ${name}`,
      method: 'GET',
      path: `${path}${id}${suffix}`,
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
