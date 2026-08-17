'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const accountLinks = [
  { href: '/account', label: 'Home' },
  { href: '/account/contributions', label: 'My contributions' },
  { href: '/account/funds', label: 'My funds' },
] as const

export function AccountNavigation() {
  const pathname = usePathname()

  return (
    <ul>
      {accountLinks.map((link) => (
        <li key={link.href}>
          <Link
            className={pathname === link.href ? 'active' : undefined}
            href={link.href}
            prefetch
          >
            {link.label}
          </Link>
        </li>
      ))}
      <li><Link href="/account#events" prefetch>My events</Link></li>
    </ul>
  )
}
