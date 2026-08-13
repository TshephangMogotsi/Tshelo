import { calculateFundFinancialSummary, isFundReadOnly, isVisibleInFundMoneyView, prioritiseRichAunties } from '../finance'
import type { Contribution } from '../types'

function contribution(overrides: Partial<Contribution>): Contribution {
  return {
    id: 'contribution-1',
    contributor_id: 'contributor-1',
    contributor_name: 'Test contributor',
    contributor_type: 'member',
    amount: 2_000,
    pledged_amount: null,
    allocated_amount: 0,
    outstanding_amount: null,
    pledge_state: null,
    payment_method: null,
    reference_number: null,
    detected_via: 'manual',
    status: 'confirmed',
    is_refunded: false,
    confirmed_at: null,
    created_at: '2026-08-12T00:00:00.000Z',
    notes: null,
    ...overrides,
  }
}

describe('calculateFundFinancialSummary', () => {
  it('calculates cash position and remaining target independently', () => {
    expect(calculateFundFinancialSummary({ goalAmount: 20_000, totalIn: 8_000, totalOut: 1_500 })).toEqual({
      totalIn: 8_000,
      totalOut: 1_500,
      balance: 6_500,
      remainingToTarget: 12_000,
      amountOverTarget: 0,
    })
  })

  it('keeps outstanding at zero and records the amount above target', () => {
    expect(calculateFundFinancialSummary({ goalAmount: 20_000, totalIn: 22_000, totalOut: 1_100 })).toEqual({
      totalIn: 22_000,
      totalOut: 1_100,
      balance: 20_900,
      remainingToTarget: 0,
      amountOverTarget: 2_000,
    })
  })
})

describe('isVisibleInFundMoneyView', () => {
  it('hides a fulfilled pledge from the compact money list', () => {
    expect(isVisibleInFundMoneyView(contribution({ status: 'pledged', pledge_state: 'fulfilled' }))).toBe(false)
  })

  it('keeps open pledges and received payments visible', () => {
    expect(isVisibleInFundMoneyView(contribution({ status: 'pledged', pledge_state: 'partially_paid' }))).toBe(true)
    expect(isVisibleInFundMoneyView(contribution({ status: 'confirmed' }))).toBe(true)
  })
})

describe('isFundReadOnly', () => {
  it('only permits mutations while the fund is active', () => {
    expect(isFundReadOnly('active')).toBe(false)
    expect(isFundReadOnly('closed')).toBe(true)
    expect(isFundReadOnly('completed')).toBe(true)
    expect(isFundReadOnly(undefined)).toBe(true)
  })
})

describe('prioritiseRichAunties', () => {
  it('puts recognised members first and preserves order within each group', () => {
    const members = [
      { user_id: 'owner', name: 'Owner' },
      { user_id: 'rich-1', name: 'First Rich Auntie' },
      { user_id: 'member', name: 'Member' },
      { user_id: 'rich-2', name: 'Second Rich Auntie' },
    ]

    expect(prioritiseRichAunties(members, new Set(['rich-1', 'rich-2'])).map(member => member.name)).toEqual([
      'First Rich Auntie',
      'Second Rich Auntie',
      'Owner',
      'Member',
    ])
  })
})
