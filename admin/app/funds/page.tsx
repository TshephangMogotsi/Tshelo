import { AppShell, SearchForm } from '@/components/app-shell'
import { StatusPill } from '@/components/status-pill'
import { requirePlatformAdmin } from '@/lib/auth'
import { formatDate, formatMoney, titleCase } from '@/lib/format'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function FundsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requirePlatformAdmin()
  const rawQuery = (await searchParams).q ?? ''
  const query = rawQuery.replace(/[,%()]/g, '').trim().slice(0, 60)
  const supabase = await createClient()
  let request = supabase.from('funds').select('id, title, fund_code, fund_type, currency_code, goal_amount, status, created_at').order('created_at', { ascending: false }).limit(50)
  if (query) request = /^\d+$/.test(query) ? request.ilike('fund_code', `%${query}%`) : request.ilike('title', `%${query}%`)
  const { data: funds, error } = await request

  return (
    <AppShell admin={admin} title="Funds" description="Review funds and their current operating status." action={<SearchForm defaultValue={query} placeholder="Search funds" />}>
      <section className="panel data-panel"><div className="panel-heading"><div><h3>{query ? `Results for “${query}”` : 'Recent funds'}</h3><p>Showing up to 50 funds</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Fund</th><th>Code</th><th>Type</th><th>Goal</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>{(funds ?? []).map((fund) => <tr key={fund.id}>
            <td><div className="person-cell"><span>{fund.title.charAt(0)}</span><strong>{fund.title}</strong></div></td>
            <td className="mono">{fund.fund_code}</td><td>{titleCase(fund.fund_type)}</td><td>{formatMoney(fund.goal_amount, fund.currency_code)}</td><td><StatusPill value={fund.status} /></td><td>{formatDate(fund.created_at)}</td>
          </tr>)}</tbody></table>
          {!funds?.length && <div className="table-empty">{error ? 'Fund data could not be loaded.' : 'No matching funds found.'}</div>}
        </div>
      </section>
    </AppShell>
  )
}
