import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { listApiPledgeBalances } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ fundId: string }> }) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const id = validateUuidParameter((await params).fundId, 'fundId')
  if (!id.ok) return failureResponse('VALIDATION_FAILED', 'fundId must be a valid UUID.', requestId, { retryable: false, field_errors: id.fieldErrors })
  const contributorId = new URL(request.url).searchParams.get('contributor_id') ?? undefined
  if (contributorId && !validateUuidParameter(contributorId, 'contributor_id').ok) return failureResponse('VALIDATION_FAILED', 'contributor_id must be a valid UUID.', requestId)
  const result = await listApiPledgeBalances(authentication.auth.supabase, id.value, contributorId)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
