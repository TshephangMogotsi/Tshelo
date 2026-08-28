import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  databaseErrorResponse,
  errorResponse,
  readValidatedJson,
  successResponse,
} from '@/lib/api/http'
import { withPlatformAdminOperation } from '@/lib/api/platform-admin'
import { validateModerateUserRequest } from '@/lib/api/validation'
import { moderateApiUser } from '@/lib/data/api-mutations'
import { invalidateAppUser } from '@/lib/app-user'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) {
    return errorResponse(authentication.error, requestId, authentication.status)
  }

  const body = await readValidatedJson(request, requestId, validateModerateUserRequest)
  if (!body.ok) return body.response

  const authorized = await withPlatformAdminOperation(
    authentication.auth,
    'users.moderate',
    ({ supabase }) => moderateApiUser(supabase, body.value),
  )
  if (!authorized.ok) {
    return errorResponse(authorized.error, requestId, authorized.status)
  }
  if (authorized.data.error) {
    return databaseErrorResponse(authorized.data.error, requestId)
  }

  invalidateAppUser(body.value.user_id)
  return successResponse(authorized.data.data, requestId)
}
