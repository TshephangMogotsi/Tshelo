import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { validateUpdateEventAnnouncementRequest } from '@/lib/api/validation'
import { updateApiEventAnnouncement } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ eventId: string; announcementId: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const values = await params
  const eventId = validateUuidParameter(values.eventId, 'eventId')
  const announcementId = validateUuidParameter(values.announcementId, 'announcementId')
  if (!eventId.ok || !announcementId.ok) return failureResponse('VALIDATION_FAILED', 'Event and announcement IDs must be valid UUIDs.', requestId, { retryable: false })
  const body = await readValidatedJson(request, requestId, validateUpdateEventAnnouncementRequest)
  if (!body.ok) return body.response
  const result = await updateApiEventAnnouncement(authentication.auth.supabase, authentication.auth.actor.user_id, eventId.value, announcementId.value, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Announcement not found.', requestId)
  return successResponse(result.data, requestId)
}
