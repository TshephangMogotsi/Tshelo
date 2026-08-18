import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('Rich Auntie API slice', () => {
  const data = read('admin/lib/data/api-rich-auntie.ts')
  const validation = read('admin/lib/api/validation.ts')
  const client = read('shared/api-client/client.ts')
  const rules = read('supabase/migrations/20260724120000_rich_auntie_sponsorship_flow.sql')
  const permissions = read('supabase/migrations/20260812160000_enforce_fund_admin_permissions.sql')
  const routes = [
    'admin/app/api/v1/rich-auntie/eligibility/route.ts',
    'admin/app/api/v1/rich-auntie/awards/route.ts',
    'admin/app/api/v1/rich-auntie/recipients/[recipientUserId]/history/route.ts',
    'admin/app/api/v1/rich-auntie/celebrations/[awardId]/route.ts',
    'admin/app/api/v1/rich-auntie/status/route.ts',
  ].map(read)

  it('authenticates before parsing query, body, or dynamic parameters', () => {
    for (const route of routes) {
      const authentication = route.indexOf('authenticateApiRequest(request)')
      expect(authentication).toBeGreaterThan(-1)
      for (const marker of ['readValidatedJson(request', 'new URL(request.url)', 'await params']) {
        const index = route.indexOf(marker)
        if (index >= 0) expect(authentication).toBeLessThan(index)
      }
      expect(route).toContain("export const runtime = 'nodejs'")
    }
  })

  it('keeps actor identity server-owned and reads through caller-scoped clients', () => {
    expect(data).toContain('awarded_by: actorUserId')
    expect(data).toContain("client.rpc('get_my_fund_permissions'")
    expect(data).toContain("client.rpc('get_fund_member_profiles'")
    expect(data).not.toContain('service_role')
    expect(data).not.toContain('createClient(')
  })

  it('retains database-enforced eligibility and notification rules', () => {
    expect(rules).toContain('CREATE OR REPLACE FUNCTION public.validate_rich_auntie_award()')
    expect(rules).toContain("item.status IN ('funded', 'fulfilled')")
    expect(rules).toContain('rich_auntie_awards_item_unique')
    expect(rules).toContain('CREATE OR REPLACE FUNCTION public.notify_rich_auntie_award()')
    expect(permissions).toContain("public.has_fund_permission(fund_id, 'award_recognition')")
  })

  it('validates award UUIDs, closed reason codes, labels, and notification choice', () => {
    expect(validation).toContain('validateCreateRichAuntieAwardRequest')
    expect(validation).toContain('RICH_AUNTIE_REASON_CODES.includes')
    expect(validation).toContain("requireString(value, 'reason_label', errors, 2, 200)")
    expect(validation).toContain("typeof value.notify_member !== 'boolean'")
  })

  it('exposes every Rich Auntie resource through the typed client', () => {
    for (const method of ['eligibility(', 'listAwards(', 'createAward(', 'recipientHistory(', 'celebration(', 'status(']) {
      expect(client).toContain(method)
    }
  })

  it('removes direct Supabase data access from all migrated screens', () => {
    for (const file of [
      'screens/main/AwardRichAuntieScreen.tsx',
      'screens/main/RichAuntieStatusScreen.tsx',
      'screens/main/RichAuntieCelebrationScreen.tsx',
    ]) {
      expect({ file, directData: /\bsupabase\s*\.\s*(?:from|rpc|functions|storage)\b/.test(read(file)) })
        .toEqual({ file, directData: false })
    }
  })
})
