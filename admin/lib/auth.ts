import { redirect } from 'next/navigation'
import type { PlatformAdminRole } from '@shared/contracts/admin'
import { createClient } from './supabase-server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type PlatformAdmin = {
  userId: string
  role: PlatformAdminRole
  name: string
  phone: string
}

export async function requirePlatformAdmin(client?: ServerClient): Promise<PlatformAdmin> {
  const supabase = client ?? await createClient()
  const { data: auth, error: authError } = await supabase.auth.getClaims()
  const userId = auth?.claims.sub

  if (authError || !userId) redirect('/login')

  const [{ data: admin }, { data: profile }] = await Promise.all([
    supabase
      .from('platform_admins')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('users')
      .select('name, phone')
      .eq('id', userId)
      .maybeSingle(),
  ])

  if (!admin) redirect('/unauthorized')
  if (auth.claims.aal !== 'aal2') redirect('/mfa')

  return {
    userId,
    role: admin.role as PlatformAdmin['role'],
    name: profile?.name ?? 'Tshelo admin',
    phone: profile?.phone ?? (typeof auth.claims.phone === 'string' ? auth.claims.phone : ''),
  }
}
