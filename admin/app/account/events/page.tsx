import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EventList } from '@/components/account-events/event-list'

export const metadata: Metadata = { title: 'My events', description: 'Create, join, and manage your Tshelo events.' }

export default function AccountEventsPage() {
  return <Suspense fallback={<section className="member-card"><div className="member-empty">Loading your events…</div></section>}><EventList /></Suspense>
}
