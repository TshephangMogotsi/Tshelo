import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { validateUpdateExpenseRequest } from '@/lib/api/validation'
import { updateApiExpense } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: Promise<{ expenseId: string }> }) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const id = validateUuidParameter((await params).expenseId, 'expenseId')
  if (!id.ok) return failureResponse('VALIDATION_FAILED', 'expenseId must be a valid UUID.', requestId, { retryable: false, field_errors: id.fieldErrors })
  const body = await readValidatedJson(request, requestId, validateUpdateExpenseRequest)
  if (!body.ok) return body.response
  const result = await updateApiExpense(authentication.auth.supabase, id.value, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Expense not found.', requestId)
  return successResponse(result.data, requestId)
}
