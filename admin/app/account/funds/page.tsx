import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FundList } from '@/components/account-funds/fund-list'

export const metadata: Metadata = {
  title: 'My funds',
  description: 'Create, join, and manage your Tshelo funds.',
}
export default function AccountFundsPage() {
  return <Suspense fallback={<section className="member-card"><div className="member-empty">Loading your funds…</div></section>}><FundList /></Suspense>
}
