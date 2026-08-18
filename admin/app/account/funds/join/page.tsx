import type { Metadata } from 'next'
import { Suspense } from 'react'
import { JoinFundForm } from '@/components/account-funds/join-fund-form'

export const metadata: Metadata = { title: 'Join a fund', description: 'Join a Tshelo fund with an invite code.' }

export default function JoinFundPage() {
  return <Suspense fallback={<section className="member-card"><div className="member-empty">Loading…</div></section>}><JoinFundForm /></Suspense>
}
