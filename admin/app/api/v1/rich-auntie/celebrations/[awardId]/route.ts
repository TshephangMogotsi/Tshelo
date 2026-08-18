import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { getApiRichAuntieCelebration } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ awardId: string }> }) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const awardId = validateUuidParameter((await params).awardId, 'awardId')
  if (!awardId.ok) return failureResponse('VALIDATION_FAILED', 'awardId must be a valid UUID.', requestId, { retryable: false, field_errors: awardId.fieldErrors })
  const result = await getApiRichAuntieCelebration(authentication.auth.supabase, authentication.auth.actor.user_id, awardId.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Rich Auntie award not found.', requestId)
  return successResponse(result.data, requestId)
}
