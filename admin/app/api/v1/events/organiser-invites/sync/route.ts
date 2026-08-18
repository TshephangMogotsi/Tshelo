import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  successResponse,
} from '@/lib/api/http'
import { syncApiOrganiserInvites } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const result = await syncApiOrganiserInvites(authentication.auth.supabase)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
