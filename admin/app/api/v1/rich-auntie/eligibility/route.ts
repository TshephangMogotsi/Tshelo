import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, successResponse } from '@/lib/api/http'
import { parseRichAuntieEligibilityQuery } from '@/lib/api/query'
import { getApiRichAuntieEligibility } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const query = parseRichAuntieEligibilityQuery(new URL(request.url).searchParams)
  if (!query.ok) return failureResponse('VALIDATION_FAILED', 'Query validation failed.', requestId, { retryable: false, field_errors: query.fieldErrors })
  const result = await getApiRichAuntieEligibility(authentication.auth.supabase, query.value.fund_id, query.value.recipient_user_id)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Eligible fund recipient not found.', requestId)
  return successResponse(result.data, requestId)
}
