'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CircleHelp,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { PlatformAdmin } from '@/lib/auth'
import { titleCase } from '@/lib/format'

const navigation = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/funds', label: 'Funds', icon: HandCoins },
  { href: '/support', label: 'Support', icon: CircleHelp },
] as const

type Props = {
  admin: PlatformAdmin
  title: string
  description: string
  children: React.ReactNode
  action?: React.ReactNode
}

export function AppShell({ admin, title, description, children, action }: Props) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
          <Link className="topbar-brand" href="/">
            <Image src="/tshelo-icon.png" width={36} height={36} alt="" priority />
            <span>Tshelo</span>
            <small>Admin</small>
          </Link>
          <div className="topbar-spacer" />
          <div className="read-only"><span /> Live platform data</div>
          <div className="role-pill"><ShieldCheck size={15} />{titleCase(admin.role)}</div>
          <div className="topbar-avatar">{admin.name.charAt(0).toUpperCase()}</div>
        </div>
      </header>

      <div className="app-layout">
        <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <div className="sidebar-mobile-heading">
            <strong>Navigation</strong>
            <button className="mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20} /></button>
          </div>
          <div className="nav-group-label">Platform</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === href : pathname.startsWith(href)
            return (
              <Link key={href} href={href} className={active ? 'active' : ''} onClick={() => setMenuOpen(false)}>
                <Icon size={18} /><span>{label}</span>
              </Link>
            )
          })}
        </nav>
          <div className="nav-group-label account-label">Account</div>
          <div className="admin-profile">
            <div className="admin-avatar">{admin.name.charAt(0).toUpperCase()}</div>
            <div className="admin-identity"><strong>{admin.name}</strong><span>{titleCase(admin.role)}</span></div>
            <Link href="/logout" aria-label="Sign out" title="Sign out"><LogOut size={17} /></Link>
          </div>
        </aside>
        {menuOpen && <button className="menu-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

        <main className="app-main">
          <header className="page-header">
            <div className="topbar-copy"><h1>{title}</h1><p>{description}</p></div>
            {action && <div className="topbar-actions">{action}</div>}
          </header>
          <div className="content-wrap">{children}</div>
        </main>
      </div>
    </div>
  )
}

export function SearchForm({ defaultValue, placeholder }: { defaultValue?: string; placeholder: string }) {
  return (
    <form className="search-form">
      <Search size={17} />
      <input name="q" defaultValue={defaultValue} placeholder={placeholder} aria-label={placeholder} />
      <button type="submit">Search</button>
    </form>
  )
}
