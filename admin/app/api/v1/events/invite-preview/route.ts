import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, successResponse } from '@/lib/api/http'
import { previewApiEventInvite } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const code = new URL(request.url).searchParams.get('code')?.trim() ?? ''
  if (code.length < 8 || code.length > 32) return failureResponse('VALIDATION_FAILED', 'code must contain between 8 and 32 characters.', requestId)
  const result = await previewApiEventInvite(authentication.auth.supabase, code)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'No event matches that invite code.', requestId)
  return successResponse(result.data, requestId)
}
