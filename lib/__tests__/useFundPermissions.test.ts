jest.mock('../api', () => ({
  api: { funds: { permissions: jest.fn() } },
}))

import { api } from '../api'
import { loadMyFundPermissions } from '../useFundPermissions'

describe('loadMyFundPermissions', () => {
  it('returns effective capabilities from the typed API', async () => {
    ;(api.funds.permissions as jest.Mock).mockResolvedValue([
      'record_contributions',
      'manage_members',
    ])

    await expect(loadMyFundPermissions('fund-1')).resolves.toEqual(new Set([
      'record_contributions',
      'manage_members',
    ]))
  })

  it('fails closed when permission loading fails', async () => {
    ;(api.funds.permissions as jest.Mock).mockRejectedValue(new Error('offline'))
    await expect(loadMyFundPermissions('fund-1')).rejects.toThrow('offline')
  })
})
