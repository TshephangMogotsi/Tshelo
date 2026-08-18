import type { ApiResponse, IsoDateTime, JsonValue, ListRequest, OneOrMany, PaginatedResponse, SearchFilter, Uuid } from './common'
import type { FundStatus, FundSummary } from './funds'
import type { UserSummary } from './users'

export const PLATFORM_ADMIN_ROLES = ['support', 'operations', 'finance', 'super_admin'] as const
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number]

/** Operations exposed only through purpose-specific, audited database RPCs. */
export const PLATFORM_ADMIN_OPERATIONS = [
  'support.update',
  'users.moderate',
  'funds.moderate',
  'platform_admins.manage',
] as const
export type PlatformAdminOperation = (typeof PLATFORM_ADMIN_OPERATIONS)[number]

/**
 * Closed, least-privilege authorization matrix for elevated API work.
 * Platform reads continue through RLS and are intentionally absent here.
 */
export const PLATFORM_ADMIN_OPERATION_ROLES = {
  'support.update': ['support', 'operations', 'super_admin'],
  'users.moderate': ['operations', 'super_admin'],
  'funds.moderate': ['operations', 'super_admin'],
  'platform_admins.manage': ['super_admin'],
} as const satisfies Record<PlatformAdminOperation, readonly PlatformAdminRole[]>

export function isPlatformAdminRole(value: unknown): value is PlatformAdminRole {
  return typeof value === 'string' &&
    (PLATFORM_ADMIN_ROLES as readonly string[]).includes(value)
}

export function canPlatformAdminPerform(
  role: PlatformAdminRole,
  operation: PlatformAdminOperation,
) {
  return (PLATFORM_ADMIN_OPERATION_ROLES[operation] as readonly PlatformAdminRole[])
    .includes(role)
}

export const PLATFORM_ADMIN_STATUSES = ['active', 'inactive'] as const
export type PlatformAdminStatus = (typeof PLATFORM_ADMIN_STATUSES)[number]

export const SUPPORT_TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number]

export const SUPPORT_TICKET_STATUSES = ['open', 'pending', 'in_progress', 'resolved', 'closed'] as const
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number]

export const USER_MODERATION_ACTIONS = ['flag', 'unflag', 'ban', 'unban'] as const
export type UserModerationAction = (typeof USER_MODERATION_ACTIONS)[number]

export const FUND_MODERATION_ACTIONS = ['activate', 'close'] as const
export type FundModerationAction = (typeof FUND_MODERATION_ACTIONS)[number]

export type PlatformAdmin = {
  user_id: Uuid
  role: PlatformAdminRole
  name: string
  phone: string
  status: PlatformAdminStatus
}

export type SupportTicketSummary = {
  id: Uuid
  ticket_number: string
  category: string
  subject: string
  priority: SupportTicketPriority
  status: SupportTicketStatus
  assigned_to: string | null
  created_at: IsoDateTime
}

export type AdminOverview = {
  counts: {
    users: number
    active_funds: number
    open_tickets: number
    open_disputes: number
  }
  recent_funds: FundSummary[]
  recent_tickets: SupportTicketSummary[]
}

export type SupportTicketFilters = SearchFilter & {
  status?: OneOrMany<SupportTicketStatus>
  priority?: OneOrMany<SupportTicketPriority>
  assigned_to?: string
}

export type SupportTicketSortField = 'created_at' | 'priority' | 'status'
export type ListSupportTicketsRequest = ListRequest<SupportTicketFilters, SupportTicketSortField>

export type UpdateSupportTicketRequest = {
  ticket_id: Uuid
  status?: SupportTicketStatus
  priority?: SupportTicketPriority
  assigned_to?: string | null
  resolution_note?: string | null
}

export type ModerateUserRequest = {
  user_id: Uuid
  action: UserModerationAction
  reason?: string
}

export type ModerateFundRequest = {
  fund_id: Uuid
  action: FundModerationAction
  reason?: string
}

export type UpsertPlatformAdminRequest = {
  user_id: Uuid
  role: PlatformAdminRole
  status: PlatformAdminStatus
}

export type AdminAuditFilters = {
  actor_user_id?: Uuid
  entity_type?: string
  entity_id?: Uuid
  action?: string
}

export type AdminAuditSortField = 'created_at'
export type ListAdminAuditRequest = ListRequest<AdminAuditFilters, AdminAuditSortField>

export type AdminAuditEntry = {
  id: Uuid
  actor_user_id: Uuid
  action: string
  entity_type: string
  entity_id: Uuid | null
  metadata: JsonValue
  created_at: IsoDateTime
}

export type GetAdminOverviewResponse = ApiResponse<AdminOverview>
export type ListSupportTicketsResponse = PaginatedResponse<SupportTicketSummary>
export type UpdateSupportTicketResponse = ApiResponse<SupportTicketSummary>
export type ModerateUserResponse = ApiResponse<UserSummary>
export type ModerateFundResponse = ApiResponse<FundSummary & { status: FundStatus }>
export type UpsertPlatformAdminResponse = ApiResponse<PlatformAdmin>
export type ListAdminAuditResponse = PaginatedResponse<AdminAuditEntry>
