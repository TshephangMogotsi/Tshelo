import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  successResponse,
} from '@/lib/api/http'
import {
  getApiAccountClosureRequest,
  requestApiAccountClosure,
} from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)

  const result = await getApiAccountClosureRequest(
    authentication.auth.supabase,
    authentication.auth.actor.user_id,
  )
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)

  const result = await requestApiAccountClosure(
    authentication.auth.supabase,
    authentication.auth.actor.user_id,
  )
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
