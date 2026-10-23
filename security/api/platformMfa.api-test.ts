jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }), { virtual: true })
jest.mock('@/lib/supabase-server', () => ({ createClient: jest.fn() }))

import { authorizePlatformAdminRead, withPlatformAdminOperation } from '../../admin/lib/api/platform-admin'
import { requirePlatformAdmin } from '../../admin/lib/auth'
import type { ApiAuthContext } from '../../admin/lib/api/auth'

function context(role: string | null, assuranceLevel?: string, error: unknown = null) {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: role ? { role } : null, error }) }
  return { actor: { user_id: 'test-admin', role: 'authenticated' }, assuranceLevel,
    supabase: { from: jest.fn(() => query) } } as unknown as ApiAuthContext
}

it.each(['support', 'operations', 'finance', 'super_admin'])('blocks %s platform reads and mutations without MFA', async role => {
  for (const level of [undefined, 'aal1', 'unknown']) {
    const auth = context(role, level)
    expect(await authorizePlatformAdminRead(auth)).toMatchObject({ ok: false, status: 403 })
    const execute = jest.fn()
    expect(await withPlatformAdminOperation(auth, 'support.update', execute)).toMatchObject({ ok: false, status: 403 })
    expect(execute).not.toHaveBeenCalled()
  }
})

it.each(['support', 'operations', 'finance', 'super_admin'])('allows %s platform reads with MFA', async role => {
  expect(await authorizePlatformAdminRead(context(role, 'aal2'))).toMatchObject({ ok: true, data: { role } })
})

it('preserves role restrictions and the caller-scoped database client after MFA', async () => {
  const execute = jest.fn().mockResolvedValue('saved')
  expect(await withPlatformAdminOperation(context('finance', 'aal2'), 'users.moderate', execute)).toMatchObject({ ok: false, status: 403 })
  expect(execute).not.toHaveBeenCalled()
  const auth = context('operations', 'aal2')
  expect(await withPlatformAdminOperation(auth, 'users.moderate', execute)).toEqual({ ok: true, data: 'saved' })
  expect(execute.mock.calls[0][0].supabase).toBe(auth.supabase)
})

it('fails closed for missing roles and authorization lookup errors even with MFA', async () => {
  expect(await authorizePlatformAdminRead(context(null, 'aal2'))).toMatchObject({ ok: false, status: 403 })
  expect(await authorizePlatformAdminRead(context('fund_admin', 'aal2'))).toMatchObject({ ok: false, status: 403 })
  expect(await authorizePlatformAdminRead(context('support', 'aal2', new Error('offline')))).toMatchObject({ ok: false, status: 500 })
})

it('redirects OTP-only admin pages to MFA and allows verified admin pages', async () => {
  for (const aal of [undefined, 'aal1', 'aal2']) {
    const client = context('support', aal).supabase
    Object.assign(client, { auth: { getClaims: jest.fn().mockResolvedValue({ data: { claims: { sub: 'test-admin', aal } } }) } })
    if (aal === 'aal2') expect(await requirePlatformAdmin(client as never)).toMatchObject({ userId: 'test-admin', role: 'support' })
    else await expect(requirePlatformAdmin(client as never)).rejects.toThrow('redirect:/mfa')
  }
})

it('redirects signed-out pages to login and users without platform roles to unauthorized', async () => {
  const signedOut = { auth: { getClaims: jest.fn().mockResolvedValue({ data: null, error: new Error('expired') }) } }
  await expect(requirePlatformAdmin(signedOut as never)).rejects.toThrow('redirect:/login')
  const noRole = context(null, 'aal2').supabase
  Object.assign(noRole, { auth: { getClaims: jest.fn().mockResolvedValue({ data: { claims: { sub: 'ordinary-user', aal: 'aal2' } } }) } })
  await expect(requirePlatformAdmin(noRole as never)).rejects.toThrow('redirect:/unauthorized')
})
