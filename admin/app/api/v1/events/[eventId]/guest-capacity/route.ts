import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, successResponse, validationErrorResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { getApiEventGuestCapacity, unlockApiEventGuestCapacity } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ eventId: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const eventId = await resolveEventId(params)
  if (!eventId.ok) return validationErrorResponse(eventId.fieldErrors, requestId)
  const result = await getApiEventGuestCapacity(authentication.auth.supabase, eventId.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}

export async function POST(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const eventId = await resolveEventId(params)
  if (!eventId.ok) return validationErrorResponse(eventId.fieldErrors, requestId)
  const result = await unlockApiEventGuestCapacity(authentication.auth.supabase, eventId.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}

async function resolveEventId(params: RouteContext['params']) {
  const values = await params
  return validateUuidParameter(values.eventId, 'eventId')
}
