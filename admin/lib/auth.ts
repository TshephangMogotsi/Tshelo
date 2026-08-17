import { redirect } from 'next/navigation'
import { createClient } from './supabase-server'

export type PlatformAdmin = {
  userId: string
  role: 'support' | 'operations' | 'finance' | 'super_admin'
  name: string
  phone: string
}

export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: admin } = await supabase
    .from('platform_admins')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!admin) redirect('/unauthorized')

  const { data: profile } = await supabase
    .from('users')
    .select('name, phone')
    .eq('id', user.id)
    .maybeSingle()

  return {
    userId: user.id,
    role: admin.role as PlatformAdmin['role'],
    name: profile?.name ?? 'Tshelo admin',
    phone: profile?.phone ?? user.phone ?? '',
  }
}
