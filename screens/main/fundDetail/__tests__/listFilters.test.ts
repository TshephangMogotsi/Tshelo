import {
  expenseCategoryLabel,
  filterContributions,
  filterExpenses,
  filterMembers,
} from '../listFilters'
import type { Contribution, Expense, Member } from '../types'

const contribution = (overrides: Partial<Contribution> = {}): Contribution => ({
  id: 'contribution', contributor_id: 'person', contributor_name: 'Lebo Dube', contributor_type: 'member',
  amount: 200, pledged_amount: null, allocated_amount: 0, outstanding_amount: null, pledge_state: null,
  payment_method: 'orange_money', reference_number: 'PAY-123', detected_via: 'manual', status: 'confirmed',
  is_refunded: false, confirmed_at: null, created_at: '2026-10-07', notes: null, ...overrides,
})

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'expense', vendor_name: 'Mpho Catering', description: 'Lunch', recorded_by_name: 'Nono',
  category: 'food', custom_category: null, amount: 500, created_at: '2026-10-07', notes: null,
  has_open_query: false, is_sponsored: false, sponsored_by_user_id: null, sponsored_by_name: null, ...overrides,
})

const member = (overrides: Partial<Member> = {}): Member => ({
  id: 'member', user_id: 'person', display_name: 'Mpho Dube', phone: '+26770000000', role: 'member', joined_at: '2026-10-07', ...overrides,
})

describe('fund workspace list filters', () => {
  it('finds contributions by person or reference and filters their state', () => {
    const items = [contribution(), contribution({ id: 'pledge', contributor_type: 'guest', contributor_name: 'Kago', reference_number: 'PLEDGE-456', status: 'pledged', pledge_state: 'pledged' })]
    expect(filterContributions(items, 'pay-123', 'all')).toHaveLength(1)
    expect(filterContributions(items, '', 'guest')).toEqual([items[1]])
    expect(filterContributions(items, '', 'pledged')).toEqual([items[1]])
    expect(filterContributions(items, '', 'received')).toEqual([items[0]])
  })

  it('filters expenses by searchable details and audit state', () => {
    const items = [expense(), expense({ id: 'sponsored', vendor_name: 'City Rides', category: 'transport', is_sponsored: true, has_open_query: true })]
    expect(expenseCategoryLabel(items[0])).toBe('food')
    expect(filterExpenses(items, 'catering', 'all')).toEqual([items[0]])
    expect(filterExpenses(items, '', 'sponsored')).toEqual([items[1]])
    expect(filterExpenses(items, '', 'needs_review')).toEqual([items[1]])
    expect(filterExpenses(items, '', 'category:food')).toEqual([items[0]])
  })

  it('filters members by name, phone, and role', () => {
    const items = [member(), member({ id: 'admin', display_name: 'Nono', phone: '+26771111111', role: 'admin' }), member({ id: 'owner', phone: '+26770000001', role: 'owner' })]
    expect(filterMembers(items, '7000', 'all')).toEqual([items[0], items[2]])
    expect(filterMembers(items, '', 'admins')).toEqual([items[1]])
    expect(filterMembers(items, '', 'organisers')).toEqual([items[2]])
  })
})
