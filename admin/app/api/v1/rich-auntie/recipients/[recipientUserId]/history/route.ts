import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { getApiRichAuntieRecipientHistory } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ recipientUserId: string }> }) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const recipientId = validateUuidParameter((await params).recipientUserId, 'recipientUserId')
  if (!recipientId.ok) return failureResponse('VALIDATION_FAILED', 'recipientUserId must be a valid UUID.', requestId, { retryable: false, field_errors: recipientId.fieldErrors })
  const result = await getApiRichAuntieRecipientHistory(authentication.auth.supabase, recipientId.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Recipient history not found.', requestId)
  return successResponse(result.data, requestId)
}
