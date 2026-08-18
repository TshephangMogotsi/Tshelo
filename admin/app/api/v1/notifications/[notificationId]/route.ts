import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  failureResponse,
  successResponse,
  validationErrorResponse,
} from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { getApiNotification } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ notificationId: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)

  const { notificationId } = await params
  const validated = validateUuidParameter(notificationId, 'notification_id')
  if (!validated.ok) return validationErrorResponse(validated.fieldErrors, requestId)
  const result = await getApiNotification(
    authentication.auth.supabase,
    authentication.auth.actor.user_id,
    validated.value,
  )
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Notification not found.', requestId)
  return successResponse(result.data, requestId)
}
