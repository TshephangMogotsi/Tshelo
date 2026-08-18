import 'server-only'

import type { AdminOverview, SupportTicketSummary } from '@shared/contracts/admin'
import type { FundSummary } from '@shared/contracts/funds'
import type { UserSummary } from '@shared/contracts/users'
import type { ServerClient } from './client'

type FundSummaryRow = Omit<FundSummary, 'goal_amount'> & {
  goal_amount: number | string | null
}

type UserSummaryRow = Omit<UserSummary, 'status'> & {
  is_flagged: boolean
  is_banned: boolean
}

export type DataList<T> = {
  items: T[]
  hasError: boolean
}

function toFundSummary(row: FundSummaryRow): FundSummary {
  return {
    ...row,
    goal_amount: row.goal_amount === null ? null : String(row.goal_amount),
  }
}

function toUserSummary({ is_banned, is_flagged, ...user }: UserSummaryRow): UserSummary {
  return {
    ...user,
    status: is_banned ? 'banned' : is_flagged ? 'flagged' : 'active',
  }
}

export async function getOperationsOverview(client: ServerClient): Promise<AdminOverview> {
  const [usersResult, fundsResult, ticketsResult, disputesResult, recentFundsResult, recentTicketsResult] = await Promise.all([
    client.from('users').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    client.from('funds').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    client.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'pending', 'in_progress']),
    client.from('disputes').select('*', { count: 'exact', head: true }).in('status', ['open', 'pending', 'in_progress']),
    client.from('funds').select('id, owner_id, title, fund_code, fund_type, fund_emoji, currency_code, goal_amount, status, contribution_deadline, linked_event_id, is_private, created_at').order('created_at', { ascending: false }).limit(5),
    client.from('support_tickets').select('id, ticket_number, category, subject, priority, status, assigned_to, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  return {
    counts: {
      users: usersResult.count ?? 0,
      active_funds: fundsResult.count ?? 0,
      open_tickets: ticketsResult.count ?? 0,
      open_disputes: disputesResult.count ?? 0,
    },
    recent_funds: ((recentFundsResult.data ?? []) as unknown as FundSummaryRow[]).map(toFundSummary),
    recent_tickets: (recentTicketsResult.data ?? []) as SupportTicketSummary[],
  }
}

export async function getOperationsUsers(client: ServerClient, query: string): Promise<DataList<UserSummary>> {
  let request = client
    .from('users')
    .select('id, name, phone, country_code, trust_level, trust_score, is_flagged, is_banned, profile_completed, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (query) request = /^\+?\d+$/.test(query) ? request.ilike('phone', `%${query}%`) : request.ilike('name', `%${query}%`)
  const { data, error } = await request

  return {
    items: ((data ?? []) as unknown as UserSummaryRow[]).map(toUserSummary),
    hasError: Boolean(error),
  }
}

export async function getOperationsFunds(client: ServerClient, query: string): Promise<DataList<FundSummary>> {
  let request = client
    .from('funds')
    .select('id, owner_id, title, fund_code, fund_type, fund_emoji, currency_code, goal_amount, status, contribution_deadline, linked_event_id, is_private, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (query) request = /^\d+$/.test(query) ? request.ilike('fund_code', `%${query}%`) : request.ilike('title', `%${query}%`)
  const { data, error } = await request

  return {
    items: ((data ?? []) as unknown as FundSummaryRow[]).map(toFundSummary),
    hasError: Boolean(error),
  }
}

export async function getSupportTickets(client: ServerClient, query: string): Promise<DataList<SupportTicketSummary>> {
  let request = client
    .from('support_tickets')
    .select('id, ticket_number, category, subject, priority, status, assigned_to, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (query) request = /^\d+$/.test(query) ? request.ilike('ticket_number', `%${query}%`) : request.ilike('subject', `%${query}%`)
  const { data, error } = await request

  return { items: (data ?? []) as SupportTicketSummary[], hasError: Boolean(error) }
}
