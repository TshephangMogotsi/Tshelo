import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  readValidatedJson,
  successResponse,
} from '@/lib/api/http'
import { validateCreateSupportReportRequest } from '@/lib/api/validation'
import { createApiSupportReport } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)

  const body = await readValidatedJson(request, requestId, validateCreateSupportReportRequest)
  if (!body.ok) return body.response
  const result = await createApiSupportReport(
    authentication.auth.supabase,
    authentication.auth.actor.user_id,
    body.value,
  )
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}
