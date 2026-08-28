'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import {
  BellRing,
  Check,
  CircleAlert,
  CircleCheck,
  HandCoins,
  Megaphone,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
  WalletCards,
  X,
} from 'lucide-react'
import type { Notification } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'

type Filter = 'all' | 'unread'

const TYPE_ICONS = {
  join_request: UserRoundPlus,
  join_approved: CircleCheck,
  join_declined: CircleAlert,
  member_joined: UserRoundPlus,
  member_removed: CircleAlert,
  contribution_added: HandCoins,
  expense_added: ReceiptText,
  sms_detected: WalletCards,
  rich_auntie_tagged: Sparkles,
  event_announcement: Megaphone,
  reward_earned: Sparkles,
  trust_level_changed: ShieldCheck,
  tokens_purchased: WalletCards,
} as const

function notificationValue(notification: Notification, key: string) {
  const value = notification.data?.[key]
  return typeof value === 'string' ? value : null
}

function notificationDestination(notification: Notification): Route | null {
  const kind = notificationValue(notification, 'kind')
  const eventId = notificationValue(notification, 'eventId')
  const fundId = notification.fund_id ?? notificationValue(notification, 'fundId')

  if (kind === 'tokens_purchased') return '/account/tokens'
  if (kind === 'event_announcement' && eventId) return `/account/events/${eventId}` as Route
  if (fundId) return `/account/funds/${fundId}` as Route
  return null
}

