import 'server-only'

import type { ServerClient } from './client'
import { invitationContinuation, onboardingPathFor } from '@/lib/post-login'

export type SignedInDestination = '/' | '/account/overview' | `/account${string}` | `/onboarding${string}` | null

export async function getSignedInDestination(client: ServerClient, requestedPath?: `/account${string}` | null): Promise<SignedInDestination> {
  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) return null

  const [{ data: admin }, { data: appUser }] = await Promise.all([
    client
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
    client
      .from('users')
      .select('id, profile_completed')
      .eq('id', user.id)
      .eq('is_banned', false)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  if (appUser && requestedPath) {
    if (invitationContinuation(requestedPath) && !appUser.profile_completed) {
      return onboardingPathFor(requestedPath)
    }
    return requestedPath
  }
  if (admin) return '/'
  if (appUser) return '/account/overview'
  return null
}
