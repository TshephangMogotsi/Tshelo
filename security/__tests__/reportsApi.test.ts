import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('reports and exports API slice', () => {
  const migration = read('supabase/migrations/20260818120000_fund_report_snapshot_and_exports.sql')
  const reportRoute = read('admin/app/api/v1/funds/[fundId]/report/route.ts')
  const exportRoute = read('admin/app/api/v1/funds/[fundId]/exports/route.ts')
  const data = read('admin/lib/data/api-reports.ts')
  const contracts = read('shared/contracts/reports.ts')
  const client = read('shared/api-client/client.ts')
  const screen = read('screens/main/ReportsScreen.tsx')

  it('publishes a stable typed report snapshot and export-accounting contract', () => {
    expect(contracts).toContain('type FundReportBundle')
    expect(contracts).toContain('history_snapshot_at: IsoDateTime')
    expect(contracts).toContain('audit_history: FundReportAuditEntry[]')
    expect(contracts).toContain('contribution_edits:')
    expect(contracts).toContain('expense_edits:')
    expect(contracts).toContain("FUND_EXPORT_TYPES = ['pdf', 'csv', 'share']")
  })

  it('assembles report data and complete history in one caller-scoped database statement', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.get_fund_report_bundle')
    expect(migration).toContain('LANGUAGE sql')
    expect(migration).toContain('SECURITY INVOKER')
    expect(migration).toContain("'history_snapshot_at', statement_timestamp()")
    for (const history of ['audit_history', 'contribution_edits', 'expense_edits', 'export_history']) {
      expect(migration).toContain(`'${history}'`)
    }
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.get_fund_report_bundle(uuid) TO authenticated')
  })

  it('derives export identity and permission from the caller in the database', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.log_fund_export')
    expect(migration).toContain("p_export_type NOT IN ('pdf', 'csv', 'share')")
    expect(migration).toContain("public.has_fund_permission(p_fund_id, 'export_reports')")
    expect(migration).toContain('p_fund_id, auth.uid(), p_export_type, true, 0')
    expect(data).toContain("client.rpc('log_fund_export'")
    expect(data).not.toContain('service_role')
    expect(data).not.toContain('createClient(')
  })

  it('keeps routes thin, authenticated, and available through the typed client', () => {
    expect(reportRoute).toContain('runApiDetail(')
    expect(reportRoute).toContain('getApiFundReport')
    expect(exportRoute.indexOf('authenticateApiRequest(request)')).toBeLessThan(exportRoute.indexOf('await params'))
    expect(exportRoute.indexOf('authenticateApiRequest(request)')).toBeLessThan(exportRoute.indexOf('readValidatedJson(request'))
    expect(exportRoute).toContain('validateCreateFundExportRequest')
    expect(client).toContain('report(fundId: string')
    expect(client).toContain('createExport(fundId: string')
  })

  it('sources screen report data and export logging through the API while rendering locally', () => {
    expect(screen).toContain('api.funds.report(')
    expect(screen).toContain('api.funds.createExport(')
    expect(screen).toContain('buildFundReportHtml({')
    expect(screen).toContain('Print.printToFileAsync({ html })')
    expect(screen).not.toMatch(/\bsupabase\s*\.\s*(?:from|rpc|functions|storage)\b/)
    expect(screen).not.toContain("lib/supabase")
  })
})
