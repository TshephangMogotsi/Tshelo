import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  databaseErrorResponse,
  errorResponse,
  readValidatedJson,
  successResponse,
} from '@/lib/api/http'
import { withPlatformAdminOperation } from '@/lib/api/platform-admin'
import { validateUpsertPlatformAdminRequest } from '@/lib/api/validation'
import { upsertApiPlatformAdmin } from '@/lib/data/api-mutations'

export const runtime = 'nodejs'

export async function PUT(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) {
    return errorResponse(authentication.error, requestId, authentication.status)
  }

  const body = await readValidatedJson(request, requestId, validateUpsertPlatformAdminRequest)
  if (!body.ok) return body.response

  const authorized = await withPlatformAdminOperation(
    authentication.auth,
    'platform_admins.manage',
    ({ supabase }) => upsertApiPlatformAdmin(supabase, body.value),
  )
  if (!authorized.ok) {
    return errorResponse(authorized.error, requestId, authorized.status)
  }
  if (authorized.data.error) {
    return databaseErrorResponse(authorized.data.error, requestId)
  }

  return successResponse(authorized.data.data, requestId)
}
