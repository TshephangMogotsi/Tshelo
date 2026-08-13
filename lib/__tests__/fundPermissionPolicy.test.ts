import {
  fundPrimaryActions,
  linkedEventCapabilities,
} from '../fundPermissionPolicy'
import {
  FUND_PERMISSION_KEYS,
  type FundPermission,
} from '../fundPermissions'

function grants(...permissions: FundPermission[]) {
  return new Set<FundPermission>(permissions)
}

describe('fund permission UI policy matrix', () => {
  it.each([
    [[], ['make_pledge']],
    [['record_contributions'], ['record_contribution']],
    [['record_expenses'], ['make_pledge', 'record_expense']],
    [['manage_members'], ['make_pledge', 'invite_members']],
    [
      ['record_contributions', 'record_expenses', 'manage_members'],
      ['record_contribution', 'record_expense', 'invite_members'],
    ],
  ] as [FundPermission[], string[]][])('maps %j to only its allowed primary actions', (permissions, expected) => {
    expect(fundPrimaryActions(grants(...permissions))).toEqual(expected)
  })

  it('never removes the ordinary member pledge path', () => {
    const combinations = 1 << 3
    const relevant: FundPermission[] = [
      'record_contributions',
      'record_expenses',
      'manage_members',
    ]

    for (let mask = 0; mask < combinations; mask += 1) {
      const permissions = grants(...relevant.filter((_, index) => mask & (1 << index)))
      const actions = fundPrimaryActions(permissions)
      expect(actions).toContain(
        permissions.has('record_contributions') ? 'record_contribution' : 'make_pledge',
      )
    }
  })

  it.each([
    ['manage_event_guests', 'manageGuests'],
    ['post_event_announcements', 'postAnnouncements'],
    ['manage_event_budget', 'manageBudget'],
    ['record_contributions', 'recordContributions'],
    ['record_expenses', 'recordExpenses'],
  ] as [FundPermission, keyof ReturnType<typeof linkedEventCapabilities>][])('isolates %s from unrelated linked-event powers', (permission, capability) => {
    const result = linkedEventCapabilities(false, grants(permission))
    expect(result[capability]).toBe(true)
    expect(Object.entries(result).filter(([, allowed]) => allowed).map(([key]) => key)).toEqual([capability])
  })

  it('keeps standalone event organisers authoritative only for event operations', () => {
    expect(linkedEventCapabilities(true, grants())).toEqual({
      manageGuests: true,
      postAnnouncements: true,
      manageBudget: true,
      recordContributions: false,
      recordExpenses: false,
    })
  })

  it('gives a full fund admin the full linked-event matrix', () => {
    expect(linkedEventCapabilities(false, grants(...FUND_PERMISSION_KEYS))).toEqual({
      manageGuests: true,
      postAnnouncements: true,
      manageBudget: true,
      recordContributions: true,
      recordExpenses: true,
    })
  })
})
