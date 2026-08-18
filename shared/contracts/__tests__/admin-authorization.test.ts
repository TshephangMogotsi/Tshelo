import {
  canPlatformAdminPerform,
  isPlatformAdminRole,
  PLATFORM_ADMIN_OPERATIONS,
  PLATFORM_ADMIN_ROLES,
} from '../admin'

describe('platform-admin authorization policy', () => {
  it('allows support staff to update tickets but not moderate platform data', () => {
    expect(canPlatformAdminPerform('support', 'support.update')).toBe(true)
    expect(canPlatformAdminPerform('support', 'users.moderate')).toBe(false)
    expect(canPlatformAdminPerform('support', 'funds.moderate')).toBe(false)
  })

  it('allows operations staff to moderate users and funds', () => {
    expect(canPlatformAdminPerform('operations', 'users.moderate')).toBe(true)
    expect(canPlatformAdminPerform('operations', 'funds.moderate')).toBe(true)
    expect(canPlatformAdminPerform('operations', 'platform_admins.manage')).toBe(false)
  })

  it('keeps finance read-only until a finance mutation is explicitly defined', () => {
    for (const operation of PLATFORM_ADMIN_OPERATIONS) {
      expect(canPlatformAdminPerform('finance', operation)).toBe(false)
    }
  })

  it('reserves platform-admin management for super admins', () => {
    expect(canPlatformAdminPerform('super_admin', 'platform_admins.manage')).toBe(true)
  })

  it('validates persisted role values against the closed role list', () => {
    for (const role of PLATFORM_ADMIN_ROLES) {
      expect(isPlatformAdminRole(role)).toBe(true)
    }
    expect(isPlatformAdminRole('owner')).toBe(false)
    expect(isPlatformAdminRole(null)).toBe(false)
  })
})
