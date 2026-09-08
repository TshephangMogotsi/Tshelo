import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, successResponse } from '@/lib/api/http'
import { createApiEventFileAccess } from '@/lib/data/api'

export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ eventId: string; fileId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const { eventId, fileId } = await params
  const result = await createApiEventFileAccess(authentication.auth.supabase, eventId, fileId)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId, 201)
}
