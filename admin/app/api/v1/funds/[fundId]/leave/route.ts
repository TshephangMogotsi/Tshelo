import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { leaveApiFund } from '@/lib/data/api'

export const runtime = 'nodejs'
type Context = { params: Promise<{ fundId: string }> }

export async function POST(request: Request, { params }: Context) {
  const requestId = createRequestId(); const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const fundId = validateUuidParameter((await params).fundId, 'fundId')
  if (!fundId.ok) return failureResponse('VALIDATION_FAILED', 'fundId must be a valid UUID.', requestId, { retryable: false, field_errors: fundId.fieldErrors })
  const result = await leaveApiFund(authentication.auth.supabase, fundId.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
