'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import {
  Award,
  Bell,
  CalendarDays,
  Coins,
  FileText,
  HandCoins,
  LayoutDashboard,
  PartyPopper,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react'

const workspaceLinks = [
  { id: 'overview', href: '/account/overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'funds', href: '/account/funds', label: 'My funds', icon: HandCoins },
  { id: 'event-fund', href: '/account/events?tab=eventFund', label: 'Event + Fund', icon: PartyPopper },
  { id: 'events', href: '/account/events', label: 'My events', icon: CalendarDays },
  { id: 'reports', href: '/account/reports', label: 'Reports & documents', icon: FileText },
  { id: 'tokens', href: '/account/tokens', label: 'Buy tokens', icon: Coins },
] as const

const accountLinks = [
  { href: '/account', label: 'Account details', icon: UserRound },
  { href: '/account/preferences', label: 'Account preferences', icon: SlidersHorizontal },
  { href: '/account/notifications', label: 'Notifications', icon: Bell },
  { href: '/account/rewards', label: 'Trust & rewards', icon: Award },
] as const

export function AccountNavigation() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isEventFundContext = (pathname === '/account/events' && searchParams.get('tab') === 'eventFund')
    || (pathname === '/account/events/new' && searchParams.get('mode') === 'eventFund')

  function isWorkspaceLinkActive(link: (typeof workspaceLinks)[number]) {
    if (link.id === 'event-fund') {
      return isEventFundContext
    }
    if (link.id === 'events') {
      return pathname.startsWith('/account/events')
        && !isEventFundContext
        && !(pathname === '/account/events' && searchParams.get('tab') === 'eventFund')
    }
    return pathname === link.href || pathname.startsWith(`${link.href}/`)
  }

  return (
    <>
      <ul>
        {workspaceLinks.map((link) => {
          const Icon = link.icon
          return <li key={link.id}>
            <Link
              className={isWorkspaceLinkActive(link) ? 'active' : undefined}
              href={link.href as Route}
              prefetch
            >
              <Icon size={17} aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          </li>
        })}
      </ul>
      <p>Account</p>
      <ul>
        {accountLinks.map((link) => {
          const Icon = link.icon
          return <li key={link.href}>
            <Link
              className={pathname === link.href || (link.href !== '/account' && pathname.startsWith(`${link.href}/`)) ? 'active' : undefined}
              href={link.href as Route}
              prefetch
            >
              <Icon size={17} aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          </li>
        })}
      </ul>
    </>
  )
}
