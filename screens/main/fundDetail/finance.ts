import type { Contribution } from './types'

export function prioritiseRichAunties<T extends { user_id: string | null }>(
  members: T[],
  richAuntieUserIds: ReadonlySet<string>,
): T[] {
  return members
    .map((member, index) => ({ member, index }))
    .sort((left, right) => {
      const leftRecognised = Boolean(left.member.user_id && richAuntieUserIds.has(left.member.user_id))
      const rightRecognised = Boolean(right.member.user_id && richAuntieUserIds.has(right.member.user_id))
      if (leftRecognised !== rightRecognised) return leftRecognised ? -1 : 1
      return left.index - right.index
    })
    .map(({ member }) => member)
}

export type FundFinancialSummary = {
  totalIn: number
  totalOut: number
  balance: number
  remainingToTarget: number
  amountOverTarget: number
}

export function isFundReadOnly(status?: string | null): boolean {
  return status !== 'active'
}

export function calculateFundFinancialSummary({
  goalAmount,
  totalIn,
  totalOut,
}: {
  goalAmount: number
  totalIn: number
  totalOut: number
}): FundFinancialSummary {
  const safeGoal = Math.max(Number(goalAmount) || 0, 0)
  const safeTotalIn = Math.max(Number(totalIn) || 0, 0)
  const safeTotalOut = Math.max(Number(totalOut) || 0, 0)

  return {
    totalIn: safeTotalIn,
    totalOut: safeTotalOut,
    balance: safeTotalIn - safeTotalOut,
    remainingToTarget: Math.max(safeGoal - safeTotalIn, 0),
    amountOverTarget: Math.max(safeTotalIn - safeGoal, 0),
  }
}

export function isVisibleInFundMoneyView(contribution: Contribution): boolean {
  // The full audit trail and exports retain fulfilled pledges. The compact fund
  // view shows the received payment instead of displaying the same commitment
  // twice after it has been completely paid.
  return !(contribution.status === 'pledged' && contribution.pledge_state === 'fulfilled')
}
