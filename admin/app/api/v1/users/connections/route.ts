import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  successResponse,
  validationErrorResponse,
} from '@/lib/api/http'
import { parseConnectionSearchQuery } from '@/lib/api/query'
import { searchApiConnections } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)

  const query = parseConnectionSearchQuery(new URL(request.url).searchParams)
  if (!query.ok) return validationErrorResponse(query.fieldErrors, requestId)
  const result = await searchApiConnections(authentication.auth.supabase, query.value.q)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
