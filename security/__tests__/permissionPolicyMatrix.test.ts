import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const enforcement = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260812160000_enforce_fund_admin_permissions.sql'),
  'utf8',
)
const cleanup = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260812170000_retire_legacy_fund_admin_authorization.sql'),
  'utf8',
)

describe('database permission policy matrix', () => {
  it.each([
    ['contributions_insert', 'record_contributions'],
    ['pledge_allocations_insert_manager', 'record_contributions'],
    ['expenses_insert', 'record_expenses'],
    ['expenses_update', 'edit_expenses'],
    ['fund_members_insert_manager', 'manage_members'],
    ['fund_members_update_manager', 'manage_members'],
    ['fund_exports_insert', 'export_reports'],
    ['fund_sponsorship_items_insert_manager', 'manage_sponsorships'],
    ['fund_sponsorship_items_update_manager', 'manage_sponsorships'],
    ['sponsorship_item_allocations_insert_manager', 'manage_sponsorships'],
    ['rich_auntie_awards_insert_manager', 'award_recognition'],
    ['event_budgets_manage_related', 'manage_event_budget'],
    ['event_guests_insert_manager', 'manage_event_guests'],
  ])('binds policy %s to %s', (policyName, permission) => {
    const policyStart = enforcement.indexOf(`CREATE POLICY ${policyName}`)
    expect(policyStart).toBeGreaterThanOrEqual(0)
    const nextPolicy = enforcement.indexOf('CREATE POLICY ', policyStart + 14)
    const policySql = enforcement.slice(
      policyStart,
      nextPolicy < 0 ? enforcement.length : nextPolicy,
    )
    expect(policySql).toContain(`'${permission}'`)
  })

  it('keeps independent record and edit checks in the contribution trigger', () => {
    expect(enforcement).toContain("can_record := public.has_fund_permission(OLD.fund_id, 'record_contributions')")
    expect(enforcement).toContain("can_edit := public.has_fund_permission(OLD.fund_id, 'edit_contributions')")
    expect(enforcement).toContain('Only the fund owner can record or change a refund')
  })

  it('checks permission inside security-definer money functions', () => {
    expect(enforcement).toMatch(
      /CREATE OR REPLACE FUNCTION public\.record_detected_contribution[\s\S]*?has_fund_permission\([\s\S]*?'record_contributions'/,
    )
    expect(enforcement).toMatch(
      /CREATE OR REPLACE FUNCTION public\.begin_receipt_parse[\s\S]*?has_fund_permission\(p_fund_id, 'record_expenses'\)/,
    )
  })

  it('does not use the legacy admin helper for an operational decision', () => {
    const operationalSql = enforcement.slice(0, enforcement.indexOf('COMMENT ON FUNCTION public.is_fund_admin'))
    expect(operationalSql).not.toContain('public.is_fund_admin(')
    expect(cleanup).not.toContain('OR public.is_fund_admin(')
    expect(cleanup).toContain("public.has_fund_permission(fund_id, 'manage_members')")
  })
})
