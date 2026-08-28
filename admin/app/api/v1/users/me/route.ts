import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  failureResponse,
  readValidatedJson,
  successResponse,
} from '@/lib/api/http'
import { validateUpdateCurrentUserRequest } from '@/lib/api/validation'
import { getApiCurrentUser, updateApiCurrentUser } from '@/lib/data/api'
import { cacheAppUser, invalidateAppUser } from '@/lib/app-user'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)

  const result = await getApiCurrentUser(
    authentication.auth.supabase,
    authentication.auth.actor.user_id,
  )
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'User profile not found.', requestId)
  if (result.data.status !== 'banned') {
    cacheAppUser({
      id: result.data.id,
      name: result.data.name,
      phone: result.data.phone,
      email: result.data.email,
      preferredCurrency: result.data.preferred_currency,
      notificationsEnabled: result.data.notifications_enabled,
      trustScore: result.data.trust_score,
      trustLevel: result.data.trust_level,
      tokenBalance: result.data.token_balance,
      profileCompleted: result.data.profile_completed,
      createdAt: result.data.created_at,
    })
  }
  return successResponse(result.data, requestId)
}

export async function PATCH(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)

  const body = await readValidatedJson(request, requestId, validateUpdateCurrentUserRequest)
  if (!body.ok) return body.response
  const result = await updateApiCurrentUser(
    authentication.auth.supabase,
    authentication.auth.actor.user_id,
    body.value,
  )
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'User profile not found.', requestId)
  invalidateAppUser(authentication.auth.actor.user_id)
  return successResponse(result.data, requestId)
}
