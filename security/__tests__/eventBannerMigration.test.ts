import fs from 'fs'
import path from 'path'

const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260908120000_event_banners.sql'), 'utf8')

describe('private event banner migration', () => {
  it('constrains banners to one published image per event without adding public URLs', () => {
    expect(migration).toContain('ADD COLUMN is_banner boolean NOT NULL DEFAULT false')
    expect(migration).toContain("NOT is_banner OR content_type IN ('image/jpeg', 'image/png', 'image/webp')")
    expect(migration).toContain('ON public.event_files(event_id) WHERE is_banner')
    expect(migration).not.toContain('cover_photo_url')
    expect(migration).not.toMatch(/GRANT UPDATE|CREATE POLICY|INSERT INTO storage.buckets/)
  })
  it('requires current permissions, an active event and same-event images before atomic replacement', () => {
    expect(migration).toContain('SECURITY DEFINER SET search_path = public')
    expect(migration).toContain('auth.uid() IS NULL')
    expect(migration).toContain('WHERE id = p_event_id FOR UPDATE')
    expect(migration).toContain('NOT public.can_manage_event_files(p_event_id)')
    expect(migration).toContain("target_event.status IS DISTINCT FROM 'active'")
    expect(migration).toContain('WHERE id = p_file_id AND event_id = p_event_id')
    expect(migration.indexOf('EVENT_BANNER_INVALID')).toBeLessThan(migration.indexOf('UPDATE public.event_files'))
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.set_event_banner(uuid, uuid) FROM PUBLIC, anon')
    expect(migration).not.toMatch(/DELETE FROM/)
  })
})
