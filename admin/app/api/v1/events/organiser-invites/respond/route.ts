import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  readValidatedJson,
  successResponse,
} from '@/lib/api/http'
import { validateRespondOrganiserInviteRequest } from '@/lib/api/validation'
import { respondApiOrganiserInvite } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateRespondOrganiserInviteRequest)
  if (!body.ok) return body.response
  const result = await respondApiOrganiserInvite(authentication.auth.supabase, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
