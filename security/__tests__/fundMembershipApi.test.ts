import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('fund and membership API slice', () => {
  const contracts = read('shared/contracts/funds.ts')
  const client = read('shared/api-client/client.ts')
  const data = read('admin/lib/data/api-funds.ts')

  it('publishes the fund workspace, membership, permission, sponsorship, activity, and home contracts', () => {
    for (const contract of [
      'FundInvitePreview', 'FundMemberDetails', 'FundAdminPermissionRow',
      'FundSponsorshipItem', 'FundWorkspace', 'FundActivityDetail', 'HomeSummary',
    ]) expect(contracts).toContain(`type ${contract}`)
    expect(contracts).toContain('FUND_PERMISSION_KEYS')
  })

  it('exposes every requested operation through the shared typed client', () => {
    for (const method of [
      'previewInvite(', 'join(', 'leave(', 'workspace(', 'listMembers(', 'getMember(',
      'updateMember(', 'permissions(', 'listAdminPermissions(', 'configureAdmin(',
      'removeAdmin(', 'listSponsorships(', 'createSponsorship(', 'updateSponsorship(',
      'claimSponsorship(', 'releaseSponsorship(', 'activity(', 'activityDetail(', 'summary(',
    ]) expect(client).toContain(method)
    expect(client).toContain("method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'")
  })

  it('delegates state transitions to hardened database RPCs with caller-scoped clients', () => {
    for (const rpc of [
      'join_fund_by_code', 'leave_fund', 'get_my_fund_permissions',
      'get_fund_admin_permissions', 'configure_fund_admin', 'remove_fund_admin',
      'claim_sponsorship_item', 'release_sponsorship_item',
    ]) expect(data).toContain(`'${rpc}'`)
    expect(data).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(data).not.toContain('createClient(')
  })

  it('provides all nested route handlers and a purpose-built home summary', () => {
    const routes = [
      'admin/app/api/v1/funds/invite-preview/route.ts',
      'admin/app/api/v1/funds/join/route.ts',
      'admin/app/api/v1/funds/[fundId]/leave/route.ts',
      'admin/app/api/v1/funds/[fundId]/workspace/route.ts',
      'admin/app/api/v1/funds/[fundId]/members/route.ts',
      'admin/app/api/v1/funds/[fundId]/members/[memberId]/route.ts',
      'admin/app/api/v1/funds/[fundId]/members/[memberId]/admin/route.ts',
      'admin/app/api/v1/funds/[fundId]/permissions/route.ts',
      'admin/app/api/v1/funds/[fundId]/admin-permissions/route.ts',
      'admin/app/api/v1/funds/[fundId]/sponsorships/route.ts',
      'admin/app/api/v1/funds/[fundId]/sponsorships/[itemId]/route.ts',
      'admin/app/api/v1/funds/[fundId]/sponsorships/[itemId]/claim/route.ts',
      'admin/app/api/v1/funds/[fundId]/sponsorships/[itemId]/release/route.ts',
      'admin/app/api/v1/funds/[fundId]/activity/route.ts',
      'admin/app/api/v1/funds/[fundId]/activity/[entryId]/route.ts',
      'admin/app/api/v1/home/summary/route.ts',
    ]
    routes.forEach(route => expect(fs.existsSync(path.join(root, route))).toBe(true))
    expect(read('screens/main/home/loadHomeItems.ts')).toContain('api.home.summary')
  })

  it('keeps the website fund flow behind the typed API boundary', () => {
    const websiteFiles = [
      'admin/components/account-funds/fund-list.tsx',
      'admin/components/account-funds/create-fund-form.tsx',
      'admin/components/account-funds/join-fund-form.tsx',
      'admin/components/account-funds/fund-workspace.tsx',
    ]

    for (const file of websiteFiles) {
      const source = read(file)
      expect({ file, importsBrowserApi: source.includes("from '@/lib/api-client'") }).toEqual({
        file,
        importsBrowserApi: true,
      })
      expect({ file, importsSupabase: /from\s+['"][^'"]*supabase['"]/.test(source) }).toEqual({
        file,
        importsSupabase: false,
      })
      expect({ file, callsSupabaseData: /\bsupabase\s*\.\s*(?:from|rpc|functions|storage)\b/.test(source) }).toEqual({
        file,
        callsSupabaseData: false,
      })
    }
  })
})
