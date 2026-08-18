import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, successResponse } from '@/lib/api/http'
import { previewApiFundInvite } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const code = new URL(request.url).searchParams.get('code')?.trim() ?? ''
  if (!code || code.length > 32) return failureResponse('VALIDATION_FAILED', 'code is required and must not exceed 32 characters.', requestId)
  const result = await previewApiFundInvite(authentication.auth.supabase, authentication.auth.actor.user_id, code)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'No fund matches that invite code.', requestId)
  return successResponse(result.data, requestId)
}
