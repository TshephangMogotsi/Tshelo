export const INVITATION_WEB_ORIGIN = 'https://app.tshelo.com'
export const INVITATION_CODE_MIN_LENGTH = 8
export const INVITATION_CODE_MAX_LENGTH = 32

export type InvitationKind = 'event' | 'fund'

export type Invitation = {
  kind: InvitationKind
  code: string
}

const INVITATION_CODE_PATTERN = /^[A-Z0-9-]+$/

export function normalizeInvitationCode(value: string): string | null {
  const code = value.trim().toUpperCase()
  if (
    code.length < INVITATION_CODE_MIN_LENGTH ||
    code.length > INVITATION_CODE_MAX_LENGTH ||
    !INVITATION_CODE_PATTERN.test(code)
  ) return null
  return code
}

/**
 * Normalizes a code received from an invitation route. Older native share
 * targets could append Tshelo's share sentence to the URL path, so accept only
 * that known legacy suffix while keeping the general code validator strict.
 */
export function normalizeInvitationPathCode(value: string): string | null {
  const decoded = decodePathSegment(value)
  const direct = normalizeInvitationCode(decoded)
  if (direct) return direct

  const legacyShare = decoded.match(/^([A-Z0-9-]{8,32})\s+Join\s+.+\s+on\s+Tshelo\.?$/i)
  return legacyShare ? normalizeInvitationCode(legacyShare[1]) : null
}

export function invitationPath(kind: InvitationKind, value: string): string {
  const code = normalizeInvitationCode(value)
  if (!code) throw new Error('Invitation codes must contain 8 to 32 letters, numbers, or hyphens.')
  return `/invite/${kind}/${encodeURIComponent(code)}`
}

export function invitationUrl(kind: InvitationKind, code: string): string {
  return `${INVITATION_WEB_ORIGIN}${invitationPath(kind, code)}`
}

/**
 * A public, read-only fund page intended for social sharing. It deliberately
 * uses the same high-entropy invite code as the join flow, but never exposes
 * fund ledger data.
 */
export function fundShareUrl(code: string, updatedAt?: string | null): string {
  const normalizedCode = normalizeInvitationCode(code)
  if (!normalizedCode) throw new Error('Invalid fund share code.')
  const url = new URL(`/share/f/${encodeURIComponent(normalizedCode)}`, INVITATION_WEB_ORIGIN)
  const timestamp = updatedAt ? Date.parse(updatedAt) : Number.NaN
  if (Number.isFinite(timestamp)) url.searchParams.set('v', String(Math.floor(timestamp / 1000)))
  return url.toString()
}

export function invitationAccountPath({ kind, code }: Invitation): string {
  const normalizedCode = normalizeInvitationCode(code)
  if (!normalizedCode) throw new Error('Invalid invitation code.')
  const section = kind === 'event' ? 'events' : 'funds'
  return `/account/${section}?joinCode=${encodeURIComponent(normalizedCode)}`
}

export function parseInvitationUrl(value: string): Invitation | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol === 'https:' && url.origin === INVITATION_WEB_ORIGIN) {
    const match = url.pathname.match(/^\/invite\/(event|fund)\/([^/]+)\/?$/)
    if (!match) return null
    const code = normalizeInvitationCode(decodePathSegment(match[2]))
    return code ? { kind: match[1] as InvitationKind, code } : null
  }

  if (url.protocol === 'tshelo:' || url.protocol === 'exp+tshelo:') {
    const legacyKind = url.hostname === 'event' ? 'event' : url.hostname === 'join' ? 'fund' : null
    const rawCode = url.pathname.replace(/^\//, '').replace(/\/$/, '')
    const code = normalizeInvitationCode(decodePathSegment(rawCode))
    return legacyKind && code ? { kind: legacyKind, code } : null
  }

  return null
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}
