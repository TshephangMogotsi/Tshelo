import { normalizeInvitationCode, type InvitationKind } from '@shared/invitations'

const ACCOUNT_ROOT = '/account'
const LOCAL_ORIGIN = 'https://app.tshelo.com'

export type InvitationContinuation = {
  kind: InvitationKind
  code: string
  path: string
}

export function safePostLoginPath(value: string | null | undefined): string | null {
  if (!value || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null

  let url: URL
  try {
    url = new URL(value, LOCAL_ORIGIN)
  } catch {
    return null
  }

  if (url.origin !== LOCAL_ORIGIN || (url.pathname !== ACCOUNT_ROOT && !url.pathname.startsWith(`${ACCOUNT_ROOT}/`))) return null
  return `${url.pathname}${url.search}`
}

export function loginPathFor(nextPath: string): string {
  const safePath = safePostLoginPath(nextPath)
  if (!safePath) return '/login'
  const params = new URLSearchParams({ next: safePath })
  return `/login?${params.toString()}`
}

export function invitationContinuation(value: string | null | undefined): InvitationContinuation | null {
  const path = safePostLoginPath(value)
  if (!path) return null

  const url = new URL(path, LOCAL_ORIGIN)
  const kind = url.pathname === '/account/events'
    ? 'event'
    : url.pathname === '/account/funds'
      ? 'fund'
      : null
  if (!kind || Array.from(url.searchParams.keys()).some(key => key !== 'joinCode')) return null

  const joinCodes = url.searchParams.getAll('joinCode')
  if (joinCodes.length !== 1) return null
  const code = normalizeInvitationCode(joinCodes[0])
  if (!code) return null

  return { kind, code, path }
}

export function onboardingPathFor(nextPath: string): `/onboarding${string}` {
  const invitation = invitationContinuation(nextPath)
  if (!invitation) return '/onboarding'
  return `/onboarding?${new URLSearchParams({ next: invitation.path }).toString()}`
}
