import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('typed API data services', () => {
  const queries = read('admin/lib/data/api-queries.ts')
  const pagination = read('admin/lib/data/api-pagination.ts')
  const records = read('admin/lib/data/api-records.ts')
  const api = read('admin/lib/data/api.ts')

  it('provides typed list services for every initial read resource', () => {
    for (const service of [
      'listApiUsers',
      'listApiFunds',
      'listApiEvents',
      'listApiContributions',
      'listApiSupportTickets',
      'listApiAdminAudit',
    ]) {
      expect(queries).toContain(`export async function ${service}`)
    }
  })

  it('provides typed detail services without exposing raw database rows', () => {
    expect(queries).toContain('export async function getApiUser')
    expect(queries).toContain('export async function getApiFund')
    expect(queries).toContain('export async function getApiEvent')
    expect(queries).toContain('export async function getApiContribution')
    expect(queries).toContain('toUser(data as UserRow)')
    expect(queries).toContain('toFund(fundResult.data as FundRow)')
    expect(queries).toContain('toEvent(eventResult.data as EventRow)')
    expect(queries).toContain('toContribution(data as ContributionRow)')
  })

  it('normalizes every decimal database value into a string contract', () => {
    expect(records).toContain('String(row.goal_amount)')
    expect(records).toContain('String(row.estimated_spend_amount)')
    expect(records).toContain('amount: String(row.amount)')
    expect(records).toContain('String(row.pledged_amount)')
    expect(queries).toContain('moneyToMinorUnits')
    expect(queries).toContain('reduce<bigint>')
    expect(queries).not.toMatch(/reduce<number>[^]*row\.amount/)
  })

  it('uses bounded, query-scoped opaque pagination cursors', () => {
    expect(pagination).toContain('DEFAULT_PAGE_LIMIT')
    expect(pagination).toContain('MAX_PAGE_LIMIT')
    expect(pagination).toContain('MAX_CURSOR_OFFSET = 1_000_000')
    expect(pagination).toContain("createHash('sha256')")
    expect(pagination).toContain("toString('base64url')")
    expect(pagination).toContain('cursor.scope !== scope')
    expect(pagination).toContain('rows.length > window.limit')
    expect(queries).toContain('.range(pageWindow.data.offset, pageWindow.data.offset + pageWindow.data.limit)')
  })

  it('validates sort fields and UUID filters before constructing queries', () => {
    expect(queries).toContain('commonListError')
    expect(queries).toContain("['created_at', 'name', 'trust_score']")
    expect(queries).toContain("['created_at', 'title', 'goal_amount', 'contribution_deadline']")
    expect(queries).toContain("['created_at', 'event_date', 'name']")
    expect(queries).toContain("['created_at', 'confirmed_at', 'amount']")
    expect(queries).toContain('invalidUuidFilter')
  })

  it('keeps all services caller-scoped and server-only', () => {
    const dataLayer = `${queries}\n${pagination}\n${records}\n${api}`
    expect(queries).toContain("import 'server-only'")
    expect(pagination).toContain("import 'server-only'")
    expect(api).toContain("import 'server-only'")
    expect(dataLayer).not.toContain('SUPABASE_SECRET_KEY')
    expect(dataLayer).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(dataLayer).not.toContain('createClient(')
  })
})
