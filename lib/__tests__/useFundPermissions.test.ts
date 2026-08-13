jest.mock('../supabase', () => ({
  supabase: { rpc: jest.fn() },
}))

import { supabase } from '../supabase'
import { loadMyFundPermissions } from '../useFundPermissions'

describe('loadMyFundPermissions', () => {
  it('returns only known capabilities from the effective-permissions RPC', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        { permission_key: 'record_contributions' },
        { permission_key: 'manage_members' },
        { permission_key: 'unexpected_power' },
      ],
      error: null,
    })

    await expect(loadMyFundPermissions('fund-1')).resolves.toEqual(new Set([
      'record_contributions',
      'manage_members',
    ]))
  })

  it('fails closed when permission loading fails', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error('offline') })
    await expect(loadMyFundPermissions('fund-1')).rejects.toThrow('offline')
  })
})
