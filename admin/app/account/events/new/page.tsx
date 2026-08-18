import type { Metadata } from 'next'
import { CreateEventForm } from '@/components/account-events/create-event-form'

export const metadata: Metadata = { title: 'Create an event', description: 'Create a Tshelo event or Event + Fund.' }

export default function NewEventPage() { return <CreateEventForm /> }