function formatRelativeDate(value: string) {
  const milliseconds = new Date(value).getTime()
  if (Number.isNaN(milliseconds)) return 'Recently'
  const minutes = Math.max(0, Math.floor((Date.now() - milliseconds) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat('en-BW', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function isOrganiserInvitation(notification: Notification) {
  return notificationValue(notification, 'kind') === 'event_fund_organiser_invite'
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [markingIds, setMarkingIds] = useState<string[]>([])
  const [respondingId, setRespondingId] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    runApiRead(
      call => createApiClient().notifications.list({ limit: 100, sort_by: 'created_at', sort_direction: 'desc' }, call),
      controller.signal,
    )
      .then(page => {
        if (!controller.signal.aborted) setNotifications(page.items)
      })
      .catch(cause => {
        const message = apiErrorMessage(cause)
        if (!controller.signal.aborted && message) setError(message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [refreshVersion])

  const unreadCount = notifications.filter(notification => !notification.is_read).length
  const visibleNotifications = useMemo(
    () => filter === 'unread' ? notifications.filter(notification => !notification.is_read) : notifications,
    [filter, notifications],
  )

  async function markRead(ids: string[]) {
    const unreadIds = ids.filter(id => notifications.some(notification => notification.id === id && !notification.is_read))
    if (!unreadIds.length) return

    setMarkingIds(previous => [...new Set([...previous, ...unreadIds])])
    setNotifications(previous => previous.map(notification => (
      unreadIds.includes(notification.id)
        ? { ...notification, is_read: true, read_at: new Date().toISOString() }
        : notification
    )))

    try {
      await createApiClient().notifications.markRead(unreadIds)
    } catch (cause) {
      setNotifications(previous => previous.map(notification => (
        unreadIds.includes(notification.id)
          ? { ...notification, is_read: false, read_at: null }
          : notification
      )))
      setError(apiErrorMessage(cause))
    } finally {
      setMarkingIds(previous => previous.filter(id => !unreadIds.includes(id)))
    }
  }

  async function respondToInvitation(notification: Notification, accepted: boolean) {
    const inviteId = notificationValue(notification, 'organiserInviteId')
    if (!inviteId || respondingId) return

    setRespondingId(notification.id)
    setError('')
    setNotice('')
    try {
      await createApiClient().events.respondOrganiserInvite({
        invite_id: inviteId,
        accepted,
      })
      setNotifications(previous => previous.map(item => (
        item.id === notification.id
          ? {
              ...item,
              is_read: true,
              read_at: new Date().toISOString(),
              response_action: accepted ? 'accepted' : 'declined',
            }
          : item
      )))
      setNotice(accepted
        ? 'Invitation accepted. You can now manage the linked event and fund.'
        : 'Invitation declined.')
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setRespondingId('')
    }
  }

  function retry() {
    setLoading(true)
    setError('')
    setRefreshVersion(version => version + 1)
  }

  return (
    <>
      <section className="member-pagehead">
        <div>
          <h1>Your <em>notifications</em></h1>
        </div>
        {unreadCount > 0 && (
          <button
            className="member-notification-read-all"
            type="button"
            disabled={markingIds.length > 0}
            onClick={() => void markRead(notifications.filter(notification => !notification.is_read).map(notification => notification.id))}
          >
            <Check size={15} />
            {markingIds.length > 0 ? 'Updating…' : `Mark ${unreadCount} as read`}
          </button>
        )}
      </section>

      {notice && <p className="member-success-note" role="status"><CircleCheck size={16} /> {notice}</p>}
      {error && <p className="member-form-error member-notification-error" role="alert">{error}</p>}

      <section className="member-card member-notification-card">
        <header>
          <div className="member-section-title"><span><BellRing size={18} /></span><h2>Inbox</h2></div>
          <div className="member-notification-tabs" role="tablist" aria-label="Notification filter">
            <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All <b>{notifications.length}</b></button>
            <button type="button" role="tab" aria-selected={filter === 'unread'} className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Unread <b>{unreadCount}</b></button>
          </div>
        </header>

        <div className="member-card-body">
          {loading && <div className="member-api-state"><p>Loading your notifications…</p></div>}
          {!loading && error && !notifications.length && <div className="member-api-state error"><p>Your notifications could not be loaded.</p><button type="button" onClick={retry}><RefreshCw size={14} /> Try again</button></div>}
          {!loading && !error && !visibleNotifications.length && (
            <div className="member-notification-empty">
              <BellRing size={28} />
              <strong>{filter === 'unread' ? 'You are all caught up.' : 'No notifications yet.'}</strong>
              <p>{filter === 'unread' ? 'New updates will appear here when they arrive.' : 'Fund updates, events, and invitations will appear here.'}</p>
            </div>
          )}
          {!loading && visibleNotifications.length > 0 && (
            <div className="member-notification-list">
              {visibleNotifications.map(notification => {
                const Icon = TYPE_ICONS[notification.type as keyof typeof TYPE_ICONS] ?? BellRing
                const destination = notificationDestination(notification)
                const invitation = isOrganiserInvitation(notification)
                const isResponding = respondingId === notification.id
                const isMarking = markingIds.includes(notification.id)

                return (
                  <article className={`member-notification ${notification.is_read ? '' : 'unread'}`} key={notification.id}>
                    <div className="member-notification-icon"><Icon size={19} /></div>
                    <div className="member-notification-copy">
                      <div className="member-notification-heading">
                        <strong>{notification.title}</strong>
                        <time dateTime={notification.created_at}>{formatRelativeDate(notification.created_at)}</time>
                      </div>
                      <p>{notification.body}</p>
                      {invitation && (
                        notification.response_action ? (
                          <p className="member-notification-response"><Check size={14} /> Invitation {notification.response_action}</p>
                        ) : (
                          <div className="member-notification-invite-actions">
                            <button type="button" className="danger" disabled={isResponding} onClick={() => void respondToInvitation(notification, false)}><X size={14} /> Decline</button>
                            <button type="button" className="primary" disabled={isResponding} onClick={() => void respondToInvitation(notification, true)}><Check size={14} /> {isResponding ? 'Saving…' : 'Accept'}</button>
                          </div>
                        )
                      )}
                      <div className="member-notification-actions">
                        {!notification.is_read && <button type="button" disabled={isMarking} onClick={() => void markRead([notification.id])}>{isMarking ? 'Marking…' : 'Mark as read'}</button>}
                        {destination && <Link href={destination} onClick={() => void markRead([notification.id])}>Open</Link>}
                      </div>
                    </div>
                    {!notification.is_read && <span className="member-notification-unread" aria-label="Unread" />}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
