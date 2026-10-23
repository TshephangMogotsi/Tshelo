import { redirect } from 'next/navigation'
import { MfaForm } from '@/components/mfa-form'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function MfaPage() {
  const client = await createClient()
  const { data, error } = await client.auth.getClaims()
  if (error || !data?.claims.sub) redirect('/login')

  // The self-only platform_admins policy deliberately permits this lookup at
  // aal1. Enrollment must never need access to privileged dashboard data.
  const { data: admin, error: roleError } = await client.from('platform_admins')
    .select('role').eq('user_id', data.claims.sub).eq('is_active', true).maybeSingle()
  if (roleError || !admin) redirect('/unauthorized')
  if (data.claims.aal === 'aal2') redirect('/')

  const { data: identity, error: identityError } = await client.auth.getUser()
  if (identityError || !identity.user) redirect('/login')
  if (!identity.user.email || !identity.user.email_confirmed_at) {
    return (
      <main className="login-form-panel">
        <section className="login-card">
          <h1>Confirm an email address before MFA setup</h1>
          <p>Authenticator enrollment requires a confirmed email address on your sign-in account.
            Contact your designated platform administrator to arrange email verification, then sign in again.</p>
          <form action="/logout" method="post"><button type="submit">Sign out</button></form>
        </section>
      </main>
    )
  }

  return <MfaForm />
}
