import type { Metadata } from 'next'
import { Suspense } from 'react'
import { JoinEventForm } from '@/components/account-events/join-event-form'

export const metadata: Metadata = { title: 'Join an event', description: 'Join a Tshelo event with an invitation code.' }

export default function JoinEventPage() { return <Suspense fallback={<section className="member-card"><div className="member-empty">Loading…</div></section>}><JoinEventForm /></Suspense> }
