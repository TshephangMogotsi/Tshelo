import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { listApiFundActivity } from '@/lib/data/api'

export const runtime = 'nodejs'
type Context = { params: Promise<{ fundId: string }> }
export async function GET(request: Request, { params }: Context) {
  const requestId = createRequestId(); const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const fundId = validateUuidParameter((await params).fundId, 'fundId'); if (!fundId.ok) return failureResponse('VALIDATION_FAILED', 'fundId must be a valid UUID.', requestId)
  const search = new URL(request.url).searchParams; const limitValue = search.get('limit'); const limit = limitValue ? Number(limitValue) : undefined
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)) return failureResponse('VALIDATION_FAILED', 'limit must be between 1 and 100.', requestId)
  const result = await listApiFundActivity(authentication.auth.supabase, fundId.value, { cursor: search.get('cursor') ?? undefined, limit, entity_type: search.get('entity_type') ?? undefined, edits_only: search.get('edits_only') === 'true' || undefined })
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
