import type { Metadata } from 'next'
import { AccountPreferences } from '@/components/account-preferences/account-preferences'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Account preferences',
  description: 'Manage Tshelo website appearance, communications, privacy, and account security.',
}

export default function AccountPreferencesPage() {
  return <AccountPreferences />
}
