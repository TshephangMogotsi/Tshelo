import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { runApiDetail } from '@/lib/api/read-route'
import { validateUuidParameter } from '@/lib/api/query'
import { validateCreateFundSponsorshipRequest } from '@/lib/api/validation'
import { createApiFundSponsorship, listApiFundSponsorships } from '@/lib/data/api'

export const runtime = 'nodejs'
type Context = { params: Promise<{ fundId: string }> }
export async function GET(request: Request, { params }: Context) {
  return runApiDetail(request, params, 'fundId', ({ client, resourceId }) => listApiFundSponsorships(client, resourceId), { notFoundMessage: 'Fund not found.' })
}
export async function POST(request: Request, { params }: Context) {
  const requestId = createRequestId(); const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const fundId = validateUuidParameter((await params).fundId, 'fundId')
  if (!fundId.ok) return failureResponse('VALIDATION_FAILED', 'fundId must be a valid UUID.', requestId)
  const body = await readValidatedJson(request, requestId, validateCreateFundSponsorshipRequest); if (!body.ok) return body.response
  const result = await createApiFundSponsorship(authentication.auth.supabase, authentication.auth.actor.user_id, fundId.value, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId, 201)
}
