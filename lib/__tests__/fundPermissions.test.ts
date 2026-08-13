import {
  FUND_PERMISSION_DEFINITIONS,
  FUND_OWNER_ONLY_POWERS,
  FUND_PERMISSION_KEYS,
  FUND_PERMISSION_PRESETS,
  hasFundPermission,
  matchingFundPermissionPreset,
  type FundPermission,
} from '../fundPermissions'

describe('fund admin permissions', () => {
  it('keeps owner-only powers outside the delegatable catalogue', () => {
    expect(FUND_OWNER_ONLY_POWERS).toEqual(expect.arrayContaining([
      'manage_admins',
      'close_fund',
      'delete_fund',
      'transfer_ownership',
      'refund_contributions',
    ]))
    expect(FUND_PERMISSION_KEYS).not.toEqual(expect.arrayContaining(FUND_OWNER_ONLY_POWERS as any))
  })

  it('defines UI copy for every delegatable permission exactly once', () => {
    expect(FUND_PERMISSION_DEFINITIONS.map(definition => definition.key).sort()).toEqual(
      [...FUND_PERMISSION_KEYS].sort(),
    )
    expect(new Set(FUND_PERMISSION_DEFINITIONS.map(definition => definition.key)).size).toBe(
      FUND_PERMISSION_KEYS.length,
    )
  })

  it('does not make record-only presets imply edit access', () => {
    const contributionPreset = FUND_PERMISSION_PRESETS.find(preset => preset.id === 'contributions_assistant')!
    const expensePreset = FUND_PERMISSION_PRESETS.find(preset => preset.id === 'expense_assistant')!

    expect(contributionPreset.permissions).toEqual(['record_contributions'])
    expect(contributionPreset.permissions).not.toContain('edit_contributions')
    expect(expensePreset.permissions).toEqual(['record_expenses'])
    expect(expensePreset.permissions).not.toContain('edit_expenses')
  })

  it('gives the full-admin preset every delegatable permission exactly once', () => {
    const fullAdmin = FUND_PERMISSION_PRESETS.find(preset => preset.id === 'full_admin')!
    expect(new Set(fullAdmin.permissions)).toEqual(new Set(FUND_PERMISSION_KEYS))
    expect(fullAdmin.permissions).toHaveLength(FUND_PERMISSION_KEYS.length)
  })

  it('identifies presets and custom selections', () => {
    expect(matchingFundPermissionPreset(['manage_members'])).toBe('member_coordinator')
    expect(matchingFundPermissionPreset(['record_contributions', 'record_expenses'])).toBe('custom')
  })

  it('checks an effective permission set', () => {
    const permissions = new Set<FundPermission>(['record_contributions'])
    expect(hasFundPermission(permissions, 'record_contributions')).toBe(true)
    expect(hasFundPermission(permissions, 'edit_contributions')).toBe(false)
  })
})
