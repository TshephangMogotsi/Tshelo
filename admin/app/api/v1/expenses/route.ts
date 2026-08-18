import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { parseListExpensesQuery } from '@/lib/api/query'
import { validateCreateExpensesRequest } from '@/lib/api/validation'
import { createApiExpenses, listApiExpenses } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const query = parseListExpensesQuery(new URL(request.url).searchParams)
  if (!query.ok) return failureResponse('VALIDATION_FAILED', 'Query validation failed.', requestId, { retryable: false, field_errors: query.fieldErrors })
  const result = await listApiExpenses(authentication.auth.supabase, query.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateCreateExpensesRequest)
  if (!body.ok) return body.response
  const result = await createApiExpenses(authentication.auth.supabase, authentication.auth.actor.user_id, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId, 201)
}
