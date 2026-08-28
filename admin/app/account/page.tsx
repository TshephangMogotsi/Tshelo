import type { Metadata } from 'next'
import { UserRound } from 'lucide-react'
import { AccountProfile } from '@/components/account/account-profile'
import { getAppUserContext } from '@/lib/app-user'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Account details',
  description: 'Manage your Tshelo account details.',
}

export default async function AccountPage() {
  const { userPromise } = await getAppUserContext()
  const user = await userPromise

  return (
    <section className="member-card" id="profile">
      <header><div className="member-section-title"><span><UserRound size={18} /></span><h1>Account details</h1></div></header>
      <AccountProfile user={user} />
    </section>
  )
}
