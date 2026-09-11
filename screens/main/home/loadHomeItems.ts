import { api } from '../../../lib/api'
import { runApiRead } from '../../../lib/apiScreen'
import type { HomeItem } from './helpers'

export type LoadedHomeSummary = {
  items: HomeItem[]
  unreadCount: number
}

export async function loadHomeSummary(signal?: AbortSignal): Promise<LoadedHomeSummary> {
  const summary = await runApiRead(call => api.home.summary(call), { signal })
  return {
    unreadCount: summary.unread_notification_count,
    items: summary.items.map(item => ({
      id: item.id,
      fundId: item.fund_id,
      eventId: item.event_id,
      kind: item.kind,
      title: item.title,
      status: item.status,
      goal_amount: Number(item.goal_amount),
      budget_amount: item.budget_amount === null ? null : Number(item.budget_amount),
      budget_currency_code: item.budget_currency_code,
      total_contributions: Number(item.total_contributions),
      balance: Number(item.balance),
      member_count: item.member_count,
      guest_count: item.guest_count,
      role: item.role,
      event_date: item.event_date ?? '',
      venue_name: item.venue_name ?? '',
      category: item.category,
      emoji: item.emoji,
      currency_code: item.currency_code,
      created_at: item.created_at,
    })),
  }
}

/** Compatibility wrapper for callers that only need the cards. */
export async function loadHomeItems(_userId?: string, signal?: AbortSignal): Promise<HomeItem[]> {
  return (await loadHomeSummary(signal)).items
}
