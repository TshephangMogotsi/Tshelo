import { redirect } from 'next/navigation'
import { createClient } from './supabase-server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type AppUser = {
  id: string
  name: string
  phone: string
  trustScore: number
  trustLevel: string
  tokenBalance: number
  profileCompleted: boolean
  createdAt: string
}

export async function requireAppUser(client?: ServerClient): Promise<AppUser> {
  const supabase = client ?? await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const userId = auth?.claims.sub

  if (!userId) redirect('/login')

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
    phone: profile.phone || (typeof auth.claims.phone === 'string' ? auth.claims.phone : ''),
    trustScore: profile.trust_score ?? 0,
    trustLevel: profile.trust_level ?? 'new',
    tokenBalance: profile.token_balance ?? 0,
    profileCompleted: profile.profile_completed ?? false,
    createdAt: profile.created_at,
  }
}
