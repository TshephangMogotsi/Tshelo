import fs from 'fs'
import path from 'path'

const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260909140000_event_banner_focal_points.sql'), 'utf8')

describe('event banner focal-point migration', () => {
  it('stores bounded normalized coordinates without changing or exposing image bytes', () => {
    expect(migration).toContain('ADD COLUMN banner_focal_x numeric(5,4) NOT NULL DEFAULT 0.5')
    expect(migration).toContain('ADD COLUMN banner_focal_y numeric(5,4) NOT NULL DEFAULT 0.5')
    expect(migration).toContain('CHECK (banner_focal_x BETWEEN 0 AND 1)')
    expect(migration).toContain('CHECK (banner_focal_y BETWEEN 0 AND 1)')
    expect(migration).not.toMatch(/INSERT INTO storage|UPDATE storage|DELETE FROM storage|GRANT UPDATE/)
  })

  it('reuses the existing locked banner authorization and restricts the new RPC', () => {
    expect(migration).toContain('PERFORM public.set_event_banner(p_event_id, p_file_id)')
    expect(migration).toContain("RAISE EXCEPTION 'EVENT_BANNER_FOCAL_INVALID'")
    expect(migration).toContain('WHERE id = p_file_id AND event_id = p_event_id')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.set_event_banner_focal_point(uuid, uuid, numeric, numeric)')
    expect(migration).toContain('TO authenticated')
  })
})
