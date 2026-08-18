import { buildFundReportHtml, FundReportData } from '../buildFundReportHtml'

const fixture: FundReportData = {
  fund: {
    title: 'Family Celebration',
    description: 'A shared family fund.',
    fund_type: 'family_support',
    fund_code: 'TSH-123',
    currency_code: 'BWP',
    goal_amount: 20_000,
    status: 'active',
    created_at: '2026-08-01T00:00:00.000Z',
    contribution_deadline: null,
    is_private: true,
  },
  contributions: [
    {
      id: 'payment-1',
      contributor_id: 'contributor-1',
      contributor_name: 'John David',
      amount: 22_000,
      pledged_amount: null,
      payment_method: 'orange_money',
      reference_number: 'REF-1',
      status: 'confirmed',
      is_refunded: false,
      confirmed_at: '2026-08-10T00:00:00.000Z',
      created_at: '2026-08-10T00:00:00.000Z',
      notes: 'For the tent & chairs',
    },
  ],
  expenses: [
    {
      id: 'expense-1',
      description: 'Venue deposit',
      item_name: null,
      category: 'venue',
      amount: 1_100,
      vendor_name: 'Community Hall',
      receipt_url: 'https://example.com/receipt-1',
      is_sponsored: false,
      sponsored_by_user_id: null,
      sponsored_by_name: null,
      has_open_query: false,
      created_at: '2026-08-11T00:00:00.000Z',
      updated_at: '2026-08-11T00:00:00.000Z',
      deleted_at: null,
    },
  ],
  members: [{ id: 'member-1', user_id: 'user-1', invited_name: 'John David', invited_phone: '71234567', role: 'member', status: 'joined', invited_at: '2026-08-01T00:00:00.000Z', joined_at: '2026-08-02T00:00:00.000Z', created_at: '2026-08-01T00:00:00.000Z' }],
  contributors: [{ id: 'contributor-1', user_id: 'user-1', display_name: 'John David', phone: '71234567', contributor_type: 'member' }],
  pledgeBalances: [],
  linkedEvent: null,
  sponsorshipItems: [{ id: 'item-1', title: 'Tent', target_amount: 5_000, allocated_amount: 5_000, outstanding_amount: 0, status: 'funded', claimed_by_user_id: 'user-1', funded_at: '2026-08-10T00:00:00.000Z', fulfilled_at: null, created_at: '2026-08-03T00:00:00.000Z' }],
  richAuntieAwards: [{ id: 'award-1', recipient_user_id: 'user-1', sponsorship_item_id: 'item-1', reason_label: 'Covered the tent', created_at: '2026-08-10T00:00:00.000Z' }],
  memberProfiles: [{ user_id: 'user-1', name: 'John David' }],
  auditHistory: [
    {
      id: 'audit-1',
      user_id: 'user-1',
      action: 'updated',
      entity_type: 'contribution',
      entity_id: 'payment-1',
      old_values: { amount: 20_000, notes: 'Initial note' },
      new_values: { amount: 22_000, notes: 'For the tent & chairs' },
      created_at: '2026-08-10T01:00:00.000Z',
    },
  ],
  contributionEdits: [{ id: 'contribution-edit-1', contribution_id: 'payment-1', edited_by: 'user-1', field_changed: 'reference_number', old_value: 'OLD-REF', new_value: 'REF-1', reason: 'Corrected reference', created_at: '2026-08-10T00:30:00.000Z' }],
  expenseEdits: [],
  exportHistory: [{ id: 'export-1', exported_by: 'user-1', export_type: 'pdf', was_free: true, tokens_spent: 0, created_at: '2026-08-11T12:00:00.000Z' }],
  logoDataUri: 'data:image/png;base64,logo-data',
  generatedAt: '2026-08-12T00:00:00.000Z',
}

describe('buildFundReportHtml', () => {
  it('creates a statement-style audit report with distinct accounting and governance chapters', () => {
    const html = buildFundReportHtml(fixture)

    expect(html).toContain('data:image/png;base64,logo-data')
    expect(html).toContain('Tshelo Fund Statement')
    expect(html).toContain('Opening balance')
    expect(html).toContain('Total received')
    expect(html).toContain('Closing balance')
    expect(html).toContain('Statement of account')
    expect(html).toContain('Expenses and sponsorship')
    expect(html).toContain('Contributor recognition')
    expect(html).toContain('Governance')
    expect(html).toContain('Audit trail')
    expect(html).toContain('Appendix, record references')
    expect(html).toContain('Complete contribution ledger (1)')
    expect(html).toContain('Complete expense ledger (1)')
    expect(html).toContain('Legacy field edit history (1)')
    expect(html).toContain('Statements previously issued for this fund')
  })

  it('reconciles money movements into a running closing balance', () => {
    const html = buildFundReportHtml(fixture)

    expect(html).toContain('Contribution from John David')
    expect(html).toContain('Venue deposit')
    expect(html).toContain('P 22,000.00')
    expect(html).toContain('P 1,100.00')
    expect(html).toContain('P 20,900.00')
    expect(html).toContain('Closing balance held by the organiser')
  })

  it('includes every recorded before-and-after value without truncating the audit history', () => {
    const html = buildFundReportHtml(fixture)

    expect(html).toContain('P 20,000.00')
    expect(html).toContain('P 22,000.00')
    expect(html).toContain('Initial note')
    expect(html).toContain('For the tent &amp; chairs')
    expect(html).toContain('Corrected reference')
    expect(html).toContain('Receipt recorded')
  })

  it('keeps deleted expenses and inactive members in the complete registers', () => {
    const html = buildFundReportHtml({
      ...fixture,
      expenses: [{ ...fixture.expenses[0], deleted_at: '2026-08-12T01:00:00.000Z' }],
      members: [{ ...fixture.members[0], status: 'left' }],
    })

    expect(html).toContain('Complete expense ledger (1)')
    expect(html).toContain('Deleted')
    expect(html).toContain('Complete member register (1)')
    expect(html).toContain('Left')
    expect(html).toMatch(/<span>MEMBERS<\/span><strong>1<\/strong>/)
  })

  it('preserves and escapes contribution notes', () => {
    const html = buildFundReportHtml(fixture)
    expect(html).toContain('For the tent &amp; chairs')
  })

  it('masks contributor contact details in the exported statement', () => {
    const html = buildFundReportHtml(fixture)

    expect(html).toContain('••• ••567')
    expect(html).not.toContain('71234567')
  })

  it('does not invent independent verification when the report has no verification hash', () => {
    const html = buildFundReportHtml(fixture)

    expect(html).toContain('Audit integrity')
    expect(html).not.toContain('tshelo.com/verify')
    expect(html).not.toContain('genuine and unaltered')
  })

  it('counts the organiser when legacy membership rows are missing', () => {
    const html = buildFundReportHtml({ ...fixture, members: [] })

    expect(html).toMatch(/<span>MEMBERS<\/span><strong>1<\/strong>/)
    expect(html).not.toMatch(/<span>MEMBERS<\/span><strong>0<\/strong>/)
  })
})
