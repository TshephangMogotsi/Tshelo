import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  successResponse,
} from '@/lib/api/http'
import { getApiRewardProgress } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const result = await getApiRewardProgress(
    authentication.auth.supabase,
    authentication.auth.actor.user_id,
  )
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
