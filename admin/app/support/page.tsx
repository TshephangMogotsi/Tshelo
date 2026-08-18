import { AppShell, SearchForm } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { requirePlatformAdmin } from '@/lib/auth'
import { getSupportTickets } from '@/lib/data/operations'
import { formatDate, titleCase } from '@/lib/format'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const rawQuery = (await searchParams).q ?? ''
  const query = rawQuery.replace(/[,%()]/g, '').trim().slice(0, 60)
  const supabase = await createClient()
  const adminPromise = requirePlatformAdmin(supabase)
  const [admin, { items: tickets, hasError }] = await Promise.all([
    adminPromise,
    getSupportTickets(supabase, query),
  ])

  return (
    <AppShell admin={admin} title="Support" description="Review the latest member support requests." action={<SearchForm defaultValue={query} placeholder="Search tickets" />}>
      <section className="panel data-panel"><div className="panel-heading"><div><h3>{query ? `Results for “${query}”` : 'Support queue'}</h3><p>Newest requests appear first</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Subject</th><th>Category</th><th>Priority</th><th>Assigned</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>{tickets.map((ticket) => <tr key={ticket.id}>
            <td className="mono">{ticket.ticket_number}</td><td><strong>{ticket.subject}</strong></td><td>{titleCase(ticket.category)}</td><td>{titleCase(ticket.priority)}</td><td>{ticket.assigned_to ?? 'Unassigned'}</td><td><StatusPill value={ticket.status} /></td><td>{formatDate(ticket.created_at)}</td>
          </tr>)}</tbody></table>
          {!tickets.length && <div className="table-empty">{hasError ? 'Support data could not be loaded.' : 'No matching tickets found.'}</div>}
        </div>
      </section>
    </AppShell>
  )
}
