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
      home: '/api/v1/home/summary',
      events: '/api/v1/events',
      notifications: '/api/v1/notifications',
      rewards: '/api/v1/rewards/progress',
      contributions: '/api/v1/contributions',
      expenses: '/api/v1/expenses',
      receipts: '/api/v1/receipts/upload-session',
      rich_auntie: '/api/v1/rich-auntie/status',
      platform_admin: '/api/v1/admin',
    },
  }, createRequestId())
}
