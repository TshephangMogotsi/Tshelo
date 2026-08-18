import 'server-only'

import type { ServerClient } from './client'

export type SignedInDestination = '/' | '/account' | null

export async function getSignedInDestination(client: ServerClient): Promise<SignedInDestination> {
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
      .select('id')
      .eq('id', user.id)
      .eq('is_banned', false)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  if (admin) return '/'
  if (appUser) return '/account'
  return null
}
