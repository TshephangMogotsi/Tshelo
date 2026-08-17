import Link from 'next/link'
import { ArrowRight, CircleAlert, HandCoins, TicketCheck, Users } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { requirePlatformAdmin } from '@/lib/auth'
import { formatDate, formatMoney } from '@/lib/format'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const adminPromise = requirePlatformAdmin(supabase)

  const [admin, usersResult, fundsResult, ticketsResult, disputesResult, recentFundsResult, recentTicketsResult] = await Promise.all([
    adminPromise,
    supabase.from('users').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('funds').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'pending', 'in_progress']),
    supabase.from('disputes').select('*', { count: 'exact', head: true }).in('status', ['open', 'pending', 'in_progress']),
    supabase.from('funds').select('id, title, fund_code, goal_amount, currency_code, status, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('support_tickets').select('id, ticket_number, subject, priority, status, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  const stats = [
    { label: 'Platform users', value: usersResult.count ?? 0, hint: 'Registered accounts', icon: Users, tone: 'purple' },
    { label: 'Active funds', value: fundsResult.count ?? 0, hint: 'Currently operating', icon: HandCoins, tone: 'green' },
    { label: 'Open tickets', value: ticketsResult.count ?? 0, hint: 'Awaiting support', icon: TicketCheck, tone: 'amber' },
    { label: 'Open disputes', value: disputesResult.count ?? 0, hint: 'Need attention', icon: CircleAlert, tone: 'red' },
  ]

  return (
    <AppShell admin={admin} title="Operations overview" description="A live view of the Tshelo platform.">
      <section className="welcome-strip">
        <div>
          <p className="eyebrow">Today at Tshelo</p>
          <h2>Dumela, <em>{admin.name.split(' ')[0]}</em></h2>
          <p>Everything happening across the platform, in one operational view.</p>
        </div>
      </section>

      <section className="stat-grid" aria-label="Platform summary">
        {stats.map(({ label, value, hint, icon: Icon, tone }) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
            <p>{label}</p><strong>{value.toLocaleString('en-BW')}</strong><span>{hint}</span>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading"><div><h3>Newest funds</h3><p>Recently created across Tshelo</p></div><Link href="/funds" prefetch>View all <ArrowRight size={15} /></Link></div>
          <div className="compact-list">
            {(recentFundsResult.data ?? []).map((fund) => (
              <div className="compact-row" key={fund.id}>
                <div className="list-monogram">{fund.title.charAt(0)}</div>
                <div className="row-primary"><strong>{fund.title}</strong><span>{fund.fund_code} · {formatDate(fund.created_at)}</span></div>
                <div className="row-value"><strong>{formatMoney(fund.goal_amount, fund.currency_code)}</strong><StatusPill value={fund.status} /></div>
              </div>
            ))}
            {!recentFundsResult.data?.length && <EmptyRow label="No funds are available yet." />}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading"><div><h3>Support queue</h3><p>Latest requests from members</p></div><Link href="/support" prefetch>Open queue <ArrowRight size={15} /></Link></div>
          <div className="compact-list">
            {(recentTicketsResult.data ?? []).map((ticket) => (
              <div className="compact-row" key={ticket.id}>
                <div className="ticket-number">{ticket.ticket_number}</div>
                <div className="row-primary"><strong>{ticket.subject}</strong><span>{formatDate(ticket.created_at)} · {ticket.priority} priority</span></div>
                <StatusPill value={ticket.status} />
              </div>
            ))}
            {!recentTicketsResult.data?.length && <EmptyRow label="The support queue is clear." />}
          </div>
        </article>
      </section>
    </AppShell>
  )
}

function EmptyRow({ label }: { label: string }) {
  return <div className="empty-row">{label}</div>
}
