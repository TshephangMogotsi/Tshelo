import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  databaseErrorResponse,
  errorResponse,
  readValidatedJson,
  successResponse,
} from '@/lib/api/http'
import { validateCreateEventRequest } from '@/lib/api/validation'
import { parseListEventsQuery } from '@/lib/api/query'
import { runApiList } from '@/lib/api/read-route'
import { createApiEvent, listApiEvents } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return runApiList(request, parseListEventsQuery, listApiEvents)
}

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) {
    return errorResponse(authentication.error, requestId, authentication.status)
  }

  const body = await readValidatedJson(request, requestId, validateCreateEventRequest)
  if (!body.ok) return body.response

  const result = await createApiEvent(authentication.auth.supabase, body.value)
  if (result.error) return databaseErrorResponse(result.error, requestId)

  return successResponse(result.data, requestId, 201)
}
