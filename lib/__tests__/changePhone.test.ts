jest.mock('../supabase', () => ({ supabase: { auth: { getUser: jest.fn(), signInWithOtp: jest.fn(), updateUser: jest.fn(), verifyOtp: jest.fn() } } }))
import { supabase } from '../supabase'
import { confirmCurrentNumber, confirmPhoneChange, requestPhoneChange, sendCurrentNumberCode } from '../changePhone'

const auth = supabase.auth as unknown as { getUser: jest.Mock; signInWithOtp: jest.Mock; updateUser: jest.Mock; verifyOtp: jest.Mock }
const user = { id: 'existing-account', phone: '26771234567', new_phone: '26772345678', phone_confirmed_at: '2026-10-06', app_metadata: {} }
beforeEach(() => {
  jest.clearAllMocks()
  auth.getUser.mockResolvedValue({ data: { user }, error: null })
  auth.signInWithOtp.mockResolvedValue({ error: null })
  auth.updateUser.mockResolvedValue({ data: { user }, error: null })
  auth.verifyOtp.mockImplementation(({ type }) => Promise.resolve({
    data: { user: { ...user, phone: type === 'sms' ? user.phone : user.new_phone } },
    error: null,
  }))
})
it('sends an ownership code to the number currently attached to the account', async () => {
  await expect(sendCurrentNumberCode(user.id)).resolves.toBe('+26771234567')
  expect(auth.signInWithOtp).toHaveBeenCalledWith({ phone: '+26771234567', options: { shouldCreateUser: false } })
})
it('requires a code from the existing number before the new-number step', async () => {
  await confirmCurrentNumber(user.id, '+26771234567', '123456')
  expect(auth.verifyOtp).toHaveBeenCalledWith({ phone: '+26771234567', token: '123456', type: 'sms' })
})
it('starts a new-number change only on the existing signed-in account', async () => {
  await requestPhoneChange(user.id, '+26772345678')
  expect(auth.updateUser).toHaveBeenCalledWith({ phone: '+26772345678' })
})
it('rejects the current number and a different session before sending', async () => {
  await expect(requestPhoneChange(user.id, '+26771234567')).rejects.toThrow('different')
  await expect(requestPhoneChange('other-account', '+26772345678')).rejects.toThrow('sign in again')
  expect(auth.updateUser).not.toHaveBeenCalled()
})
it('verifies a phone-change code rather than signing up another account', async () => {
  await confirmPhoneChange(user.id, '+26772345678', '123456')
  expect(auth.verifyOtp).toHaveBeenCalledWith({ phone: '+26772345678', token: '123456', type: 'phone_change' })
})
it('rejects a replaced pending request before submitting the code', async () => {
  await expect(confirmPhoneChange(user.id, '+26773456789', '123456')).rejects.toThrow('no longer pending')
  expect(auth.verifyOtp).not.toHaveBeenCalled()
})
it('rejects an ownership code if it creates a session for another account', async () => {
  auth.verifyOtp.mockResolvedValue({ data: { user: { ...user, id: 'other-account' } }, error: null })
  await expect(confirmCurrentNumber(user.id, '+26771234567', '123456')).rejects.toThrow('Could not confirm ownership')
})
it('does not report success for another account or an unconfirmed number', async () => {
  auth.verifyOtp.mockResolvedValue({ data: { user: { ...user, id: 'other-account', phone: user.new_phone } }, error: null })
  await expect(confirmPhoneChange(user.id, '+26772345678', '123456')).rejects.toThrow('Could not confirm')
  auth.verifyOtp.mockResolvedValue({ data: { user: { ...user, phone: user.new_phone, phone_confirmed_at: null } }, error: null })
  await expect(confirmPhoneChange(user.id, '+26772345678', '123456')).rejects.toThrow('Could not confirm')
})
it('leaves errors from rejected or expired codes as failures', async () => {
  auth.verifyOtp.mockResolvedValue({ data: { user: null }, error: new Error('expired') })
  await expect(confirmPhoneChange(user.id, '+26772345678', '123456')).rejects.toThrow('expired')
})
