import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { validateUpdateFundSponsorshipRequest } from '@/lib/api/validation'
import { updateApiFundSponsorship } from '@/lib/data/api'

export const runtime = 'nodejs'
type Context = { params: Promise<{ fundId: string; itemId: string }> }
export async function PATCH(request: Request, { params }: Context) {
  const requestId = createRequestId(); const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const values = await params; const fundId = validateUuidParameter(values.fundId, 'fundId'); const itemId = validateUuidParameter(values.itemId, 'itemId')
  if (!fundId.ok || !itemId.ok) return failureResponse('VALIDATION_FAILED', 'Fund and sponsorship IDs must be valid UUIDs.', requestId)
  const body = await readValidatedJson(request, requestId, validateUpdateFundSponsorshipRequest); if (!body.ok) return body.response
  const result = await updateApiFundSponsorship(authentication.auth.supabase, fundId.value, itemId.value, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Sponsorship item not found.', requestId)
  return successResponse(result.data, requestId)
}
