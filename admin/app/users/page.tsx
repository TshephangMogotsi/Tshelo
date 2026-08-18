import { AppShell, SearchForm } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { requirePlatformAdmin } from '@/lib/auth'
import { getOperationsUsers } from '@/lib/data/operations'
import { formatDate } from '@/lib/format'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const rawQuery = (await searchParams).q ?? ''
  const query = rawQuery.replace(/[,%()]/g, '').trim().slice(0, 60)
  const supabase = await createClient()
  const adminPromise = requirePlatformAdmin(supabase)
  const [admin, { items: users, hasError }] = await Promise.all([
    adminPromise,
    getOperationsUsers(supabase, query),
  ])

  return (
    <AppShell admin={admin} title="Users" description="Search and review registered Tshelo accounts." action={<SearchForm defaultValue={query} placeholder="Search users" />}>
      <DataPanel title={query ? `Results for “${query}”` : 'Recent users'} subtitle="Showing up to 50 accounts">
        <div className="table-wrap">
          <table><thead><tr><th>User</th><th>Phone</th><th>Trust</th><th>Profile</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><div className="person-cell"><span>{user.name.charAt(0)}</span><strong>{user.name}</strong></div></td>
                  <td className="mono">{user.phone}</td><td>{user.trust_level}</td>
                  <td><StatusPill value={user.profile_completed ? 'completed' : 'pending'} /></td>
                  <td><StatusPill value={user.status} /></td>
                  <td>{formatDate(user.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length && <div className="table-empty">{hasError ? 'User data could not be loaded.' : 'No matching users found.'}</div>}
        </div>
      </DataPanel>
    </AppShell>
  )
}

function DataPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="panel data-panel"><div className="panel-heading"><div><h3>{title}</h3><p>{subtitle}</p></div></div>{children}</section>
}
