import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  databaseErrorResponse,
  errorResponse,
  readValidatedJson,
  successResponse,
} from '@/lib/api/http'
import { validateCreateFundRequest } from '@/lib/api/validation'
import { parseListFundsQuery } from '@/lib/api/query'
import { runApiList } from '@/lib/api/read-route'
import { createApiFund, listApiFunds } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return runApiList(request, parseListFundsQuery, listApiFunds)
}

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) {
    return errorResponse(authentication.error, requestId, authentication.status)
  }

  const body = await readValidatedJson(request, requestId, validateCreateFundRequest)
  if (!body.ok) return body.response

  const result = await createApiFund(
    authentication.auth.supabase,
    authentication.auth.actor.user_id,
    body.value,
  )
  if (result.error) return databaseErrorResponse(result.error, requestId)

  return successResponse(result.data, requestId, 201)
}
