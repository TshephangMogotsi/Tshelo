import { parseListContributionsQuery } from '@/lib/api/query'
import { runApiList } from '@/lib/api/read-route'
import { listApiContributions } from '@/lib/data/api'
import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, readValidatedJson, successResponse } from '@/lib/api/http'
import { validateCreateContributionRequest } from '@/lib/api/validation'
import { createApiContribution } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return runApiList(request, parseListContributionsQuery, listApiContributions)
}

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateCreateContributionRequest)
  if (!body.ok) return body.response
  const result = await createApiContribution(authentication.auth.supabase, authentication.auth.actor.user_id, body.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId, 201)
}
