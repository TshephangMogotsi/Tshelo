import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { validateParseReceiptRequest } from '@/lib/api/validation'
import { parseApiReceipt } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateParseReceiptRequest)
  if (!body.ok) return body.response
  const result = await parseApiReceipt(authentication.auth.supabase, authentication.auth.actor.user_id, body.value.fund_id, body.value.object_path)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
