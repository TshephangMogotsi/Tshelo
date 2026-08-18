import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { parseListRichAuntieAwardsQuery } from '@/lib/api/query'
import { validateCreateRichAuntieAwardRequest } from '@/lib/api/validation'
import { createApiRichAuntieAward, listApiRichAuntieAwards } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const query = parseListRichAuntieAwardsQuery(new URL(request.url).searchParams)
  if (!query.ok) return failureResponse('VALIDATION_FAILED', 'Query validation failed.', requestId, { retryable: false, field_errors: query.fieldErrors })
  const result = await listApiRichAuntieAwards(authentication.auth.supabase, query.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateCreateRichAuntieAwardRequest)
  if (!body.ok) return body.response
  const result = await createApiRichAuntieAward(authentication.auth.supabase, authentication.auth.actor.user_id, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId, 201)
}
