import { AppShell, SearchForm } from '@/components/app-shell'
import { SupportQueue } from '@/components/support-queue'
import { requirePlatformAdmin } from '@/lib/auth'
import { getSupportTickets } from '@/lib/data/operations'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const rawQuery = (await searchParams).q ?? ''
  const query = rawQuery.replace(/[,%()]/g, '').trim().slice(0, 60)
  const supabase = await createClient()
  const admin = await requirePlatformAdmin(supabase)
  const { items: tickets, hasError } = await getSupportTickets(supabase, query)

  return (
    <AppShell admin={admin} title="Support" description="Review the latest member support requests." action={<SearchForm defaultValue={query} placeholder="Search tickets" />}>
      <SupportQueue tickets={tickets} hasError={hasError} canManage={['support', 'operations', 'super_admin'].includes(admin.role)} query={query} />
    </AppShell>
  )
}
