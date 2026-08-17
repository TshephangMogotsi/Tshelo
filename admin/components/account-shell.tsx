import Image from 'next/image'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import type { AppUser } from '@/lib/app-user'

type AccountSection = 'home' | 'contributions'

export function AccountShell({
  user,
  children,
  active = 'home',
}: {
  user: AppUser
  children: React.ReactNode
  active?: AccountSection
}) {
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'T'

  return (
    <div className="member-frame">
      <header className="member-topbar">
        <div className="member-topbar-inner">
          <Link className="member-brand" href="/account">
            <Image src="/tshelo-icon.png" width={34} height={34} alt="" priority />
            <span>Tshelo</span>
          </Link>
          <div className="member-topbar-spacer" />
          <div className="member-token-pill" aria-label={`${user.tokenBalance} Tshelo tokens`}>
            <strong>{user.tokenBalance.toLocaleString('en-BW')}</strong>
            <span>tokens</span>
            <i aria-hidden="true">+</i>
          </div>
          <div className="member-avatar" aria-label={user.name}>{initials}</div>
        </div>
      </header>

      <div className="member-shell">
        <nav className="member-sidebar" aria-label="Account sections">
          <ul>
            <li><Link className={active === 'home' ? 'active' : undefined} href="/account">Home</Link></li>
            <li><Link className={active === 'contributions' ? 'active' : undefined} href="/account/contributions">My contributions</Link></li>
            <li><Link href="/account#funds">My funds</Link></li>
            <li><Link href="/account#events">My events</Link></li>
          </ul>
          <p>Account</p>
          <ul>
            <li><Link href="/account#profile">Account details</Link></li>
            <li><span aria-disabled="true">Buy tokens</span></li>
            <li><span aria-disabled="true">Marketplace</span></li>
            <li><span aria-disabled="true">News</span></li>
          </ul>
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
