jest.mock('@/lib/config', () => ({ getSupabaseAdminConfig: () => ({ url: 'https://auth.test', key: 'service' }) }))
jest.mock('../../admin/node_modules/@supabase/supabase-js', () => ({ createClient: () => mockClient }))
const mockInsert = jest.fn()
const mockClient = { rpc: jest.fn(), from: jest.fn(() => ({ insert: mockInsert })) }
import { POST } from '../../admin/app/api/account-deletion-request/route'
import { validateUpdateCurrentUserRequest } from '../../admin/lib/api/validation'

const originalFetch = global.fetch
let requestNumber = 0
const request = () => new Request('https://app.test/api/account-deletion-request', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `email-test-${++requestNumber}` },
  body: JSON.stringify({ email: ' Owner@Example.test ', acknowledged: true }),
})
beforeEach(() => {
  jest.clearAllMocks()
  mockClient.rpc.mockResolvedValue({ data: 'e2000000-0000-4000-8000-000000000001', error: null })
  mockInsert.mockResolvedValue({ error: null })
  process.env.RESEND_ACCOUNT_DELETION_API_KEY = 'test-key'
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never
})
afterEach(() => { global.fetch = originalFetch; delete process.env.RESEND_ACCOUNT_DELETION_API_KEY })

it('binds the emailed token to the verified Auth identity returned by the database', async () => {
  expect((await POST(request())).status).toBe(200)
  expect(mockClient.rpc).toHaveBeenCalledWith('resolve_verified_closure_account', { p_email: 'owner@example.test' })
  expect(mockClient.from).toHaveBeenCalledTimes(1)
  expect(mockClient.from).toHaveBeenCalledWith('account_closure_verifications')
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
    account_user_id: 'e2000000-0000-4000-8000-000000000001', contact_email: 'owner@example.test',
    token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
  }))
  expect(global.fetch).toHaveBeenCalledTimes(1)
})
it('keeps the response generic and sends no token when no verified identity exists', async () => {
  mockClient.rpc.mockResolvedValue({ data: null, error: null })
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
  expect(mockInsert).not.toHaveBeenCalled()
  expect(global.fetch).not.toHaveBeenCalled()
})
it('fails closed without sending a link when the binding is rejected', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    mockInsert.mockResolvedValue({ error: { code: '42501', message: 'CLOSURE_VERIFIED_ACCOUNT_REQUIRED' } })
    expect((await POST(request())).status).toBe(503)
    expect(global.fetch).not.toHaveBeenCalled()
  } finally { log.mockRestore() }
})
it('preserves legacy unchanged-email input validation while ordinary edits stay valid', () => {
  expect(validateUpdateCurrentUserRequest({ name: 'Ordinary name' }).ok).toBe(true)
  expect(validateUpdateCurrentUserRequest({ name: 'Ordinary name', email: 'owner@example.test' }).ok).toBe(true)
})
