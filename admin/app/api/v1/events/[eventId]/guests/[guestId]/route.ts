import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, readValidatedJson, successResponse, validationErrorResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { validateUpdateEventGuestRequest } from '@/lib/api/validation'
import { getApiEventGuest, removeApiEventGuest, updateApiEventGuest } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ eventId: string; guestId: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const ids = await resolveIds(params)
  if (!ids.ok) return validationErrorResponse(ids.fieldErrors, requestId)
  const result = await getApiEventGuest(authentication.auth.supabase, ids.eventId, ids.guestId)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Event guest not found.', requestId, { retryable: false })
  return successResponse(result.data, requestId)
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateUpdateEventGuestRequest)
  if (!body.ok) return body.response
  const ids = await resolveIds(params)
  if (!ids.ok) return validationErrorResponse(ids.fieldErrors, requestId)
  const result = await updateApiEventGuest(authentication.auth.supabase, ids.eventId, ids.guestId, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Event guest not found.', requestId, { retryable: false })
  return successResponse(result.data, requestId)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const ids = await resolveIds(params)
  if (!ids.ok) return validationErrorResponse(ids.fieldErrors, requestId)
  const result = await removeApiEventGuest(authentication.auth.supabase, ids.eventId, ids.guestId)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}

async function resolveIds(params: RouteContext['params']) {
  const values = await params
  const eventId = validateUuidParameter(values.eventId, 'eventId')
  const guestId = validateUuidParameter(values.guestId, 'guestId')
  return eventId.ok && guestId.ok
    ? { ok: true as const, eventId: eventId.value, guestId: guestId.value }
    : { ok: false as const, fieldErrors: [...(!eventId.ok ? eventId.fieldErrors : []), ...(!guestId.ok ? guestId.fieldErrors : [])] }
}
