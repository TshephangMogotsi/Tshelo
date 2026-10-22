import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const workflow = fs.readFileSync(path.join(root, '.github/workflows/verify.yml'), 'utf8')

describe('release verification workflow', () => {
  it('uses the checked-in Supabase configuration without overwriting it', () => {
    expect(fs.existsSync(path.join(root, 'supabase/config.toml'))).toBe(true)
    expect(workflow).toContain('run: test -f supabase/config.toml')
    expect(workflow).not.toMatch(/run:\s*supabase init\b/)
    expect(workflow).toContain('run: supabase start')
  })

  it('runs database assertions only against the disposable local database', () => {
    const databaseCommands = workflow.match(/psql\b[\s\S]*?--file\s+\S+/g) ?? []
    expect(databaseCommands.length).toBeGreaterThanOrEqual(2)
    for (const command of databaseCommands) {
      expect(command).toContain('--host 127.0.0.1')
      expect(command).toContain('--port 54322')
      expect(command).toContain('--set ON_ERROR_STOP=1')
      expect(command).toMatch(/--file supabase\/tests\/[\w_]+\.sql$/)
    }
    expect(workflow).not.toContain('--linked')
    expect(workflow).not.toContain('supabase db push')
    expect(workflow).toContain('supabase/tests/fund_admin_permission_matrix.sql')
    expect(workflow).toContain('supabase/tests/api_v1_boundaries.sql')
  })

  it('keeps the high-severity audit gate mandatory', () => {
    expect(workflow).toContain('run: npm audit --audit-level=high')
    expect(workflow).not.toContain('continue-on-error')
    expect(workflow).not.toMatch(/npm audit[^\n]*\|\|/)
  })
})
