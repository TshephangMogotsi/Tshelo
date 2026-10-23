jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('../../admin/node_modules/@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ auth: { getClaims: mockGetClaims } })) }))
jest.mock('@/lib/config', () => ({ getSupabaseConfig: () => ({url:'https://auth.test',key:'public-test-key'}) }))
const mockGetClaims = jest.fn()

import { authenticateApiRequest } from '../../admin/lib/api/auth'
const claims = {sub:'test-user', role:'authenticated',aud:'authenticated',is_anonymous:false}
const request = () => new Request('https://tshelo.test/api/v1/admin', {headers: { authorization:'Bearer e30.e30.c2ln', 'x-assurance-level':'aal2' }})

it('derives MFA assurance only from verified claims', async () => {
  for (const aal of [undefined,'aal1','aal2']) {
    mockGetClaims.mockResolvedValue({data:{claims:{...claims,aal}},error:null})
    const result = await authenticateApiRequest(request())
    expect(result).toMatchObject({ok:true})
    if (result.ok) expect(result.auth.assuranceLevel).toBe(aal)
    expect(mockGetClaims).toHaveBeenCalledWith('e30.e30.c2ln')
  }
})

it('rejects invalid and expired tokens even when presented claims say aal2', async () => {
  mockGetClaims.mockResolvedValue({data:{claims:{...claims,aal:'aal2'}},error:new Error('invalid signature')})
  expect(await authenticateApiRequest(request())).toMatchObject({ok:false,status:401})
})
