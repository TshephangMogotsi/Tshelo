'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { Bell, BellRing, RefreshCw, X } from 'lucide-react'
import type { Notification } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'

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
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Recently'
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat('en-BW', { day: 'numeric', month: 'short' }).format(new Date(value))
}

export function NotificationBell() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()

    runApiRead(
      call => createApiClient().notifications.list({ limit: 10, sort_by: 'created_at', sort_direction: 'desc' }, call),
      controller.signal,
    )
      .then(page => {
        if (!controller.signal.aborted) setNotifications(page.items.slice(0, 10))
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(apiErrorMessage(cause))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [open, refreshVersion])

  useEffect(() => {
    if (!open) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    function closeOnOutsidePress(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutsidePress)
    }
  }, [open])

  const unreadCount = notifications.filter(notification => !notification.is_read).length

  function markRead(notification: Notification) {
    if (notification.is_read) return
    setNotifications(previous => previous.map(item => (
      item.id === notification.id ? { ...item, is_read: true, read_at: new Date().toISOString() } : item
    )))
    void createApiClient().notifications.markRead([notification.id]).catch(() => {
      setNotifications(previous => previous.map(item => (
        item.id === notification.id ? { ...item, is_read: false, read_at: null } : item
      )))
    })
  }

  function toggleMenu() {
    if (open) {
      setOpen(false)
      return
    }
    setLoading(true)
    setError('')
    setOpen(true)
  }

  function retry() {
    setLoading(true)
    setError('')
    setRefreshVersion(version => version + 1)
  }

  return (
    <div className="member-notification-menu" ref={rootRef}>
      <button
        className="member-notification-bell"
        type="button"
        aria-label={unreadCount ? `Open notifications, ${unreadCount} unread` : 'Open notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggleMenu}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 ? <span className="member-notification-badge">{Math.min(unreadCount, 9)}{unreadCount > 9 ? '+' : ''}</span> : null}
      </button>

      {open ? (
        <section className="member-notification-popover" role="dialog" aria-label="Recent notifications">
          <header>
            <div><span>Inbox</span><h2>Notifications</h2></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={16} /></button>
          </header>

          <div className="member-notification-popover-body">
            {loading ? <div className="member-notification-popover-state"><span className="member-document-spinner" /><p>Loading notifications…</p></div> : null}
            {!loading && error ? (
              <div className="member-notification-popover-state error">
                <p>Notifications could not be loaded.</p>
                <button type="button" onClick={retry}><RefreshCw size={13} /> Try again</button>
              </div>
            ) : null}
            {!loading && !error && !notifications.length ? (
              <div className="member-notification-popover-state"><BellRing size={23} /><strong>No notifications yet.</strong><p>New updates will appear here.</p></div>
            ) : null}
            {!loading && !error && notifications.length ? (
              <div className="member-notification-popover-list">
                {notifications.map(notification => {
                  const destination = notificationDestination(notification)
                  const content = (
                    <>
                      <span className="member-notification-popover-icon"><BellRing size={15} /></span>
                      <span className="member-notification-popover-copy">
                        <span><strong>{notification.title}</strong><time dateTime={notification.created_at}>{formatRelativeDate(notification.created_at)}</time></span>
                        <small>{notification.body}</small>
                      </span>
                      {!notification.is_read ? <i aria-label="Unread" /> : null}
                    </>
                  )

                  return destination ? (
                    <Link className={notification.is_read ? '' : 'unread'} href={destination} key={notification.id} onClick={() => { markRead(notification); setOpen(false) }}>{content}</Link>
                  ) : (
                    <button className={notification.is_read ? '' : 'unread'} type="button" key={notification.id} onClick={() => markRead(notification)}>{content}</button>
                  )
                })}
              </div>
            ) : null}
          </div>

          <footer><Link href={'/account/notifications' as Route} onClick={() => setOpen(false)}>See all notifications</Link></footer>
        </section>
      ) : null}
    </div>
  )
}
