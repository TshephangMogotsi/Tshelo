import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import { getSignedInDestination } from '@/lib/data/session'
import { safePostLoginPath } from '@/lib/post-login'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams
  const nextPath = safePostLoginPath(typeof next === 'string' ? next : null) as `/account${string}` | null
  const supabase = await createClient()
  const destination = await getSignedInDestination(supabase, nextPath)
  if (destination) redirect(destination as Route)

  return <LoginForm nextPath={nextPath} />
}
