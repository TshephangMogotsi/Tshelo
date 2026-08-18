import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { validateCreatePledgeAllocationRequest } from '@/lib/api/validation'
import { createApiPledgeAllocation } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateCreatePledgeAllocationRequest)
  if (!body.ok) return body.response
  const result = await createApiPledgeAllocation(authentication.auth.supabase, authentication.auth.actor.user_id, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId, 201)
}
