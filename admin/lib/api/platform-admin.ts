import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  canPlatformAdminPerform,
  isPlatformAdminRole,
  type PlatformAdminOperation,
  type PlatformAdminRole,
} from '@shared/contracts/admin'
import type { ApiError } from '@shared/contracts/common'
import type { ApiAuthContext } from './auth'

type AuthorizedPlatformAdmin = {
  userId: string
  role: PlatformAdminRole
}

type PrivilegedOperationContext = {
  actor: AuthorizedPlatformAdmin
  operation: PlatformAdminOperation
  /**
   * Caller-scoped client. Purpose-specific SECURITY DEFINER RPCs perform the
   * narrow mutation while retaining the verified actor in auth.uid().
   */
  supabase: SupabaseClient
}

type PlatformAdminOperationFailure = {
  ok: false
  status: 403 | 500
  error: ApiError
}

export type PlatformAdminOperationResult<T> =
  | { ok: true; data: T }
  | PlatformAdminOperationFailure

function failure(
  status: 403 | 500,
  code: 'FORBIDDEN' | 'INTERNAL_ERROR',
  message: string,
): PlatformAdminOperationFailure {
  return {
    ok: false,
    status,
    error: { code, message, retryable: status === 500 },
  }
}

export async function authorizePlatformAdminRead(
  auth: ApiAuthContext,
): Promise<PlatformAdminOperationResult<AuthorizedPlatformAdmin>> {
  // This check deliberately uses the caller-scoped client and mirrors the
  // active allowlist required by the platform read RLS policies.
  const { data, error } = await auth.supabase
    .from('platform_admins')
    .select('role')
    .eq('user_id', auth.actor.user_id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    return failure(500, 'INTERNAL_ERROR', 'Platform authorization could not be checked.')
  }

  if (!data || !isPlatformAdminRole(data.role)) {
    return failure(403, 'FORBIDDEN', 'Platform administrator access is required.')
  }

  return { ok: true, data: { userId: auth.actor.user_id, role: data.role } }
}

/**
 * Verifies the closed application role matrix before invoking a purpose-built
 * database RPC with the caller's JWT. The RPC repeats authorization, locks the
 * target, performs the mutation, and writes the audit entry atomically.
 */
export async function withPlatformAdminOperation<T>(
  auth: ApiAuthContext,
  operation: PlatformAdminOperation,
  execute: (context: PrivilegedOperationContext) => Promise<T>,
): Promise<PlatformAdminOperationResult<T>> {
  const authorization = await authorizePlatformAdminRead(auth)

  if (!authorization.ok) return authorization
  if (!canPlatformAdminPerform(authorization.data.role, operation)) {
    return failure(403, 'FORBIDDEN', 'This platform operation is not permitted.')
  }

  const data = await execute({
    actor: authorization.data,
    operation,
    supabase: auth.supabase,
  })

  return { ok: true, data }
}
