import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('version-one API route boundaries', () => {
  const routes = {
    events: read('admin/app/api/v1/events/route.ts'),
    funds: read('admin/app/api/v1/funds/route.ts'),
    tickets: read('admin/app/api/v1/admin/support-tickets/route.ts'),
    users: read('admin/app/api/v1/admin/users/moderate/route.ts'),
    adminFunds: read('admin/app/api/v1/admin/funds/moderate/route.ts'),
    admins: read('admin/app/api/v1/admin/platform-admins/route.ts'),
  }
  const http = read('admin/lib/api/http.ts')
  const mutations = read('admin/lib/data/api-mutations.ts')
  const validation = read('admin/lib/api/validation.ts')

  it('authenticates every route before reading or mutating request data', () => {
    for (const route of Object.values(routes)) {
      expect(route).toContain('authenticateApiRequest(request)')
      expect(route.indexOf('authenticateApiRequest(request)')).toBeLessThan(
        route.indexOf('readValidatedJson(request'),
      )
      expect(route).toContain("export const runtime = 'nodejs'")
    }
  })

  it('routes event and fund creation through typed data services', () => {
    expect(routes.events).toContain('validateCreateEventRequest')
    expect(routes.events).toContain('createApiEvent(authentication.auth.supabase')
    expect(routes.funds).toContain('validateCreateFundRequest')
    expect(routes.funds).toContain('authentication.auth.actor.user_id')
    expect(mutations).toContain("client.rpc('create_standalone_event'")
    expect(mutations).toContain("client.rpc('create_fund_for_existing_event'")
    expect(mutations).toContain('owner_id: actorUserId')
  })

  it('uses the exact platform operation guard and atomic RPC for each admin endpoint', () => {
    const expectations = [
      [routes.tickets, "'support.update'", 'updateApiSupportTicket'],
      [routes.users, "'users.moderate'", 'moderateApiUser'],
      [routes.adminFunds, "'funds.moderate'", 'moderateApiFund'],
      [routes.admins, "'platform_admins.manage'", 'upsertApiPlatformAdmin'],
    ]

    for (const [route, operation, service] of expectations) {
      expect(route).toContain('withPlatformAdminOperation(')
      expect(route).toContain(operation)
      expect(route).toContain(service)
    }
    expect(mutations).toContain("client.rpc('platform_admin_update_support_ticket'")
    expect(mutations).toContain("client.rpc('platform_admin_moderate_user'")
    expect(mutations).toContain("client.rpc('platform_admin_moderate_fund'")
    expect(mutations).toContain("client.rpc('platform_admin_upsert'")
  })

  it('returns the standard envelope without exposing raw database errors', () => {
    expect(http).toContain('request_id: requestId')
    expect(http).toContain("'X-Request-Id': requestId")
    expect(http).toContain("'Cache-Control': 'no-store'")
    expect(http).toContain('MAX_JSON_BODY_BYTES = 128 * 1024')
    expect(http).toContain("'42501': { code: 'FORBIDDEN'")
    expect(http).toContain("P0002: { code: 'NOT_FOUND'")
    expect(http).not.toContain('error.message')
    expect(http).not.toContain('error.details')
    expect(http).not.toContain('error.hint')
  })

  it('validates closed enums, decimal-string money, UUIDs, and E.164 phones', () => {
    expect(validation).toContain('SUPPORT_TICKET_STATUSES.includes')
    expect(validation).toContain('USER_MODERATION_ACTIONS.includes')
    expect(validation).toContain('FUND_MODERATION_ACTIONS.includes')
    expect(validation).toContain('PLATFORM_ADMIN_ROLES.includes')
    expect(validation).toContain('MONEY_PATTERN')
    expect(validation).toContain('UUID_PATTERN')
    expect(validation).toContain('PHONE_PATTERN')
    expect(validation).toContain('An eventFund must identify its existing event.')
  })

  it('does not read or embed a service-role credential in the route layer', () => {
    const apiLayer = `${Object.values(routes).join('\n')}\n${http}\n${mutations}`
    expect(apiLayer).not.toContain('SUPABASE_SECRET_KEY')
    expect(apiLayer).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(apiLayer).not.toContain('service_role')
  })
})
