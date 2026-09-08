import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, successResponse } from '@/lib/api/http'
import { removeApiEventFile } from '@/lib/data/api'

export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ eventId: string; fileId: string }> }

export async function DELETE(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const { eventId, fileId } = await params
  const result = await removeApiEventFile(authentication.auth.supabase, eventId, fileId)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
