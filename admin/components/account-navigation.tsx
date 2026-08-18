'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const accountLinks = [
  { href: '/account', label: 'Home' },
  { href: '/account/contributions', label: 'My contributions' },
  { href: '/account/funds', label: 'My funds' },
  { href: '/account/events', label: 'My events' },
] as const

export function AccountNavigation() {
  const pathname = usePathname()

  return (
    <ul>
      {accountLinks.map((link) => (
        <li key={link.href}>
          <Link
            className={pathname === link.href || (link.href !== '/account' && pathname.startsWith(`${link.href}/`)) ? 'active' : undefined}
            href={link.href}
            prefetch
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}
