import 'server-only'

import {
  createClient,
  type JwtPayload,
  type SupabaseClient,
} from '@supabase/supabase-js'
import {
  SUPABASE_AUTHENTICATED_ROLE,
  extractBearerJwt,
  type AuthenticatedApiActor,
} from '@shared/contracts/auth'
import type { ApiError } from '@shared/contracts/common'
import { getSupabaseConfig } from '@/lib/config'

export type ApiAuthContext = {
  actor: AuthenticatedApiActor
  /** Database client scoped to the caller's JWT so Row Level Security applies. */
  supabase: SupabaseClient
}

export type ApiAuthenticationResult =
  | { ok: true; auth: ApiAuthContext }
  | { ok: false; status: 401; error: ApiError }

let verificationClient: SupabaseClient | undefined

function getVerificationClient() {
  if (verificationClient) return verificationClient

  const { url, key } = getSupabaseConfig()
  verificationClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })

  return verificationClient
}

function createCallerClient(accessToken: string) {
  const { url, key } = getSupabaseConfig()

  return createClient(url, key, {
    accessToken: async () => accessToken,
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

function unauthenticated(message: string, retryable: boolean): ApiAuthenticationResult {
  return {
    ok: false,
    status: 401,
    error: {
      code: 'UNAUTHENTICATED',
      message,
      retryable,
    },
  }
}

function hasAuthenticatedAudience(claims: JwtPayload) {
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  return audiences.includes(SUPABASE_AUTHENTICATED_ROLE)
}

/**
 * Verifies the caller's Supabase access token and derives the API actor from
 * its signed `sub` claim. Request payload user IDs are never used as identity.
 */
export async function authenticateApiRequest(request: Request): Promise<ApiAuthenticationResult> {
  const accessToken = extractBearerJwt(request.headers.get('authorization'))

  if (!accessToken) {
    return unauthenticated('A valid bearer access token is required.', false)
  }

  const { data, error } = await getVerificationClient().auth.getClaims(accessToken)
  const claims = data?.claims

  if (error || !claims) {
    return unauthenticated('The access token is invalid or expired.', true)
  }

  if (
    claims.role !== SUPABASE_AUTHENTICATED_ROLE ||
    !hasAuthenticatedAudience(claims) ||
    claims.is_anonymous === true ||
    !claims.sub
  ) {
    return unauthenticated('The access token cannot authenticate an app user.', false)
  }

  return {
    ok: true,
    auth: {
      actor: {
        user_id: claims.sub,
        role: SUPABASE_AUTHENTICATED_ROLE,
      },
      supabase: createCallerClient(accessToken),
    },
  }
}
