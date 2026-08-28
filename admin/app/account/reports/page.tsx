import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ContributionDocuments } from '@/components/account-contributions/contribution-documents'
import { UnifiedReports } from '@/components/account-reports/unified-reports'
import { getAppUserContext } from '@/lib/app-user'
import { getContributionHistory } from '@/lib/data/account'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reports & documents',
  description: 'Review fund movement and generate Tshelo statements and contribution documents.',
}

async function ContributionDocumentsContent() {
  const { supabase, userId, userPromise } = await getAppUserContext()
  const today = new Date().toISOString().slice(0, 10)
  const currentYearFrom = `${today.slice(0, 4)}-01-01`
  const previousYear = Number(today.slice(0, 4)) - 1
  const [currentYear, previousYearData, user] = await Promise.all([
    getContributionHistory(supabase, userId, { from: currentYearFrom, to: today }),
    getContributionHistory(supabase, userId, { from: `${previousYear}-01-01`, to: `${previousYear}-12-31` }),
    userPromise,
  ])

  return <ContributionDocuments
    userName={user.name}
    from={currentYearFrom}
    to={today}
    contributions={currentYear.contributions}
    previousYear={previousYear}
    previousYearContributions={previousYearData.contributions}
  />
}

export default function ReportsPage() {
  return (
    <UnifiedReports
      contributionDocuments={(
        <Suspense fallback={<div className="member-api-state"><p>Loading contribution documents…</p></div>}>
          <ContributionDocumentsContent />
        </Suspense>
      )}
    />
  )
}
