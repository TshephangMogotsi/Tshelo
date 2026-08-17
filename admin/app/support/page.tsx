import { AppShell, SearchForm } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { requirePlatformAdmin } from '@/lib/auth'
import { formatDate, titleCase } from '@/lib/format'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requirePlatformAdmin()
  const rawQuery = (await searchParams).q ?? ''
  const query = rawQuery.replace(/[,%()]/g, '').trim().slice(0, 60)
  const supabase = await createClient()
  let request = supabase.from('support_tickets').select('id, ticket_number, category, subject, priority, status, assigned_to, created_at').order('created_at', { ascending: false }).limit(50)
  if (query) request = /^\d+$/.test(query) ? request.ilike('ticket_number', `%${query}%`) : request.ilike('subject', `%${query}%`)
  const { data: tickets, error } = await request

  return (
    <AppShell admin={admin} title="Support" description="Review the latest member support requests." action={<SearchForm defaultValue={query} placeholder="Search tickets" />}>
      <section className="panel data-panel"><div className="panel-heading"><div><h3>{query ? `Results for “${query}”` : 'Support queue'}</h3><p>Newest requests appear first</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Subject</th><th>Category</th><th>Priority</th><th>Assigned</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>{(tickets ?? []).map((ticket) => <tr key={ticket.id}>
            <td className="mono">{ticket.ticket_number}</td><td><strong>{ticket.subject}</strong></td><td>{titleCase(ticket.category)}</td><td>{titleCase(ticket.priority)}</td><td>{ticket.assigned_to ?? 'Unassigned'}</td><td><StatusPill value={ticket.status} /></td><td>{formatDate(ticket.created_at)}</td>
          </tr>)}</tbody></table>
          {!tickets?.length && <div className="table-empty">{error ? 'Support data could not be loaded.' : 'No matching tickets found.'}</div>}
        </div>
      </section>
    </AppShell>
  )
}
