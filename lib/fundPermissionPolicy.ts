import type { FundPermission } from './fundPermissions'

export type FundPrimaryAction =
  | 'record_contribution'
  | 'make_pledge'
  | 'record_expense'
  | 'invite_members'

export function fundPrimaryActions(
  permissions: ReadonlySet<FundPermission>,
): FundPrimaryAction[] {
  return [
    permissions.has('record_contributions')
      ? 'record_contribution'
      : 'make_pledge',
    ...(permissions.has('record_expenses') ? ['record_expense' as const] : []),
    ...(permissions.has('manage_members') ? ['invite_members' as const] : []),
  ]
}

export type LinkedEventCapabilities = {
  manageGuests: boolean
  postAnnouncements: boolean
  manageBudget: boolean
  recordContributions: boolean
  recordExpenses: boolean
}

export function linkedEventCapabilities(
  isEventAdmin: boolean,
  permissions: ReadonlySet<FundPermission>,
): LinkedEventCapabilities {
  return {
    manageGuests: isEventAdmin || permissions.has('manage_event_guests'),
    postAnnouncements: isEventAdmin || permissions.has('post_event_announcements'),
    manageBudget: isEventAdmin || permissions.has('manage_event_budget'),
    recordContributions: permissions.has('record_contributions'),
    recordExpenses: permissions.has('record_expenses'),
  }
}
