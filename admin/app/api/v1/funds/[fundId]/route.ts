import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { runApiDetail } from '@/lib/api/read-route'
import { validateUuidParameter } from '@/lib/api/query'
import { validateUpdateFundRequest } from '@/lib/api/validation'
import { deleteApiFund, getApiFund, updateApiFund } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ fundId: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  return runApiDetail(
    request,
    params,
    'fundId',
    ({ client, actorUserId, resourceId }) => getApiFund(client, actorUserId, resourceId),
    { notFoundMessage: 'Fund not found.' },
  )
}

async function authenticatedFund(request: Request, params: RouteContext['params']) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return { ok: false as const, response: errorResponse(authentication.error, requestId, authentication.status) }
  const fundId = validateUuidParameter((await params).fundId, 'fundId')
  if (!fundId.ok) return { ok: false as const, response: failureResponse('VALIDATION_FAILED', 'fundId must be a valid UUID.', requestId, { retryable: false, field_errors: fundId.fieldErrors }) }
  return { ok: true as const, requestId, client: authentication.auth.supabase, fundId: fundId.value }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const context = await authenticatedFund(request, params)
  if (!context.ok) return context.response
  const body = await readValidatedJson(request, context.requestId, validateUpdateFundRequest)
  if (!body.ok) return body.response
  const result = await updateApiFund(context.client, context.fundId, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, context.requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Fund not found.', context.requestId)
  return successResponse(result.data, context.requestId)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const context = await authenticatedFund(request, params)
  if (!context.ok) return context.response
  const result = await deleteApiFund(context.client, context.fundId)
  if (result.error) return dataServiceErrorResponse(result.error, context.requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Fund not found.', context.requestId)
  return successResponse(result.data, context.requestId)
}
