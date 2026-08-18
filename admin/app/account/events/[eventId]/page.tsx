import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EventWorkspaceView } from '@/components/account-events/event-workspace'

export const metadata: Metadata = { title: 'Event workspace', description: 'Manage your Tshelo event.' }

export default async function EventWorkspacePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  return <Suspense fallback={<section className="member-card"><div className="member-empty">Loading event workspace…</div></section>}><EventWorkspaceView eventId={eventId} /></Suspense>
}
