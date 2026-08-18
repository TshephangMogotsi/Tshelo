import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import { getSignedInDestination } from '@/lib/data/session'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const supabase = await createClient()
  const destination = await getSignedInDestination(supabase)
  if (destination) redirect(destination)

  return <LoginForm />
}
