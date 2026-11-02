import type { SupabaseClient, User } from '@supabase/supabase-js'

export type RecoveryTarget = 'phone' | 'email'
export type RecoverySession = { userId: string; target: RecoveryTarget; source: string }

async function currentUser(client: SupabaseClient): Promise<User> {
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Please sign in again.')
  if (data.user.app_metadata?.google_play_reviewer === true) throw new Error('Contact changes are unavailable for this account.')
  return data.user
}

/** Request a code for an already verified contact. The code is verified by the
 * server recovery endpoint, which binds it to the signed-in account. */
export async function sendRecoveryVerification(client: SupabaseClient, target: RecoveryTarget): Promise<RecoverySession> {
  const user = await currentUser(client)
  const source = target === 'phone' ? user.email : user.phone
  const verified = target === 'phone' ? user.email_confirmed_at : user.phone_confirmed_at
  if (!source || !verified) throw new Error(`This account does not have a verified ${target === 'phone' ? 'email address' : 'mobile number'}. Contact support for help.`)
  const { error } = target === 'phone'
    ? await client.auth.signInWithOtp({ email: source, options: { shouldCreateUser: false } })
    : await client.auth.signInWithOtp({ phone: source.startsWith('+') ? source : `+${source}`, options: { shouldCreateUser: false } })
  if (error) throw error
  return { userId: user.id, target, source }
}
