import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  failureResponse,
  readValidatedJson,
  successResponse,
} from '@/lib/api/http'
import { validateUpdateEventRequest } from '@/lib/api/validation'
import { runApiDetail } from '@/lib/api/read-route'
import { deleteApiEvent, getApiEvent, updateApiEvent } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ eventId: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  return runApiDetail(
    request,
    params,
    'eventId',
    ({ client, resourceId }) => getApiEvent(client, resourceId),
    { notFoundMessage: 'Event not found.' },
  )
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateUpdateEventRequest)
  if (!body.ok) return body.response
  const { eventId } = await params
  const result = await updateApiEvent(authentication.auth.supabase, eventId, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Event not found.', requestId)
  return successResponse(result.data, requestId)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const { eventId } = await params
  const result = await deleteApiEvent(authentication.auth.supabase, eventId)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse({}, requestId)
}
