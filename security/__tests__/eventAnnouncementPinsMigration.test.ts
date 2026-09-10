import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260909120000_event_announcement_pins.sql'), 'utf8')

describe('pinned event announcements', () => {
  it('permits at most one pinned update per event', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false')
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS event_announcements_one_pinned_per_event_idx')
    expect(migration).toContain('WHERE is_pinned')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('SET is_pinned = false')
  })

  it('keeps pin changes behind the existing update-management permission', () => {
    expect(migration).toContain('public.can_manage_event_announcements(p_event_id)')
    expect(migration).toContain('EVENT_ANNOUNCEMENT_FORBIDDEN')
    expect(migration).toContain('EVENT_ANNOUNCEMENT_INACTIVE')
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain('SET search_path = public, pg_temp')
    expect(migration).toContain('FROM PUBLIC, anon')
    expect(migration).toContain('TO authenticated')
  })
})

