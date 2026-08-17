import Image from 'next/image'
import Link from 'next/link'
import { LogOut, ShieldCheck } from 'lucide-react'
import type { AppUser } from '@/lib/app-user'

export function AccountShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  return (
    <div className="member-frame">
      <header className="member-topbar">
        <div className="member-topbar-inner">
          <Link className="member-brand" href="/account">
            <Image src="/tshelo-icon.png" width={38} height={38} alt="" priority />
            <span>Tshelo</span><small>My account</small>
          </Link>
          <div className="member-topbar-spacer" />
          <div className="member-security"><ShieldCheck size={15} /> Secure session</div>
          <div className="member-identity"><strong>{user.name}</strong><span>{user.phone}</span></div>
          <form action="/logout" method="post">
            <button className="member-logout" type="submit" aria-label="Sign out"><LogOut size={18} /></button>
          </form>
        </div>
      </header>
      <main className="member-main">{children}</main>
    </div>
  )
}
