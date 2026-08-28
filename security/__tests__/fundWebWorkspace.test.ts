import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('member web fund workspace', () => {
  const finances = read('admin/components/account-funds/fund-finances.tsx')
  const operations = read('admin/components/account-funds/fund-operations.tsx')
  const workspace = read('admin/components/account-funds/fund-workspace.tsx')
  const fundList = read('admin/components/account-funds/fund-list.tsx')
  const inviteDialog = read('admin/components/account-funds/invite-members-dialog.tsx')
  const styles = read('admin/app/globals.css')
  const dashboardReference = read('admin/tshelo-dashboard.html')
  const expenseRoute = read('admin/app/api/v1/expenses/[expenseId]/route.ts')

  it('covers manual contribution, pledge, correction, refund, and allocation workflows', () => {
    for (const operation of [
      'contributions.create(', 'contributions.update(', 'contributions.refund(',
      'createPledgeAllocation(', 'createSponsorshipAllocation(',
    ]) expect(finances).toContain(operation)
    expect(finances).toContain("detected_via: 'manual'")
    expect(finances).not.toContain('assignDetected(')
  })

  it('supports manual and receipt-backed expenses across phone and desktop browsers', () => {
    expect(finances).toContain('capture="environment"')
    expect(finances).toContain('Choose receipt image')
    expect(finances).toContain("canvas.toBlob")
    expect(finances).toContain('receipts.createUploadSession(')
    expect(finances).toContain('receipts.parse(')
    expect(finances).toContain('expenses.create(')
    expect(finances).toContain('expenses.update(')
    expect(finances).toContain('expenses.remove(')
    expect(expenseRoute).toContain('export async function DELETE')
  })

  it('covers member administration, sponsorships, recognition, history, reports, and lifecycle controls', () => {
    for (const operation of [
      'funds.configureAdmin(', 'funds.removeAdmin(', 'richAuntie.createAward(',
      'funds.activity(', 'funds.report(', 'funds.createExport(',
    ]) expect(operations).toContain(operation)
    expect(workspace).toContain('funds.updateSponsorship(')
    expect(workspace).toContain("status: 'cancelled'")
    expect(workspace).toContain('funds.remove(fund.id)')
    expect(workspace).toContain('<FundContributions')
    expect(workspace).toContain('<FundExpenses')
    expect(workspace).toContain('<FundOperations')
    expect(workspace).toContain('role="tablist"')
    expect(workspace).toContain('role="tabpanel"')
    expect(workspace).toContain('hashTab: Record<string, WorkspaceTab>')
    expect(workspace).toContain("params.set('tab', tab)")
    expect(workspace).toContain('aria-label="Breadcrumb"')
    expect(workspace).toContain('aria-current="page"')
  })

  it('uses the dashboard fund-card layout, restrained card treatment, typography, and invite dialog', () => {
    expect(styles).toContain('.tshelo-dashboard .fundgrid { display: grid; grid-template-columns: repeat(auto-fill,minmax(330px,1fr)); gap: 18px; }')
    expect(styles).not.toContain('.tshelo-dashboard .fund:hover { box-shadow: var(--sh-lift); transform: translateY(-2px); }')
    expect(styles).toContain('font-size: 19px; font-weight: 600;')
    expect(styles).toContain('.tshelo-dashboard .track { height: 8px;')
    expect(styles).toContain('.tshelo-dashboard .overlay { position: fixed; inset: 0;')
    expect(styles).toContain('animation: pop .22s cubic-bezier(.2,.9,.3,1)')
    expect(fundList).toContain("'Invite members'")
    expect(fundList).toContain('className="fund"')
    expect(fundList).toContain('role="link" tabIndex={0}')
    expect(fundList).toContain('onClick={handleCardClick}')
    expect(fundList).toContain('className="fundgrid"')
    expect(fundList).toContain('className="fund-list"')
    expect(fundList).toContain('className="fund-list-row"')
    expect(fundList).toContain('onClick={handleRowClick}')
    expect(fundList).toContain('className="actions"')
    expect(fundList).toContain('role="tablist"')
    expect(fundList).toContain('role="tabpanel"')
    expect(fundList).toContain('className="card fund-tab-panel"')
    expect(fundList).toContain('className="fund-panel-heading"')
    expect(fundList).toContain('className="fund-view-toggle"')
    expect(fundList).toContain("params.set('view', 'list')")
    expect(fundList).toContain("viewMode === 'list' ? (")
    expect(fundList).toContain("router.replace(query ? `/account/funds?${query}` : '/account/funds', { scroll: false })")
    expect(styles).toContain('.tshelo-dashboard .fund-tab.active')
    expect(styles).toContain('border-radius: 14px 14px 0 0')
    expect(styles).toContain('.tshelo-dashboard .fund-list-head, .tshelo-dashboard .fund-list-row')
    expect(fundList).toContain('<InviteMembersDialog')
    expect(workspace).toContain('<InviteMembersDialog')
    expect(inviteDialog).toContain('role="dialog"')
    expect(inviteDialog).toContain('className="overlay on"')
    expect(inviteDialog).toContain('WhatsApp')
    expect(inviteDialog).toContain('SMS')
    expect(dashboardReference).toContain('<section class="view" id="v-funds">')
    expect(fs.existsSync(path.join(root, 'tshelo-dashboard.html'))).toBe(false)
  })
})
