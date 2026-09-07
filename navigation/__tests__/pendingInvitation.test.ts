import * as SecureStore from 'expo-secure-store'
import { clearPendingInvitation, readPendingInvitation, rememberPendingInvitation } from '../pendingInvitation'

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>
let storedValue: string | null

describe('pending mobile invitation', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
    storedValue = null
    secureStore.setItemAsync.mockImplementation(async (_key, value) => { storedValue = value })
    secureStore.getItemAsync.mockImplementation(async () => storedValue)
    secureStore.deleteItemAsync.mockImplementation(async () => { storedValue = null })
  })

  it('survives authentication and normalizes the invitation code', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000)
    await rememberPendingInvitation({ kind: 'event', code: 'evt-a1b2c3d4' })

    await expect(readPendingInvitation(2_000)).resolves.toEqual({ kind: 'event', code: 'EVT-A1B2C3D4' })
  })

  it('discards invitations older than seven days', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000)
    await rememberPendingInvitation({ kind: 'fund', code: 'FND-A1B2C3D4' })

    await expect(readPendingInvitation(8 * 24 * 60 * 60 * 1000)).resolves.toBeNull()
  })

  it('can be cleared once navigation resumes', async () => {
    await rememberPendingInvitation({ kind: 'event', code: 'EVT-A1B2C3D4' })
    await clearPendingInvitation()
    await expect(readPendingInvitation()).resolves.toBeNull()
  })
})
