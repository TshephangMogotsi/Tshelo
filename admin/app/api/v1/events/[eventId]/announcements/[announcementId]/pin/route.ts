import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { validateSetEventAnnouncementPinRequest } from '@/lib/api/validation'
import { setApiEventAnnouncementPin } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ eventId: string; announcementId: string }> }

export async function PUT(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const values = await params
  const eventId = validateUuidParameter(values.eventId, 'eventId')
  const announcementId = validateUuidParameter(values.announcementId, 'announcementId')
  if (!eventId.ok || !announcementId.ok) {
    return failureResponse('VALIDATION_FAILED', 'Event and announcement IDs must be valid UUIDs.', requestId, { retryable: false })
  }
  const body = await readValidatedJson(request, requestId, validateSetEventAnnouncementPinRequest)
  if (!body.ok) return body.response
  const result = await setApiEventAnnouncementPin(authentication.auth.supabase, eventId.value, announcementId.value, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Announcement not found.', requestId)
  return successResponse(result.data, requestId)
}

