import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: admin } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (admin) redirect('/')
  }

  return <LoginForm />
}
