import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { TrustLevel } from '@shared/contracts/users'
import { createClient } from './supabase-server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type AppUser = {
  id: string
  name: string
  phone: string
  trustScore: number
  trustLevel: TrustLevel
  tokenBalance: number
  profileCompleted: boolean
  createdAt: string
}

export async function requireAppUserId(client?: ServerClient) {
  const supabase = client ?? await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const userId = auth?.claims.sub

  if (!userId) redirect('/login')

  return userId
}

export async function requireAppUser(client?: ServerClient, knownUserId?: string): Promise<AppUser> {
  const supabase = client ?? await createClient()
  const userId = knownUserId ?? await requireAppUserId(supabase)

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, phone, trust_score, trust_level, token_balance, profile_completed, created_at')
    .eq('id', userId)
    .eq('is_banned', false)
    .is('deleted_at', null)
    .maybeSingle()

  if (!profile) redirect('/unauthorized')

  return {
    id: profile.id,
    name: profile.name || 'Tshelo member',
    phone: profile.phone || '',
    trustScore: profile.trust_score ?? 0,
    trustLevel: (profile.trust_level ?? 'new') as TrustLevel,
    tokenBalance: profile.token_balance ?? 0,
    profileCompleted: profile.profile_completed ?? false,
    createdAt: profile.created_at,
  }
}

export const getAppUserContext = cache(async () => {
  const supabase = await createClient()
  const userId = await requireAppUserId(supabase)

  return {
    supabase,
    userId,
    userPromise: requireAppUser(supabase, userId),
  }
})
