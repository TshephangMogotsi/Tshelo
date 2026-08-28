import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { CurrencyCode } from '@shared/contracts/common'
import type { TrustLevel } from '@shared/contracts/users'
import { createClient } from './supabase-server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

const APP_USER_CACHE_TTL_MS = 30_000
const APP_USER_CACHE_LIMIT = 500

const appUserCache = new Map<string, { user: AppUser; expiresAt: number }>()
const pendingAppUsers = new Map<string, Promise<AppUser>>()

export type AppUser = {
  id: string
  name: string
  phone: string
  email: string | null
  preferredCurrency: CurrencyCode | null
  notificationsEnabled: boolean
  trustScore: number
  trustLevel: TrustLevel
  tokenBalance: number
  profileCompleted: boolean
  createdAt: string
}

export function invalidateAppUser(userId: string) {
  appUserCache.delete(userId)
}

export function cacheAppUser(user: AppUser) {
  if (appUserCache.size >= APP_USER_CACHE_LIMIT) {
    const oldestKey = appUserCache.keys().next().value
    if (oldestKey) appUserCache.delete(oldestKey)
  }
  appUserCache.set(user.id, { user, expiresAt: Date.now() + APP_USER_CACHE_TTL_MS })
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

  const cached = appUserCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) return cached.user
  if (cached) appUserCache.delete(userId)

  const pending = pendingAppUsers.get(userId)
  if (pending) return pending

  const request = loadAppUser(supabase, userId)
  pendingAppUsers.set(userId, request)
  try {
    const user = await request
    cacheAppUser(user)
    return user
  } finally {
    pendingAppUsers.delete(userId)
  }
}

async function loadAppUser(supabase: ServerClient, userId: string): Promise<AppUser> {
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, phone, email, preferred_currency, notifications_enabled, trust_score, trust_level, token_balance, profile_completed, created_at')
    .eq('id', userId)
    .eq('is_banned', false)
    .is('deleted_at', null)
    .maybeSingle()

  if (!profile) redirect('/unauthorized')

  return {
    id: profile.id,
    name: profile.name || 'Tshelo member',
    phone: profile.phone || '',
    email: profile.email || null,
    preferredCurrency: profile.preferred_currency || null,
    notificationsEnabled: profile.notifications_enabled ?? true,
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
