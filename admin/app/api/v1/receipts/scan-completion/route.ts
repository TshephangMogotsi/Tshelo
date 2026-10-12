import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { validateCompleteReceiptScanRequest } from '@/lib/api/validation'
import { completeApiReceiptScan } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateCompleteReceiptScanRequest)
  if (!body.ok) return body.response
  const result = await completeApiReceiptScan(authentication.auth.supabase, body.value.audit_id, body.value.user_edits)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
