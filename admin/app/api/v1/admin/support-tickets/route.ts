import { authenticateApiRequest } from '@/lib/api/auth'
import {
  createRequestId,
  databaseErrorResponse,
  errorResponse,
  readValidatedJson,
  successResponse,
} from '@/lib/api/http'
import { withPlatformAdminOperation } from '@/lib/api/platform-admin'
import { parseListSupportTicketsQuery } from '@/lib/api/query'
import { runApiList } from '@/lib/api/read-route'
import { validateUpdateSupportTicketRequest } from '@/lib/api/validation'
import { listApiSupportTickets, updateApiSupportTicket } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return runApiList(
    request,
    parseListSupportTicketsQuery,
    listApiSupportTickets,
    { platformAdminOnly: true },
  )
}

export async function PATCH(request: Request) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) {
    return errorResponse(authentication.error, requestId, authentication.status)
  }

  const body = await readValidatedJson(request, requestId, validateUpdateSupportTicketRequest)
  if (!body.ok) return body.response

  const authorized = await withPlatformAdminOperation(
    authentication.auth,
    'support.update',
    ({ supabase }) => updateApiSupportTicket(supabase, body.value),
  )
  if (!authorized.ok) {
    return errorResponse(authorized.error, requestId, authorized.status)
  }
  if (authorized.data.error) {
    return databaseErrorResponse(authorized.data.error, requestId)
  }

  return successResponse(authorized.data.data, requestId)
}
