import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import { LogOut } from 'lucide-react'
import type { AppUser } from '@/lib/app-user'
import { AccountNavigation } from '@/components/account-navigation'
import { AccountDataWarmup } from '@/components/account-data-warmup'
import { NotificationBell } from '@/components/account-notifications/notification-bell'
import { AccountTheme } from '@/components/account-theme'

export function AccountShell({
  user,
  children,
}: {
  user: AppUser
  children: React.ReactNode
}) {
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'T'

  return (
    <div className="member-frame">
      <AccountTheme />
      <AccountDataWarmup />
      <header className="member-topbar">
        <div className="member-topbar-inner">
          <Link className="member-brand" href={'/account/overview' as Route}>
            <Image src="/tshelo-icon.png" width={34} height={34} alt="" priority />
            <span>Tshelo</span>
          </Link>
          <div className="member-topbar-spacer" />
          <Link className="member-token-pill" href={'/account/tokens' as Route} aria-label={`Buy tokens — current balance ${user.tokenBalance} Tshelo tokens`}>
            <strong>{user.tokenBalance.toLocaleString('en-BW')}</strong>
            <span>tokens</span>
            <i aria-hidden="true">+</i>
          </Link>
          <NotificationBell />
          <div className="member-avatar" aria-label={user.name}>{initials}</div>
        </div>
      </header>

      <div className="member-shell">
        <nav className="member-sidebar" aria-label="Account sections">
          <AccountNavigation />
          <form action="/logout" method="post">
            <button type="submit"><LogOut size={15} /> Sign out</button>
          </form>
        </nav>
        <main className="member-main">{children}</main>
      </div>

      <footer className="member-footer">
        <span>Tshelo · community money, clearly organised</span>
        <span>Secure web overview</span>
      </footer>
    </div>
  )
}
