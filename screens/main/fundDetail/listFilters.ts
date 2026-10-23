import type { Contribution, Expense, Member } from './types'

export type ContributionListFilter = 'all' | 'received' | 'pledged' | 'member' | 'guest' | 'refunded'
export type ExpenseListFilter = 'all' | 'recorded' | 'sponsored' | 'needs_review' | `category:${string}`
export type MemberListFilter = 'all' | 'organisers' | 'admins' | 'members'

function matchesSearch(query: string, values: Array<string | null | undefined>) {
  const normalisedQuery = query.trim().toLocaleLowerCase()
  return !normalisedQuery || values.some(value => value?.toLocaleLowerCase().includes(normalisedQuery))
}

export function filterContributions(
  contributions: Contribution[],
  query: string,
  filter: ContributionListFilter,
) {
  return contributions.filter(contribution => {
    if (!matchesSearch(query, [
      contribution.contributor_name,
      contribution.payment_method,
      contribution.reference_number,
      contribution.notes,
    ])) return false

    if (filter === 'member') return contribution.contributor_type === 'member'
    if (filter === 'guest') return contribution.contributor_type === 'guest'
    if (filter === 'refunded') return contribution.is_refunded
    if (filter === 'pledged') return contribution.status === 'pledged' || contribution.pledge_state === 'pledged'
    if (filter === 'received') return !contribution.is_refunded && contribution.status !== 'pledged'
    return true
  })
}

export function expenseCategoryLabel(expense: Expense) {
  return expense.custom_category?.trim() || expense.category?.trim() || 'Uncategorised'
}

export function filterExpenses(expenses: Expense[], query: string, filter: ExpenseListFilter) {
  return expenses.filter(expense => {
    const category = expenseCategoryLabel(expense)
    if (!matchesSearch(query, [
      expense.vendor_name,
      expense.description,
      expense.recorded_by_name,
      category,
      expense.notes,
    ])) return false

    if (filter === 'recorded') return !expense.is_sponsored
    if (filter === 'sponsored') return expense.is_sponsored
    if (filter === 'needs_review') return expense.has_open_query
    if (filter.startsWith('category:')) return category === filter.slice('category:'.length)
    return true
  })
}

export function filterMembers(members: Member[], query: string, filter: MemberListFilter) {
  return members.filter(member => {
    if (!matchesSearch(query, [member.display_name, member.phone, member.role])) return false
    if (filter === 'organisers') return member.role === 'owner'
    if (filter === 'admins') return member.role === 'admin'
    if (filter === 'members') return member.role === 'member'
    return true
  })
}
