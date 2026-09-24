import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { AccountDeletionRequestForm } from '@/components/account-deletion-request-form'

export const metadata: Metadata = {
  title: { absolute: 'Request account deletion | Tshelo' },
  description: 'Submit a request to delete your Tshelo account and associated personal data.',
}

export default function AccountDeletionRequestPage() {
  return (
    <section className="member-policy-page deletion-request-page">
      <Link className="member-policy-back" href={'/legal/account-deletion' as Route}><ArrowLeft size={15} /> Account deletion information</Link>
      <header className="member-policy-hero">
        <span className="member-policy-eyebrow"><ShieldCheck size={14} /> Account and data controls</span>
        <h1>Request <em>account deletion</em></h1>
        <p>Submit a request if you no longer have access to the Tshelo app. We verify ownership before any account is closed.</p>
      </header>
      <AccountDeletionRequestForm />
    </section>
  )
}
