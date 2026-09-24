import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal-frame">
      <header className="legal-topbar">
        <div className="legal-topbar-inner">
          <Link className="legal-brand" href={'/login' as Route}>
            <Image src="/tshelo-icon.png" width={34} height={34} alt="" priority />
            <span>Tshelo</span>
          </Link>
          <nav aria-label="Legal documents">
            <Link href={'/legal/terms' as Route}>Terms</Link>
            <Link href={'/legal/privacy' as Route}>Privacy</Link>
            <Link href={'/legal/account-deletion' as Route}>Delete account</Link>
            <Link className="legal-sign-in" href={'/login' as Route}>Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="legal-main">{children}</main>

      <footer className="legal-footer">
        <span>Tshelo · community money, clearly organised</span>
        <a href="mailto:support@tshelo.co.bw">support@tshelo.co.bw</a>
      </footer>
    </div>
  )
}
