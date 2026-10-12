import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Confirm your Tshelo deletion request' },
}

export default async function VerifyAccountDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const validToken = typeof token === 'string' && /^[A-Za-z0-9_-]{32,}$/.test(token)

  return (
    <section className="member-policy-page">
      <header className="member-policy-hero">
        <span className="member-policy-eyebrow">Account and data controls</span>
        <h1>Confirm your deletion request</h1>
        {validToken ? (
          <>
            <p>Confirming proves that you control the email address used for this request. It does not immediately delete your account.</p>
            <form action="/api/account-deletion-request/verify" method="post">
              <input type="hidden" name="token" value={token} />
              <button type="submit">Confirm deletion request</button>
            </form>
          </>
        ) : <p>This verification link is invalid. Request a new link or contact support@tshelo.co.bw.</p>}
      </header>
    </section>
  )
}
