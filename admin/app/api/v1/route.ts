import { createRequestId, successResponse } from '@/lib/api/http'

export const runtime = 'nodejs'

export async function GET() {
  return successResponse({
    name: 'Tshelo API',
    version: 'v1',
    status: 'available',
    documentation: '/api/docs',
    openapi: '/api/openapi',
    authentication: 'Supabase access token sent as Authorization: Bearer <token>',
    resources: {
      users: '/api/v1/users',
      funds: '/api/v1/funds',
      events: '/api/v1/events',
      contributions: '/api/v1/contributions',
      platform_admin: '/api/v1/admin',
    },
  }, createRequestId())
}
