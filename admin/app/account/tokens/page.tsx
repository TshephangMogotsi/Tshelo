import type { Metadata } from 'next'
import { TokenPurchase } from '@/components/account-tokens/token-purchase'
import { getAppUserContext } from '@/lib/app-user'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Buy tokens',
  description: 'Purchase prepaid Tshelo feature tokens.',
}

export default async function TokenPurchasePage() {
  const { userPromise } = await getAppUserContext()
  const user = await userPromise

  return (
    <TokenPurchase
      tokenBalance={user.tokenBalance}
      checkoutBaseUrl={process.env.NEXT_PUBLIC_TOKEN_PORTAL_URL}
    />
  )
}
