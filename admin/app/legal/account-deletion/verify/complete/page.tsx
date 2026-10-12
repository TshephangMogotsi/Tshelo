import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: { absolute: 'Tshelo deletion request verification' },
}

export default async function AccountDeletionVerificationCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const confirmed = status === 'confirmed'
  const failed = status === 'error'

  return (
    <section className="member-policy-page">
      <header className="member-policy-hero">
        <span className="member-policy-eyebrow">Account and data controls</span>
        <h1>{confirmed ? 'Deletion request confirmed' : 'Verification link unavailable'}</h1>
        <p>{confirmed
          ? 'We have recorded your verified request. Tshelo support will review it and verify any remaining account, shared-record, and retention obligations before taking action.'
          : failed
            ? 'We could not complete verification at this time. Please try again later or contact support@tshelo.co.bw.'
            : 'This verification link has expired, was already used, or is invalid. Request a new link or contact support@tshelo.co.bw.'}</p>
        <Link className="deletion-request-link" href="/legal/account-deletion/request">Request a new verification link</Link>
      </header>
    </section>
  )
}
