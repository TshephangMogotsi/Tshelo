export type StatusContribution = {
  fund_id: string
  amount: number | string | null
  status: string
  is_refunded: boolean | null
}

export type StatusAward = {
  fund_id: string
}

export type RichAuntieStatusSummary = {
  cashGiven: number
  fundCount: number
  isRichAuntie: boolean
  isConsistentContributor: boolean
}

export function summarizeRichAuntieStatus(
  contributions: StatusContribution[],
  awards: StatusAward[],
): RichAuntieStatusSummary {
  const confirmed = contributions.filter(
    contribution => contribution.status === 'confirmed' && !contribution.is_refunded,
  )
  const contributedFundIds = new Set(confirmed.map(contribution => contribution.fund_id))
  const helpedFundIds = new Set([
    ...contributedFundIds,
    ...awards.map(award => award.fund_id),
  ])

  return {
    cashGiven: confirmed.reduce(
      (sum, contribution) => sum + Number(contribution.amount ?? 0),
      0,
    ),
    fundCount: helpedFundIds.size,
    isRichAuntie: awards.length > 0,
    isConsistentContributor: contributedFundIds.size >= 3,
  }
}

export function richAuntieHeroTitle(isLoading: boolean, awardCount: number) {
  if (isLoading) return 'Rich Auntie status'
  return awardCount > 0 ? 'You’re a Rich Auntie!' : 'Rich Auntie status'
}
