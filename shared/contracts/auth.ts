import type { Uuid } from './common'

export const API_AUTHORIZATION_HEADER = 'Authorization' as const
export const API_AUTH_SCHEME = 'Bearer' as const
export const SUPABASE_AUTHENTICATED_ROLE = 'authenticated' as const

export type AuthenticatedApiActor = {
  user_id: Uuid
  role: typeof SUPABASE_AUTHENTICATED_ROLE
}

const SUPABASE_JWT_PATTERN =
  /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i

/**
 * Extracts a three-part Supabase JWT from an HTTP Authorization header.
 * Signature and claim verification remains a server responsibility.
 */
export function extractBearerJwt(header: string | null | undefined): string | null {
  if (!header) return null

  return SUPABASE_JWT_PATTERN.exec(header)?.[1] ?? null
}
