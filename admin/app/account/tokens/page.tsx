import type { Metadata } from 'next'
import { TokenPurchase } from '@/components/account-tokens/token-purchase'
import { getAppUserContext } from '@/lib/app-user'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tshelo pricing',
  description: 'Purchase Tshelo token credit or a dated annual pass.',
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
