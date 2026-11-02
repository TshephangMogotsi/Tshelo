jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/api/auth', () => ({ authenticateApiRequest: (...args: unknown[]) => mockAuthenticate(...args) }))
jest.mock('@/lib/config', () => ({ getSupabaseConfig: () => ({ url: 'https://auth.test', key: 'public' }), getSupabaseAdminConfig: () => ({ url: 'https://auth.test', key: 'service' }) }))
jest.mock('../../admin/node_modules/@supabase/supabase-js', () => ({ createClient: (_url: string, key: string) => key === 'service' ? mockAdmin : mockPublic }))

const mockAuthenticate = jest.fn()
const mockVerifyOtp = jest.fn()
const originalFetch = global.fetch
const mockUser = { id: 'test-user', email: 'old@example.test', email_confirmed_at: '2026-10-01', phone: '26770000000', phone_confirmed_at: '2026-10-01', app_metadata: {} }
const mockAdmin = {
  auth: { admin: { getUserById: jest.fn(), mfa: { listFactors: jest.fn() }, updateUserById: jest.fn(), signOut: jest.fn() } },
  from: jest.fn((table: string) => ({ select() { return this }, eq() { return this }, maybeSingle: async () => table === 'users' ? { data: { id: 'test-user', is_banned: false, deleted_at: null }, error: null } : { data: null, error: null } })),
  rpc: jest.fn(),
}
const mockPublic = { auth: { verifyOtp: mockVerifyOtp, signOut: jest.fn().mockResolvedValue({ error: null }), updateUser: jest.fn() } }
import { POST } from '../../admin/app/api/v1/users/me/contact-recovery/route'

const request = (body: object) => new Request('https://app.test/api/v1/users/me/contact-recovery', { method: 'POST', headers: { authorization: 'Bearer e30.e30.c2ln', 'content-type': 'application/json' }, body: JSON.stringify(body) })
const payload = { action: 'start', target: 'email', code: '123456', destination: 'new@example.test' }
beforeEach(() => {
  jest.clearAllMocks()
  process.env.TSHELO_RECOVERY_ENABLED = 'true'
  process.env.RECOVERY_CHALLENGE_SECRET = 'a'.repeat(32)
  process.env.RECOVERY_EMAIL_API_KEY = 'test-key'
  process.env.RECOVERY_EMAIL_FROM = 'Test <test@example.test>'
  process.env.RECOVERY_STATIC_OTP_AUDITED = 'true'
  process.env.RECOVERY_STATIC_OTP_BLOCKLIST = ''
  mockAuthenticate.mockResolvedValue({ ok: true, auth: { actor: { user_id: 'test-user' } } })
  mockAdmin.auth.admin.getUserById.mockResolvedValue({ data: { user: mockUser }, error: null })
  mockAdmin.auth.admin.mfa.listFactors.mockResolvedValue({ data: { factors: [] }, error: null })
  mockVerifyOtp.mockResolvedValue({ data: { user: { id: 'test-user' }, session: { access_token: 'test' } }, error: null })
  mockAdmin.rpc.mockResolvedValue({ data: true, error: null })
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never
})
afterEach(() => { global.fetch = originalFetch; for (const k of ['TSHELO_RECOVERY_ENABLED','RECOVERY_CHALLENGE_SECRET','RECOVERY_EMAIL_API_KEY','RECOVERY_EMAIL_FROM','RECOVERY_STATIC_OTP_AUDITED','RECOVERY_STATIC_OTP_BLOCKLIST']) delete process.env[k] })

it('fails closed when disabled or when the proof belongs to another account', async () => {
  process.env.TSHELO_RECOVERY_ENABLED = 'false'
  expect((await POST(request(payload))).status).toBe(503)
  process.env.TSHELO_RECOVERY_ENABLED = 'true'
  mockVerifyOtp.mockResolvedValueOnce({ data: { user: { id: 'different-user' }, session: { access_token: 'test' } }, error: null })
  expect((await POST(request(payload))).status).toBe(400)
  expect(mockAdmin.rpc).not.toHaveBeenCalled()
})

it('does not accept a static tester OTP as phone ownership proof', async () => {
  process.env.RECOVERY_STATIC_OTP_BLOCKLIST = '+26770000000'
  expect((await POST(request(payload))).status).toBe(403)
  expect(mockVerifyOtp).not.toHaveBeenCalled()
})

it('does not bypass a verified MFA factor', async () => {
  mockAdmin.auth.admin.mfa.listFactors.mockResolvedValueOnce({ data: { factors: [{ status: 'verified' }] }, error: null })
  expect((await POST(request(payload))).status).toBe(403)
  expect(mockVerifyOtp).not.toHaveBeenCalled()
})
