import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { validateUpdateEventBannerRequest } from '@/lib/api/validation'
import { updateApiEventBanner } from '@/lib/data/api'

export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ eventId: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateUpdateEventBannerRequest)
  if (!body.ok) return body.response
  const { eventId } = await params
  const result = await updateApiEventBanner(authentication.auth.supabase, eventId, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
