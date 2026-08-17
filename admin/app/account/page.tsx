import type { Metadata } from 'next'
import { CircleCheck, Coins, HandCoins, ShieldCheck, Users } from 'lucide-react'
import { AccountShell } from '@/components/account-shell'
import { StatusPill } from '@/components/status-pill'
import { requireAppUser } from '@/lib/app-user'
import { formatDate, formatMoney, titleCase } from '@/lib/format'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Tshelo',
  description: 'Your secure Tshelo account overview.',
}

type FundSummary = {
  id: string
  title: string
  fund_code: string
  status: string
  goal_amount: number | string | null
  currency_code: string
  created_at: string
}

type MembershipRow = {
  id: string
  role: string
  status: string
  funds: FundSummary | FundSummary[] | null
}

function membershipFund(row: MembershipRow) {
  return Array.isArray(row.funds) ? row.funds[0] : row.funds
}

export default async function AccountPage() {
  const user = await requireAppUser()
  const supabase = await createClient()

  const [ownedFundsResult, membershipCountResult, membershipsResult] = await Promise.all([
    supabase
      .from('funds')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('fund_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'joined'),
    supabase
      .from('fund_members')
      .select('id, role, status, funds(id, title, fund_code, status, goal_amount, currency_code, created_at)')
      .eq('user_id', user.id)
      .in('status', ['joined', 'pending'])
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const memberships = (membershipsResult.data ?? []) as MembershipRow[]
  const firstName = user.name.split(' ')[0]
  const stats = [
    { label: 'Owned funds', value: ownedFundsResult.count ?? 0, icon: HandCoins, tone: 'purple' },
    { label: 'Fund memberships', value: membershipCountResult.count ?? 0, icon: Users, tone: 'green' },
    { label: 'Trust points', value: user.trustScore, icon: ShieldCheck, tone: 'amber' },
    { label: 'Tshelo tokens', value: user.tokenBalance, icon: Coins, tone: 'red' },
  ]

  return (
    <AccountShell user={user}>
      <section className="member-welcome">
        <div>
          <p className="eyebrow">My Tshelo</p>
          <h1>Dumela, <em>{firstName}</em></h1>
          <p>Your personal account overview, secured by phone verification.</p>
        </div>
        <div className="member-profile-status"><CircleCheck size={18} /><span>Profile {user.profileCompleted ? 'complete' : 'incomplete'}</span></div>
      </section>

      <section className="stat-grid member-stat-grid" aria-label="Account summary">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
            <p>{label}</p><strong>{value.toLocaleString('en-BW')}</strong><span>From your Tshelo account</span>
          </article>
        ))}
      </section>

      <div className="member-content-grid">
        <section className="panel">
          <div className="panel-heading"><div><h3>Your funds</h3><p>Recent funds you own or have joined</p></div></div>
          <div className="compact-list">
            {memberships.map((membership) => {
              const fund = membershipFund(membership)
              if (!fund) return null
              return (
                <div className="compact-row" key={membership.id}>
                  <div className="list-monogram">{fund.title.charAt(0)}</div>
                  <div className="row-primary"><strong>{fund.title}</strong><span>{fund.fund_code} · {titleCase(membership.role)}</span></div>
                  <div className="row-value"><strong>{formatMoney(fund.goal_amount, fund.currency_code)}</strong><StatusPill value={fund.status} /></div>
                </div>
              )
            })}
            {!memberships.length && <div className="empty-row">No funds are linked to this account yet.</div>}
          </div>
        </section>

        <aside className="panel member-profile-card">
          <div className="panel-heading"><div><h3>Account details</h3><p>Your verified Tshelo profile</p></div></div>
          <dl>
            <div><dt>Name</dt><dd>{user.name}</dd></div>
            <div><dt>Phone</dt><dd className="mono">{user.phone}</dd></div>
            <div><dt>Trust level</dt><dd>{titleCase(user.trustLevel)}</dd></div>
            <div><dt>Member since</dt><dd>{formatDate(user.createdAt)}</dd></div>
          </dl>
          <p>This web view is read-only. Use the Tshelo mobile app to manage funds, contributions and profile details.</p>
        </aside>
      </div>
    </AccountShell>
  )
}
