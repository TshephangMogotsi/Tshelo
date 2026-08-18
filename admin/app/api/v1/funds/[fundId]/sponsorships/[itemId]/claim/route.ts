import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { claimApiFundSponsorship } from '@/lib/data/api'

export const runtime = 'nodejs'
type Context = { params: Promise<{ fundId: string; itemId: string }> }
export async function POST(request: Request, { params }: Context) {
  const requestId = createRequestId(); const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const values = await params; const fundId = validateUuidParameter(values.fundId, 'fundId'); const itemId = validateUuidParameter(values.itemId, 'itemId')
  if (!fundId.ok || !itemId.ok) return failureResponse('VALIDATION_FAILED', 'Fund and sponsorship IDs must be valid UUIDs.', requestId)
  const result = await claimApiFundSponsorship(authentication.auth.supabase, fundId.value, itemId.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Sponsorship item not found.', requestId)
  return successResponse(result.data, requestId)
}
