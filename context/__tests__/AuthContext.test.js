jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
}))
jest.mock('../../lib/api', () => ({
  api: {
    events: { syncOrganiserInvites: jest.fn() },
    users: { me: jest.fn() },
  },
}))
jest.mock('../../lib/pushNotifications', () => ({ unregisterPushToken: jest.fn() }))

const React = require('react')
const { act, create } = require('react-test-renderer')
const { AuthProvider, useAuth } = require('../AuthContext')
const { supabase } = require('../../lib/supabase')
const { api } = require('../../lib/api')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
let auth

function Consumer() {
  auth = useAuth()
  return null
}

beforeEach(() => {
  jest.clearAllMocks()
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  })
  supabase.auth.signOut.mockResolvedValue({ error: null })
})

afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
  tree = null
  auth = null
})

async function renderProvider() {
  await act(async () => {
    tree = create(React.createElement(AuthProvider, null, React.createElement(Consumer)))
    await Promise.resolve()
  })
}

it('loads security details from the current authentication session', async () => {
  await renderProvider()
  supabase.auth.getSession.mockResolvedValueOnce({
    data: {
      session: {
        user: {
          phone: '+26771000001',
          phone_confirmed_at: '2026-09-11T08:00:00.000Z',
          last_sign_in_at: '2026-09-11T08:30:00.000Z',
        },
      },
    },
    error: null,
  })

  await expect(auth.loadSecuritySession()).resolves.toEqual({
    phone: '+26771000001',
    phoneConfirmedAt: '2026-09-11T08:00:00.000Z',
    lastSignInAt: '2026-09-11T08:30:00.000Z',
  })
})

it('revokes other sessions without signing out the current one', async () => {
  await renderProvider()
  await auth.signOutOtherSessions()

  expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'others' })
})

it('derives the home currency from the account country when no preference is saved', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: { user: { id: 'user-1' } } },
    error: null,
  })
  api.events.syncOrganiserInvites.mockResolvedValue(undefined)
  api.users.me.mockResolvedValue({
    profile_completed: true,
    name: 'Kefilwe',
    country_code: 'ZM',
    preferred_currency: null,
    token_balance: 0,
    trust_score: 5,
  })

  await renderProvider()

  expect(auth.countryCode).toBe('ZM')
  expect(auth.preferredCurrency).toBe('ZMW')
})
