/**
 * A fund's organiser is always its first member, even when a legacy or
 * temporarily incomplete fund_members query does not include their row.
 */
export function fundMemberCount(value: number | string | null | undefined): number {
  const count = Number(value)
  return Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1
}

export function formatFundMemberCount(value: number | string | null | undefined): string {
  const count = fundMemberCount(value)
  return `${count} member${count === 1 ? '' : 's'}`
}
