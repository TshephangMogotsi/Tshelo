jest.mock('server-only', () => ({}), { virtual: true })

import { updateApiCurrentUser } from '../../admin/lib/data/api-account'
import { toUser, type UserRow } from '../../admin/lib/data/api-records'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../../shared/contracts/users'

const actor = '11111111-1111-4111-8111-111111111111'

it('preserves saved notification preferences and does not invent processing consent for missing data', () => {
  const user = toUser({ id: actor, notification_preferences: { contributions: false } } as unknown as UserRow)
  expect(user.notification_preferences).toEqual({ ...DEFAULT_NOTIFICATION_PREFERENCES, contributions: false })
  expect(user.data_processing_consent).toBe(false)
})
function setup() {
  const query = {
    select: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    then(resolve: (value: { error: null }) => unknown) { return Promise.resolve({ error: null }).then(resolve) },
  }
  const client = { from: jest.fn(() => query), rpc: jest.fn().mockResolvedValue({ error: null }) }
  return { query, client, supabase: client as unknown as Parameters<typeof updateApiCurrentUser>[0] }
}

it('routes payment and consent decisions to protected RPCs and keeps ordinary profile edits scoped to the actor', async () => {
  const { client, query, supabase } = setup()
  await updateApiCurrentUser(supabase, actor, {
    name: ' Test profile ', bank_account_number: ' TEST-123 ', mobile_money_provider: 'orange_money',
    terms_version: '1.0', privacy_version: '1.0', data_processing_consent: true,
    marketing_email_enabled: true,
  })
  expect(client.rpc).toHaveBeenCalledWith('update_own_payment_details', { p_details: { bank_account_number: 'TEST-123', mobile_money_provider: 'orange_money' } })
  expect(client.rpc).toHaveBeenCalledWith('record_own_consents', { p_consents: { terms_version: '1.0', privacy_version: '1.0', data_processing_consent: true, marketing_email_enabled: true } })
  expect(query.update).toHaveBeenCalledWith({ name: 'Test profile' })
  expect(query.eq).toHaveBeenCalledWith('id', actor)
  expect(query.is).toHaveBeenCalledWith('deleted_at', null)
  const selected = query.select.mock.calls[0][0]
  expect(selected).not.toMatch(/bank_account_number|mobile_money_number|ciphertext/)
})

it('does not drop a channel-only decision or an explicit marketing withdrawal', async () => {
  const { client, query, supabase } = setup()
  await updateApiCurrentUser(supabase, actor, { marketing_sms_enabled: true })
  expect(client.rpc).toHaveBeenLastCalledWith('record_own_consents', { p_consents: { marketing_sms_enabled: true } })
  await updateApiCurrentUser(supabase, actor, { marketing_consent: false, marketing_email_enabled: true })
  expect(client.rpc).toHaveBeenLastCalledWith('record_own_consents', { p_consents: { marketing_consent: false, marketing_email_enabled: true } })
  expect(query.update).not.toHaveBeenCalled()
})

it('returns RPC failures rather than reporting a successful profile save', async () => {
  for (const request of [{ bank_account_number: 'TEST-123' }, { data_processing_consent: true }]) {
    const { client, query, supabase } = setup()
    client.rpc.mockResolvedValue({ error: { message: 'fixture rejection' } } as never)
    const result = await updateApiCurrentUser(supabase, actor, request)
    expect(result.error).toBeTruthy()
    expect(query.update).not.toHaveBeenCalled()
    expect(query.maybeSingle).not.toHaveBeenCalled()
  }
})
