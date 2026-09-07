import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, readValidatedJson, successResponse, validationErrorResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { validateRespondEventRsvpRequest } from '@/lib/api/validation'
import { getApiMyEventRsvp, respondApiEventRsvp } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ eventId: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const values = await params
  const eventId = validateUuidParameter(values.eventId, 'eventId')
  if (!eventId.ok) return validationErrorResponse(eventId.fieldErrors, requestId)
  const result = await getApiMyEventRsvp(authentication.auth.supabase, authentication.auth.actor.user_id, eventId.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}

export async function PUT(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateRespondEventRsvpRequest)
  if (!body.ok) return body.response
  const values = await params
  const eventId = validateUuidParameter(values.eventId, 'eventId')
  if (!eventId.ok) return validationErrorResponse(eventId.fieldErrors, requestId)
  const result = await respondApiEventRsvp(authentication.auth.supabase, eventId.value, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
