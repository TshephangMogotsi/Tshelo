import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260909110000_event_schedule_details.sql'), 'utf8')
const validation = fs.readFileSync(path.join(root, 'admin/lib/api/validation.ts'), 'utf8')
const records = fs.readFileSync(path.join(root, 'admin/lib/data/api-records.ts'), 'utf8')

describe('event schedule metadata', () => {
  it('stores an IANA zone and ordered RSVP deadline with safe defaults', () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'Africa/Gaborone'")
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS rsvp_deadline date')
    expect(migration).toContain('events_time_zone_length')
    expect(migration).toContain('rsvp_deadline <= event_date')
    expect(migration).toContain('FROM pg_catalog.pg_timezone_names')
    expect(migration).toContain('EVENT_TIME_ZONE_INVALID')
  })

  it('enforces coherent start/end schedules at the database boundary', () => {
    expect(migration).toContain('CREATE TRIGGER enforce_event_schedule_details')
    expect(migration).toContain('NEW.event_end_date < NEW.event_date')
    expect(migration).toContain('NEW.event_end_time < NEW.event_time')
    expect(migration).toContain('EVENT_SCHEDULE_INVALID')
  })

  it('closes attendee responses after the deadline in the event time zone', () => {
    expect(migration).toContain('CREATE TRIGGER enforce_event_rsvp_deadline')
    expect(migration).toContain('NEW.user_id IS DISTINCT FROM caller_id')
    expect(migration).toContain('target_event.creator_id = caller_id')
    expect(migration).toContain('public.is_event_organiser(NEW.event_id)')
    expect(migration).toContain('CURRENT_TIMESTAMP AT TIME ZONE target_event.time_zone')
    expect(migration).toContain('EVENT_RSVP_DEADLINE_PASSED')
    expect(migration).toContain('FROM PUBLIC, anon, authenticated')
  })

  it('validates and maps the new fields through the typed API', () => {
    expect(validation).toContain("'time_zone', 'rsvp_deadline'")
    expect(validation).toContain('new Intl.DateTimeFormat')
    expect(validation).toContain('RSVP deadline cannot be after the event date')
    expect(records).toContain('time_zone: row.time_zone')
    expect(records).toContain('rsvp_deadline: row.rsvp_deadline')
  })
})
