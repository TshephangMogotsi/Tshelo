import type { Metadata } from 'next'
import { NotificationCenter } from '@/components/account-notifications/notification-center'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Review your Tshelo updates and organiser invitations.',
}

export default function NotificationsPage() {
  return <NotificationCenter />
}
