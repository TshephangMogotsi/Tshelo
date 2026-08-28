import type { FundReportBundle } from '@shared/contracts'
import { buildFundReportHtml } from '../../screens/main/reports/buildFundReportHtml'

/**
 * The mobile application owns the fund-statement layout. Keeping the web as a
 * small adapter means a PDF printed from either surface carries the same
 * accounting, governance, and audit sections from the same data snapshot.
 */
export function buildFundReportDocumentHtml(report: FundReportBundle) {
  const logoDataUri = typeof window === 'undefined'
    ? undefined
    : `${window.location.origin}/tshelo-icon.png`

  return buildFundReportHtml({
    fund: report.fund,
    contributions: report.contributions,
    expenses: report.expenses,
    members: report.members,
    contributors: report.contributors,
    pledgeBalances: report.pledge_balances,
    linkedEvent: report.linked_event,
    sponsorshipItems: report.sponsorship_items,
    richAuntieAwards: report.rich_auntie_awards,
    memberProfiles: report.member_profiles,
    auditHistory: report.audit_history,
    contributionEdits: report.contribution_edits,
    expenseEdits: report.expense_edits,
    exportHistory: report.export_history,
    logoDataUri,
    generatedAt: report.history_snapshot_at,
  })
}
