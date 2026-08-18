import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { validateUuidParameter } from '@/lib/api/query'
import { validateConfigureFundAdminRequest } from '@/lib/api/validation'
import { configureApiFundAdmin, removeApiFundAdmin } from '@/lib/data/api'

export const runtime = 'nodejs'
type Context = { params: Promise<{ fundId: string; memberId: string }> }
async function context(request: Request, params: Context['params']) {
  const requestId = createRequestId(); const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return { ok: false as const, response: errorResponse(authentication.error, requestId, authentication.status) }
  const values = await params; const fundId = validateUuidParameter(values.fundId, 'fundId'); const memberId = validateUuidParameter(values.memberId, 'memberId')
  if (!fundId.ok || !memberId.ok) return { ok: false as const, response: failureResponse('VALIDATION_FAILED', 'Fund and member IDs must be valid UUIDs.', requestId) }
  return { ok: true as const, requestId, client: authentication.auth.supabase, fundId: fundId.value, memberId: memberId.value }
}
export async function PUT(request: Request, { params }: Context) {
  const ctx = await context(request, params); if (!ctx.ok) return ctx.response
  const body = await readValidatedJson(request, ctx.requestId, validateConfigureFundAdminRequest); if (!body.ok) return body.response
  const result = await configureApiFundAdmin(ctx.client, ctx.fundId, ctx.memberId, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, ctx.requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Fund member not found.', ctx.requestId)
  return successResponse(result.data, ctx.requestId)
}
export async function DELETE(request: Request, { params }: Context) {
  const ctx = await context(request, params); if (!ctx.ok) return ctx.response
  const result = await removeApiFundAdmin(ctx.client, ctx.fundId, ctx.memberId)
  if (result.error) return dataServiceErrorResponse(result.error, ctx.requestId)
  if (!result.data) return failureResponse('NOT_FOUND', 'Fund member not found.', ctx.requestId)
  return successResponse(result.data, ctx.requestId)
}
