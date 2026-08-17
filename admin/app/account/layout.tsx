import { AccountShell } from '@/components/account-shell'
import { getAppUserContext } from '@/lib/app-user'

export const dynamic = 'force-dynamic'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { userPromise } = await getAppUserContext()
  const user = await userPromise

  return <AccountShell user={user}>{children}</AccountShell>
}
