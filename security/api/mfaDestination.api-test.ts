jest.mock('server-only', () => ({}), { virtual: true })
import { getSignedInDestination } from '../../admin/lib/data/session'

function client(admin: boolean, level='aal1', failed=false) {
  return {
    auth: {getUser: jest.fn().mockResolvedValue({data:{user:{id:'test-user'}}}),
      mfa:{getAuthenticatorAssuranceLevel:jest.fn().mockResolvedValue({data:{currentLevel:level},error:failed ? new Error('offline') : null})}},
    from: (table: string) => ({ select() {return this}, eq() {return this}, is() {return this},
      maybeSingle: async () => ({data:table==='platform_admins' ? admin ? {user_id:'test-user'} : null : {id:'test-user',profile_completed:true},error:null}) }),
  }
}
it('routes admins through MFA until verification succeeds',async () => {
  for (const level of ['aal1','unknown']) expect(await getSignedInDestination(client(true,level) as never)).toBe('/mfa')
  expect(await getSignedInDestination(client(true,'aal2') as never)).toBe('/')
  expect(await getSignedInDestination(client(true,'aal2',true) as never)).toBe('/mfa')
})
it('preserves ordinary account access and account continuations',async () => {
  expect(await getSignedInDestination(client(false) as never)).toBe('/account/overview')
  expect(await getSignedInDestination(client(true) as never,'/account/preferences')).toBe('/account/preferences')
})
