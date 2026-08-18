import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('API read database migration', () => {
  const migration = read(
    'supabase/migrations/20260817160000_api_read_rls_and_indexes.sql',
  )

  it('adds only SELECT policies for platform-admin relationship reads', () => {
    for (const policy of [
      'platform_admin_read_fund_members',
      'platform_admin_read_event_organisers',
      'platform_admin_read_event_guests',
    ]) {
      expect(migration).toContain(`CREATE POLICY ${policy}`)
    }

    expect(migration.match(/FOR SELECT/g)).toHaveLength(3)
    expect(migration.match(/public\.is_platform_admin\(\)/g)).toHaveLength(3)
    expect(migration).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)/)
    expect(migration).not.toContain('service_role')
  })

  it('indexes deterministic default list ordering for every API list table', () => {
    for (const table of [
      'users',
      'funds',
      'events',
      'contributions',
      'support_tickets',
      'platform_admin_audit_log',
    ]) {
      expect(migration).toContain(`ON public.${table} (created_at DESC, id DESC)`)
    }
  })

  it('indexes the relationship filters used by typed data services', () => {
    expect(migration).toContain('ON public.fund_members (user_id, fund_id)')
    expect(migration).toContain('ON public.event_organisers (user_id, event_id)')
    expect(migration).toContain('ON public.event_guests (user_id, event_id)')
    expect(migration).toContain("WHERE status NOT IN ('left', 'removed', 'declined', 'pending')")
    expect(migration).toContain("WHERE status NOT IN ('left', 'removed')")
  })
})
