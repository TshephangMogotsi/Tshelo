import type { Metadata } from 'next'
import { FundWorkspaceView } from '@/components/account-funds/fund-workspace'

export const metadata: Metadata = { title: 'Fund workspace', description: 'Manage your Tshelo fund.' }

export default async function FundWorkspacePage({ params }: { params: Promise<{ fundId: string }> }) {
  const { fundId } = await params
  return <FundWorkspaceView fundId={fundId} />
}
