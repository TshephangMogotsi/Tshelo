import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  readValidatedJson,
  successResponse,
  validationErrorResponse,
} from '@/lib/api/http'
import { parseListNotificationsQuery } from '@/lib/api/query'
import { validateMarkNotificationsReadRequest } from '@/lib/api/validation'
import { listApiNotifications, markApiNotificationsRead } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)

  const query = parseListNotificationsQuery(new URL(request.url).searchParams)
  if (!query.ok) return validationErrorResponse(query.fieldErrors, requestId)
  const result = await listApiNotifications(
    authentication.auth.supabase,
    authentication.auth.actor.user_id,
    query.value,
  )
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}

export async function PATCH(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)

  const body = await readValidatedJson(request, requestId, validateMarkNotificationsReadRequest)
  if (!body.ok) return body.response
  const result = await markApiNotificationsRead(
    authentication.auth.supabase,
    authentication.auth.actor.user_id,
    body.value.notification_ids,
  )
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
