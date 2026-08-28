import type { Metadata } from 'next'
import { TrustRecognition } from '@/components/account-rewards/trust-recognition'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Trust & rewards',
  description: 'Review your Tshelo trust progress, achievements, and Rich Auntie recognition.',
}

export default function RewardsPage() {
  return <TrustRecognition />
}
