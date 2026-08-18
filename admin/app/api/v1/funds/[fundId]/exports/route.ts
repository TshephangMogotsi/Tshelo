import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  readValidatedJson,
  successResponse,
  validationErrorResponse,
} from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { validateCreateFundExportRequest } from '@/lib/api/validation'
import { createApiFundExport } from '@/lib/data/api'

export const runtime = 'nodejs'

type Context = { params: Promise<{ fundId: string }> }

export async function POST(request: Request, { params }: Context) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)

  const fundId = validateUuidParameter((await params).fundId, 'fundId')
  if (!fundId.ok) return validationErrorResponse(fundId.fieldErrors, requestId)

  const body = await readValidatedJson(request, requestId, validateCreateFundExportRequest)
  if (!body.ok) return body.response

  const result = await createApiFundExport(authentication.auth.supabase, fundId.value, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId, 201)
}
