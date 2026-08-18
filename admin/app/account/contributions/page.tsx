import type { Metadata } from 'next'
import Link from 'next/link'
import { StatusPill } from '@/components/status-pill'
import { getAppUserContext } from '@/lib/app-user'
import { getContributionHistory } from '@/lib/data/account'
import { formatDate, formatMoney, titleCase } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My contributions',
  description: 'Your Tshelo contribution history across every fund.',
}

type SearchParams = {
  fund?: string
  from?: string
  to?: string
}

function validDate(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? fallback : value
}

export default async function ContributionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { supabase, userId, userPromise } = await getAppUserContext()
  const query = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const defaultFrom = `${today.slice(0, 4)}-01-01`
  const from = validDate(query.from, defaultFrom)
  const to = validDate(query.to, today)
  const selectedFund = /^[0-9a-f-]{36}$/i.test(query.fund ?? '') ? query.fund ?? '' : ''
  const [{ funds, contributions, hasError }] = await Promise.all([
    getContributionHistory(supabase, userId, { fundId: selectedFund || undefined, from, to }),
    userPromise,
  ])

  return (
    <>
      <section className="member-pagehead">
        <div>
          <h1>My <em>contributions</em></h1>
          <p>Everything you have personally contributed, across every fund you have ever joined.</p>
        </div>
        <div className="member-page-actions" aria-label="Contribution document actions">
          <button type="button" disabled title="Available in the Tshelo mobile app">Export as PDF</button>
          <button type="button" disabled title="Available in the Tshelo mobile app">Year end summary</button>
        </div>
      </section>

      <section className="member-card">
        <div className="member-card-body">
          <form className="member-contribution-filters" method="get">
            <label>
              <span>Fund</span>
              <select name="fund" defaultValue={selectedFund}>
                <option value="">All funds</option>
                {funds.map((fund) => <option key={fund.id} value={fund.id}>{fund.title}</option>)}
              </select>
            </label>
            <label>
              <span>From date</span>
              <input type="date" name="from" defaultValue={from} max={to} />
            </label>
            <label>
              <span>To date</span>
              <input type="date" name="to" defaultValue={to} min={from} />
            </label>
            <button type="submit">Apply</button>
            {(selectedFund || from !== defaultFrom || to !== today) && <Link href="/account/contributions">Clear</Link>}
          </form>

          <div className="member-contribution-table-wrap">
            <table className="member-contribution-table">
              <thead>
                <tr><th>Fund</th><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr>
              </thead>
              <tbody>
                {contributions.map((contribution) => (
                  <tr key={contribution.id}>
                    <td><strong>{contribution.fund?.title ?? 'Tshelo fund'}</strong></td>
                    <td>{formatDate(contribution.created_at)}</td>
                    <td>{formatMoney(contribution.amount, contribution.currency_code)}</td>
                    <td>{contribution.payment_method ? titleCase(contribution.payment_method) : 'Not recorded'}</td>
                    <td><StatusPill value={contribution.status} /></td>
                  </tr>
                ))}
                {!contributions.length && (
                  <tr><td className="member-contribution-empty" colSpan={5}>No contributions match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {hasError && <p className="member-contribution-error">Your contributions could not be loaded. Please try again.</p>}
          <div className="member-year-note">
            <strong>Your year end summary is generated every January.</strong>{' '}
            It totals every contribution you made in the previous year across all funds, as one PDF you can keep for your own records.
          </div>
        </div>
      </section>
    </>
  )
}
