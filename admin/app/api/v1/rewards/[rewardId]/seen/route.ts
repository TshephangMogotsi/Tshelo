import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  successResponse,
  validationErrorResponse,
} from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { markApiRewardSeen } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ rewardId: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)

  const { rewardId } = await params
  const validated = validateUuidParameter(rewardId, 'reward_id')
  if (!validated.ok) return validationErrorResponse(validated.fieldErrors, requestId)
  const result = await markApiRewardSeen(authentication.auth.supabase, validated.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
