import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { validateEventAnnouncementAttachmentAccessRequest } from '@/lib/api/validation'
import { createApiEventAnnouncementAttachmentAccess, deleteApiEventAnnouncementUpload } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ eventId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateEventAnnouncementAttachmentAccessRequest)
  if (!body.ok) return body.response
  const { eventId } = await params
  const result = await createApiEventAnnouncementAttachmentAccess(
    authentication.auth.supabase,
    eventId,
    body.value,
  )
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId, 201)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateEventAnnouncementAttachmentAccessRequest)
  if (!body.ok) return body.response
  const { eventId } = await params
  const result = await deleteApiEventAnnouncementUpload(
    authentication.auth.supabase,
    authentication.auth.actor.user_id,
    eventId,
    body.value,
  )
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
