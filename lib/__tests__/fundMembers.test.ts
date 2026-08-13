import { formatFundMemberCount, fundMemberCount } from '../fundMembers'

describe('fundMemberCount', () => {
  it('counts the organiser when no membership row was returned', () => {
    expect(fundMemberCount(0)).toBe(1)
    expect(fundMemberCount(null)).toBe(1)
    expect(fundMemberCount(undefined)).toBe(1)
  })

  it('preserves valid member counts', () => {
    expect(fundMemberCount(7)).toBe(7)
  })

  it('formats the singular and plural labels correctly', () => {
    expect(formatFundMemberCount(0)).toBe('1 member')
    expect(formatFundMemberCount(2)).toBe('2 members')
  })
})
