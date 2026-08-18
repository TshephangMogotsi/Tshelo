import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { getApiFundActivityDetail } from '@/lib/data/api'

export const runtime = 'nodejs'
type Context = { params: Promise<{ fundId: string; entryId: string }> }
export async function GET(request: Request, { params }: Context) {
  const requestId = createRequestId(); const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const values = await params; const fundId = validateUuidParameter(values.fundId, 'fundId'); const entryId = validateUuidParameter(values.entryId, 'entryId')
  if (!fundId.ok || !entryId.ok) return failureResponse('VALIDATION_FAILED', 'Fund and activity IDs must be valid UUIDs.', requestId)
  const result = await getApiFundActivityDetail(authentication.auth.supabase, fundId.value, entryId.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Activity entry not found.', requestId)
  return successResponse(result.data, requestId)
}
