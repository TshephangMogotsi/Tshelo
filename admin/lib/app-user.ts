import { redirect } from 'next/navigation'
import { createClient } from './supabase-server'

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

export async function requireAppUser(): Promise<AppUser> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, phone, trust_score, trust_level, token_balance, profile_completed, created_at')
    .eq('id', user.id)
    .eq('is_banned', false)
    .is('deleted_at', null)
    .maybeSingle()

  if (!profile) redirect('/unauthorized')

  return {
    id: profile.id,
    name: profile.name || 'Tshelo member',
    phone: profile.phone || user.phone || '',
    trustScore: profile.trust_score ?? 0,
    trustLevel: profile.trust_level ?? 'new',
    tokenBalance: profile.token_balance ?? 0,
    profileCompleted: profile.profile_completed ?? false,
    createdAt: profile.created_at,
  }
}
