import Link from 'next/link'
import { ShieldX } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <main className="centered-page">
      <div className="status-card">
        <div className="status-icon danger"><ShieldX size={28} /></div>
        <p className="eyebrow">Access denied</p>
        <h1>This account is not authorised.</h1>
        <p>Ask the system owner to add your existing Tshelo account to the platform-admin allowlist.</p>
        <Link className="primary-button link-button" href="/logout">Sign out</Link>
      </div>
    </main>
  )
}
