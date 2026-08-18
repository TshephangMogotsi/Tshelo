import type { SupportTicketSummary } from '@shared/contracts/admin'
import type { Contribution, ContributionSummary } from '@shared/contracts/contributions'
import type { Event, EventSummary } from '@shared/contracts/events'
import type { Fund, FundSummary } from '@shared/contracts/funds'
import type { User, UserSummary } from '@shared/contracts/users'

export type EventRow = Omit<Event, 'estimated_spend_amount'> & {
  estimated_spend_amount: number | string | null
}

export type FundRow = Omit<Fund, 'goal_amount'> & {
  goal_amount: number | string | null
}

export type UserRow = Omit<User, 'status'> & {
  is_flagged: boolean | null
  is_banned: boolean | null
}

export type ContributionRow = Omit<Contribution, 'amount' | 'pledged_amount'> & {
  amount: number | string
  pledged_amount: number | string | null
}

export function toEventSummary(row: EventRow): EventSummary {
  return {
    id: row.id,
    creator_id: row.creator_id,
    event_code: row.event_code,
    name: row.name,
    event_type: row.event_type,
    event_emoji: row.event_emoji,
    event_date: row.event_date,
    event_time: row.event_time,
    venue_name: row.venue_name,
    currency_code: row.currency_code,
    linked_fund_id: row.linked_fund_id,
    status: row.status,
    created_at: row.created_at,
  }
}

export function toEvent(row: EventRow): Event {
  return {
    ...toEventSummary(row),
    description: row.description,
    event_time: row.event_time,
    event_end_date: row.event_end_date,
    event_end_time: row.event_end_time,
    venue_address: row.venue_address,
    venue_lat: row.venue_lat,
    venue_lng: row.venue_lng,
    cover_photo_url: row.cover_photo_url,
    share_code: row.share_code,
    estimated_spend_amount: row.estimated_spend_amount === null
      ? null
      : String(row.estimated_spend_amount),
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    updated_at: row.updated_at,
  }
}

export function toFundSummary(row: FundRow): FundSummary {
  return {
    id: row.id,
    owner_id: row.owner_id,
    title: row.title,
    fund_code: row.fund_code,
    fund_type: row.fund_type,
    fund_emoji: row.fund_emoji,
    currency_code: row.currency_code,
    goal_amount: row.goal_amount === null ? null : String(row.goal_amount),
    status: row.status,
    contribution_deadline: row.contribution_deadline,
    linked_event_id: row.linked_event_id,
    is_private: row.is_private,
    created_at: row.created_at,
  }
}

export function toFund(row: FundRow): Fund {
  return {
    ...toFundSummary(row),
    description: row.description,
    type_specific_data: row.type_specific_data,
    event_date: row.event_date,
    event_time: row.event_time,
    event_location: row.event_location,
    attendees: row.attendees,
    auto_close_date: row.auto_close_date,
    cover_photo_url: row.cover_photo_url,
    share_code: row.share_code,
    show_leaderboard: row.show_leaderboard,
    closed_at: row.closed_at,
    updated_at: row.updated_at,
  }
}

export function toUserSummary(row: UserRow): UserSummary {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    country_code: row.country_code,
    trust_level: row.trust_level ?? 'new',
    trust_score: row.trust_score ?? 0,
    profile_completed: Boolean(row.profile_completed),
    status: row.is_banned ? 'banned' : row.is_flagged ? 'flagged' : 'active',
    created_at: row.created_at,
  }
}

export function toUser(row: UserRow): User {
  return {
    ...toUserSummary(row),
    email: row.email,
    avatar_url: row.avatar_url,
    preferred_currency: row.preferred_currency,
    token_balance: row.token_balance ?? 0,
    onboarding_completed: Boolean(row.onboarding_completed),
    notifications_enabled: Boolean(row.notifications_enabled),
    last_active_at: row.last_active_at,
    updated_at: row.updated_at,
  }
}

export function toContributionSummary(row: ContributionRow): ContributionSummary {
  return {
    id: row.id,
    fund_id: row.fund_id,
    contributor_id: row.contributor_id,
    user_id: row.user_id,
    contributor_name: row.contributor_name,
    amount: String(row.amount),
    pledged_amount: row.pledged_amount === null ? null : String(row.pledged_amount),
    currency_code: row.currency_code,
    payment_method: row.payment_method,
    status: row.status,
    is_refunded: Boolean(row.is_refunded),
    confirmed_at: row.confirmed_at,
    created_at: row.created_at,
  }
}

export function toContribution(row: ContributionRow): Contribution {
  return {
    ...toContributionSummary(row),
    contributor_phone: row.contributor_phone,
    reference_number: row.reference_number,
    detected_via: row.detected_via,
    receipt_number: row.receipt_number,
    notes: row.notes,
    updated_at: row.updated_at,
  }
}

export function toSupportTicketSummary(row: SupportTicketSummary): SupportTicketSummary {
  return {
    id: row.id,
    ticket_number: row.ticket_number,
    category: row.category,
    subject: row.subject,
    priority: row.priority,
    status: row.status,
    assigned_to: row.assigned_to,
    created_at: row.created_at,
  }
}
