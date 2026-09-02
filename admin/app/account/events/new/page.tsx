import type { Metadata } from 'next'
import { CreateEventForm } from '@/components/account-events/create-event-form'

export const metadata: Metadata = { title: 'Create an event', description: 'Create a Tshelo event.' }

export default function NewEventPage() { return <CreateEventForm /> }
