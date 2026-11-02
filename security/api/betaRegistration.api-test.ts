jest.mock('../../admin/node_modules/@supabase/supabase-js', () => ({ createClient: () => ({ auth: { admin: { createUser: mockCreateUser } } }) }))
jest.mock('@/lib/config', () => ({ getSupabaseAdminConfig: () => ({ url: 'https://auth.test', key: 'test' }) }))
const mockCreateUser = jest.fn()
import { POST } from '../../admin/app/api/beta-registration/route'

const request = (email: string) => new Request('https://tshelo.test/api/beta-registration', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }),
})

beforeEach(() => {
  process.env.BETA_WEB_REGISTRATION_ENABLED = 'true'
  process.env.BETA_WEB_APPROVED_EMAILS = 'approved@example.test'
  mockCreateUser.mockReset().mockResolvedValue({ error: null })
})
afterEach(() => {
  delete process.env.BETA_WEB_REGISTRATION_ENABLED
  delete process.env.BETA_WEB_APPROVED_EMAILS
})

it('fails closed without approval or while registration is disabled', async () => {
  expect((await POST(request('other@example.test'))).status).toBe(403)
  process.env.BETA_WEB_REGISTRATION_ENABLED = 'false'
  expect((await POST(request('approved@example.test'))).status).toBe(403)
  expect(mockCreateUser).not.toHaveBeenCalled()
})

it('creates an approved email account without confirming its email', async () => {
  expect((await POST(request(' Approved@Example.Test '))).status).toBe(200)
  expect(mockCreateUser).toHaveBeenCalledWith({ email: 'approved@example.test', app_metadata: { beta_web_approved: true } })
})

it('permits a retry for an existing account but fails on provider errors', async () => {
  mockCreateUser.mockResolvedValueOnce({ error: { code: 'email_exists' } })
  expect((await POST(request('approved@example.test'))).status).toBe(200)
  mockCreateUser.mockResolvedValueOnce({ error: { code: 'unexpected_failure' } })
  expect((await POST(request('approved@example.test'))).status).toBe(503)
})
