import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('version-one read API route boundaries', () => {
  const listRoutes = {
    users: read('admin/app/api/v1/users/route.ts'),
    funds: read('admin/app/api/v1/funds/route.ts'),
    events: read('admin/app/api/v1/events/route.ts'),
    contributions: read('admin/app/api/v1/contributions/route.ts'),
    tickets: read('admin/app/api/v1/admin/support-tickets/route.ts'),
    audit: read('admin/app/api/v1/admin/audit/route.ts'),
  }
  const detailRoutes = {
    users: read('admin/app/api/v1/users/[userId]/route.ts'),
    funds: read('admin/app/api/v1/funds/[fundId]/route.ts'),
    events: read('admin/app/api/v1/events/[eventId]/route.ts'),
    contributions: read('admin/app/api/v1/contributions/[contributionId]/route.ts'),
  }
  const readRoute = read('admin/lib/api/read-route.ts')
  const query = read('admin/lib/api/query.ts')

  it('routes every list resource through its typed parser and data service', () => {
    const expectations = [
      [listRoutes.users, 'parseListUsersQuery', 'listApiUsers'],
      [listRoutes.funds, 'parseListFundsQuery', 'listApiFunds'],
      [listRoutes.events, 'parseListEventsQuery', 'listApiEvents'],
      [listRoutes.contributions, 'parseListContributionsQuery', 'listApiContributions'],
      [listRoutes.tickets, 'parseListSupportTicketsQuery', 'listApiSupportTickets'],
      [listRoutes.audit, 'parseListAdminAuditQuery', 'listApiAdminAudit'],
    ]

    for (const [route, parser, service] of expectations) {
      expect(route).toContain('runApiList(')
      expect(route).toContain(parser)
      expect(route).toContain(service)
      expect(route).toContain("export const runtime = 'nodejs'")
    }
  })

  it('requires platform-admin authorization for global and operational lists', () => {
    expect(listRoutes.users).toContain('{ platformAdminOnly: true }')
    expect(listRoutes.tickets).toContain('{ platformAdminOnly: true }')
    expect(listRoutes.audit).toContain('{ platformAdminOnly: true }')
    expect(readRoute).toContain('authorizePlatformAdminRead(authentication.auth)')
  })

  it('uses asynchronous dynamic params and typed detail data services', () => {
    const expectations = [
      [detailRoutes.users, 'params: Promise<{ userId: string }>', 'getApiUser'],
      [detailRoutes.funds, 'params: Promise<{ fundId: string }>', 'getApiFund'],
      [detailRoutes.events, 'params: Promise<{ eventId: string }>', 'getApiEvent'],
      [detailRoutes.contributions, 'params: Promise<{ contributionId: string }>', 'getApiContribution'],
    ]

    for (const [route, paramsType, service] of expectations) {
      expect(route).toContain(paramsType)
      expect(route).toContain('runApiDetail(')
      expect(route).toContain(service)
    }
    expect(readRoute).toContain('const resolvedParams = await params')
    expect(readRoute).toContain('validateUuidParameter(')
    expect(readRoute).toContain("'NOT_FOUND'")
  })

  it('authenticates before parsing list queries or awaiting path params', () => {
    expect(readRoute.indexOf('authenticateApiRequest(request)')).toBeLessThan(
      readRoute.indexOf('new URL(request.url).searchParams'),
    )
    expect(readRoute.lastIndexOf('authenticateApiRequest(request)')).toBeLessThan(
      readRoute.indexOf('const resolvedParams = await params'),
    )
  })

  it('strictly validates pagination, filters, sorting, dates, and unknown fields', () => {
    expect(query).toContain('unknown_query_parameter')
    expect(query).toContain('duplicate_parameter')
    expect(query).toContain('Number(limit) > 100')
    expect(query).toContain('invalid_sort_direction')
    expect(query).toContain('invalid_date_range')
    expect(query).toContain('invalid_uuid')
    for (const parser of [
      'parseListUsersQuery',
      'parseListFundsQuery',
      'parseListEventsQuery',
      'parseListContributionsQuery',
      'parseListSupportTicketsQuery',
      'parseListAdminAuditQuery',
    ]) {
      expect(query).toContain(`export function ${parser}`)
    }
  })

  it('keeps reads caller-scoped and never embeds a service-role credential', () => {
    const layer = `${Object.values(listRoutes).join('\n')}\n${Object.values(detailRoutes).join('\n')}\n${readRoute}`
    expect(readRoute).toContain('authentication.auth.supabase')
    expect(layer).not.toContain('SUPABASE_SECRET_KEY')
    expect(layer).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(layer).not.toContain('createClient(')
  })
})
