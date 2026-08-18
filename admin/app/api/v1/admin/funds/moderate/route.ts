import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  databaseErrorResponse,
  errorResponse,
  readValidatedJson,
  successResponse,
} from '@/lib/api/http'
import { withPlatformAdminOperation } from '@/lib/api/platform-admin'
import { validateModerateFundRequest } from '@/lib/api/validation'
import { moderateApiFund } from '@/lib/data/api-mutations'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) {
    return errorResponse(authentication.error, requestId, authentication.status)
  }

  const body = await readValidatedJson(request, requestId, validateModerateFundRequest)
  if (!body.ok) return body.response

  const authorized = await withPlatformAdminOperation(
    authentication.auth,
    'funds.moderate',
    ({ supabase }) => moderateApiFund(supabase, body.value),
  )
  if (!authorized.ok) {
    return errorResponse(authorized.error, requestId, authorized.status)
  }
  if (authorized.data.error) {
    return databaseErrorResponse(authorized.data.error, requestId)
  }

  return successResponse(authorized.data.data, requestId)
}
