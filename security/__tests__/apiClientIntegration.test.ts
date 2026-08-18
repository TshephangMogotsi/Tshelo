import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('shared API client integration', () => {
  const client = read('shared/api-client/client.ts')
  const tokenProvider = read('shared/api-client/supabase-auth.ts')
  const mobile = read('lib/api.ts')
  const admin = read('admin/lib/api-client.ts')

  it('exposes every implemented route through typed resource methods', () => {
    for (const path of [
      '/api/v1/users',
      '/api/v1/funds',
      '/api/v1/events',
      '/api/v1/contributions',
      '/api/v1/admin/support-tickets',
      '/api/v1/admin/audit',
      '/api/v1/admin/users/moderate',
      '/api/v1/admin/funds/moderate',
      '/api/v1/admin/platform-admins',
    ]) {
      expect(client).toContain(path)
    }
  })

  it('retries authentication once through Supabase session refresh', () => {
    expect(client).toContain('response.status === 401')
    expect(client).toContain('options.refreshAccessToken()')
    expect(client.match(/options\.refreshAccessToken\(\)/g)).toHaveLength(1)
    expect(tokenProvider).toContain('auth.getSession()')
    expect(tokenProvider).toContain('auth.refreshSession()')
    expect(tokenProvider).not.toContain('refresh_token')
  })

  it('wires mobile and browser clients to their existing Supabase sessions', () => {
    expect(mobile).toContain("'EXPO_PUBLIC_API_BASE_URL'")
    expect(mobile).toContain('createSupabaseTokenProvider(supabase.auth)')
    expect(admin).toContain('createSupabaseTokenProvider(createClient().auth)')
    expect(admin).toContain('window.location.origin')
  })

  it('never reads a service-role credential in client code', () => {
    const integration = `${client}\n${tokenProvider}\n${mobile}\n${admin}`
    expect(integration).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(integration).not.toContain('SUPABASE_SECRET_KEY')
    expect(integration).not.toContain('service_role')
  })
})
