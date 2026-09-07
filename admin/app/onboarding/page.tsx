import type { Metadata, Route } from 'next'
import { redirect } from 'next/navigation'
import { InvitationOnboardingForm } from '@/components/invitation-onboarding-form'
import { invitationContinuation, loginPathFor } from '@/lib/post-login'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Complete your profile',
  description: 'Finish setting up your Tshelo profile and continue to your invitation.',
}

function configuredHttpsUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams
  const invitation = invitationContinuation(typeof next === 'string' ? next : null)
  const nextPath = invitation?.path ?? null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect((nextPath ? loginPathFor(nextPath) : '/login') as Route)

  const { data: appUser } = await supabase
    .from('users')
    .select('phone, profile_completed, is_banned')
    .eq('id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!appUser || appUser.is_banned) redirect('/unauthorized')
  if (appUser.profile_completed) redirect((nextPath ?? '/account/overview') as Route)

  return (
    <InvitationOnboardingForm
      nextPath={nextPath}
      phone={user.phone ?? appUser.phone ?? ''}
      termsUrl={configuredHttpsUrl(process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL)}
      privacyUrl={configuredHttpsUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL)}
    />
  )
}
