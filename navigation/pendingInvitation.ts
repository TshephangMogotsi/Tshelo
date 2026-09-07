import * as SecureStore from 'expo-secure-store'
import { normalizeInvitationCode, type Invitation } from '@shared/invitations'

const PENDING_INVITATION_KEY = 'tshelo_pending_invitation_v1'
const PENDING_INVITATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type StoredInvitation = Invitation & { receivedAt: number }

export async function rememberPendingInvitation(invitation: Invitation) {
  const value: StoredInvitation = { ...invitation, receivedAt: Date.now() }
  try {
    await SecureStore.setItemAsync(PENDING_INVITATION_KEY, JSON.stringify(value))
  } catch {
    // The in-memory continuation still works when device storage is unavailable.
  }
}

export async function readPendingInvitation(now = Date.now()): Promise<Invitation | null> {
  let stored: string | null
  try {
    stored = await SecureStore.getItemAsync(PENDING_INVITATION_KEY)
  } catch {
    return null
  }
  if (!stored) return null

  try {
    const value = JSON.parse(stored) as Partial<StoredInvitation>
    const code = typeof value.code === 'string' ? normalizeInvitationCode(value.code) : null
    const isFresh = typeof value.receivedAt === 'number' && now - value.receivedAt <= PENDING_INVITATION_MAX_AGE_MS
    if ((value.kind === 'event' || value.kind === 'fund') && code && isFresh) return { kind: value.kind, code }
  } catch {
    // Invalid or old app data is discarded below.
  }

  await clearPendingInvitation()
  return null
}

export async function clearPendingInvitation() {
  try {
    await SecureStore.deleteItemAsync(PENDING_INVITATION_KEY)
  } catch {
    // There is no user action required when storage was already unavailable.
  }
}
