import { sendRecoveryVerification } from '../../admin/lib/recovery-contacts'

const account = { id: 'user-a', email: 'a@example.test', email_confirmed_at: '2026-10-01', phone: '26770000000', phone_confirmed_at: '2026-10-01', app_metadata: {} }
function client() {
  return { auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: account }, error: null }),
    signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
  } }
}

it('requests the existing verified email when recovering a phone', async () => {
  const c = client()
  await sendRecoveryVerification(c as never, 'phone')
  expect(c.auth.signInWithOtp).toHaveBeenCalledWith({ email: account.email, options: { shouldCreateUser: false } })
})

it('requires a verified alternate method', async () => {
  const c = client()
  c.auth.getUser.mockResolvedValueOnce({ data: { user: { ...account, email_confirmed_at: null } }, error: null })
  await expect(sendRecoveryVerification(c as never, 'phone')).rejects.toThrow('verified email')
  expect(c.auth.signInWithOtp).not.toHaveBeenCalled()
})
