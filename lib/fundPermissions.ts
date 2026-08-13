export const FUND_PERMISSION_KEYS = [
  'record_contributions',
  'edit_contributions',
  'record_expenses',
  'edit_expenses',
  'manage_members',
  'manage_sponsorships',
  'award_recognition',
  'export_reports',
  'manage_event_guests',
  'post_event_announcements',
  'manage_event_budget',
] as const

export type FundPermission = typeof FUND_PERMISSION_KEYS[number]

export type FundPermissionCategory = 'money' | 'members' | 'operations' | 'event'

export type FundPermissionDefinition = {
  key: FundPermission
  category: FundPermissionCategory
  label: string
  description: string
}

export const FUND_PERMISSION_CATEGORIES: readonly {
  id: FundPermissionCategory
  label: string
}[] = [
  { id: 'money', label: 'Money' },
  { id: 'members', label: 'Members' },
  { id: 'operations', label: 'Fund operations' },
  { id: 'event', label: 'Linked event' },
]

export const FUND_PERMISSION_DEFINITIONS: readonly FundPermissionDefinition[] = [
  { key: 'record_contributions', category: 'money', label: 'Record contributions', description: 'Record received money and assign detected mobile-money payments.' },
  { key: 'edit_contributions', category: 'money', label: 'Edit contributions', description: 'Correct existing contribution records. Refunds remain owner-only.' },
  { key: 'record_expenses', category: 'money', label: 'Record expenses', description: 'Add expenses paid by the fund.' },
  { key: 'edit_expenses', category: 'money', label: 'Edit expenses', description: 'Correct or remove existing expense records.' },
  { key: 'manage_members', category: 'members', label: 'Manage members', description: 'Invite, approve, reject, and remove ordinary members.' },
  { key: 'manage_sponsorships', category: 'operations', label: 'Manage sponsorships', description: 'Create, edit, allocate, and fulfil sponsorship items.' },
  { key: 'award_recognition', category: 'operations', label: 'Award recognition', description: 'Award Rich Auntie recognition to eligible members.' },
  { key: 'export_reports', category: 'operations', label: 'Export reports', description: 'Generate detailed PDF and CSV fund reports.' },
  { key: 'manage_event_guests', category: 'event', label: 'Manage event guests', description: 'Invite and manage guests for the linked event.' },
  { key: 'post_event_announcements', category: 'event', label: 'Post announcements', description: 'Publish announcements for the linked event.' },
  { key: 'manage_event_budget', category: 'event', label: 'Manage event budget', description: 'Edit the budget for the linked event.' },
]

export type FundPermissionPresetId =
  | 'contributions_assistant'
  | 'expense_assistant'
  | 'member_coordinator'
  | 'event_coordinator'
  | 'full_admin'

export type FundPermissionPreset = {
  id: FundPermissionPresetId
  label: string
  description: string
  permissions: readonly FundPermission[]
}

export const FUND_PERMISSION_PRESETS: readonly FundPermissionPreset[] = [
  {
    id: 'contributions_assistant',
    label: 'Contributions assistant',
    description: 'Can record received contributions without editing existing records.',
    permissions: ['record_contributions'],
  },
  {
    id: 'expense_assistant',
    label: 'Expense assistant',
    description: 'Can record expenses without editing existing records.',
    permissions: ['record_expenses'],
  },
  {
    id: 'member_coordinator',
    label: 'Member coordinator',
    description: 'Can invite and manage ordinary fund members.',
    permissions: ['manage_members'],
  },
  {
    id: 'event_coordinator',
    label: 'Event coordinator',
    description: 'Can manage linked-event guests, announcements, and budget.',
    permissions: ['manage_event_guests', 'post_event_announcements', 'manage_event_budget'],
  },
  {
    id: 'full_admin',
    label: 'Full admin',
    description: 'Receives every delegatable operational permission.',
    permissions: FUND_PERMISSION_KEYS,
  },
]

// These powers are intentionally absent from the delegatable catalogue.
export const FUND_OWNER_ONLY_POWERS = [
  'manage_admins',
  'change_fund_settings',
  'close_fund',
  'delete_fund',
  'transfer_ownership',
  'refund_contributions',
] as const

export function hasFundPermission(
  permissions: ReadonlySet<FundPermission>,
  permission: FundPermission,
) {
  return permissions.has(permission)
}

export function matchingFundPermissionPreset(
  permissions: readonly FundPermission[],
): FundPermissionPresetId | 'custom' {
  const selected = new Set(permissions)
  const preset = FUND_PERMISSION_PRESETS.find(candidate => (
    candidate.permissions.length === selected.size
    && candidate.permissions.every(permission => selected.has(permission))
  ))
  return preset?.id ?? 'custom'
}
