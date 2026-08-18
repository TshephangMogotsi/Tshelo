import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { listApiFundContributors } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ fundId: string }> }) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const id = validateUuidParameter((await params).fundId, 'fundId')
  if (!id.ok) return failureResponse('VALIDATION_FAILED', 'fundId must be a valid UUID.', requestId, { retryable: false, field_errors: id.fieldErrors })
  const result = await listApiFundContributors(authentication.auth.supabase, id.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
