import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260908100000_event_files.sql'),
  'utf8',
)
const lifecycle = fs.readFileSync(path.join(root, 'supabase/migrations/20260908110000_event_file_upload_lifecycle.sql'), 'utf8')

describe('event files database foundation', () => {
  it('creates constrained event-scoped metadata with deterministic ordering', () => {
    expect(migration).toContain('CREATE TABLE public.event_files')
    expect(migration).toContain('object_path text NOT NULL UNIQUE')
    expect(migration).toContain('size_bytes BETWEEN 1 AND 10485760')
    expect(migration).toContain('event_files_extension_matches_type')
    expect(migration).toContain('ON public.event_files(event_id, created_at DESC, id DESC)')
    expect(migration).toContain('CREATE TRIGGER enforce_event_file_limit')
    expect(migration).toContain(">= 10")
  })

  it('keeps file bytes private and limited to supported media', () => {
    expect(migration).toContain("'event-files',\n  'event-files',\n  false")
    expect(migration).toContain("ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']")
    expect(migration).toContain('file_size_limit = EXCLUDED.file_size_limit')
    expect(migration).toContain('event_files_insert_manager ON storage.objects')
    expect(migration).toContain('event_files_select_participant ON storage.objects')
    expect(migration).toContain('event_files_delete_manager ON storage.objects')
  })

  it('matches event participation reads and stable content-management grants', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.can_view_event_files')
    expect(migration).toContain('public.is_event_organiser(target_event.id)')
    expect(migration).toContain('public.is_event_guest(target_event.id)')
    expect(migration).toContain('public.is_fund_member(target_event.linked_fund_id)')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.can_manage_event_files')
    expect(migration).toContain("'post_event_announcements'")
    expect(migration).toContain("target_event.status = 'active'")
  })

  it('preserves the permission key while expanding its displayed meaning', () => {
    expect(migration).toContain("WHERE permission_key = 'post_event_announcements'")
    expect(migration).toContain("label = 'Manage event updates and files'")
    expect(migration).not.toContain("permission_key = 'manage_event_files'")
  })

  it('closes direct insert/delete bypasses and keeps upload sessions caller-owned', () => {
    expect(lifecycle).toContain('ALTER TABLE public.event_file_uploads ENABLE ROW LEVEL SECURITY')
    expect(lifecycle).toContain('REVOKE ALL ON public.event_file_uploads FROM PUBLIC, anon, authenticated')
    expect(lifecycle).toContain('GRANT SELECT ON public.event_file_uploads TO authenticated')
    expect(lifecycle).toContain('uploaded_by = auth.uid() OR cleanup_by = auth.uid()')
    expect(lifecycle).toMatch(/REVOKE INSERT \(event_id, uploaded_by, file_name, object_path, content_type, size_bytes\)\s+ON public.event_files FROM authenticated/)
    expect(lifecycle).toContain('REVOKE DELETE ON public.event_files FROM authenticated')
  })

  it('replaces all legacy storage policies with lifecycle- and bucket-scoped policies', () => {
    for (const action of ['insert', 'select', 'delete']) {
      const policy = action === 'select' ? 'participant' : 'manager'
      expect(lifecycle).toContain(`DROP POLICY event_files_${action}_${policy} ON storage.objects`)
      expect(lifecycle).toContain(`bucket_id = 'event-files' AND public.event_file_storage_access(name, '${action}')`)
    }
    expect(lifecycle).not.toMatch(/CREATE POLICY[^;]+FOR (?:UPDATE|ALL)/)
    expect(lifecycle).toContain("upload.status = 'pending' AND upload.uploaded_by = auth.uid()")
    expect(lifecycle).toContain("upload.status = 'discarded' AND upload.cleanup_by = auth.uid()")
    expect(lifecycle).toContain('NOT EXISTS (SELECT 1 FROM public.event_files WHERE object_path = p_object_path)')
  })

  it('locks event then session and validates stored metadata before publication', () => {
    const finalize = lifecycle.split('FUNCTION public.finalize_event_file_upload')[1].split('$$;')[0]
    expect(finalize.indexOf('public.events WHERE id = p_event_id FOR UPDATE')).toBeLessThan(finalize.indexOf('SELECT * INTO upload'))
    expect(finalize).toContain('id = p_upload_id AND event_id = p_event_id AND uploaded_by = auth.uid() FOR UPDATE')
    expect(finalize).toContain("target_event.status IS DISTINCT FROM 'active'")
    expect(finalize).toContain("WHERE bucket_id = 'event-files' AND name = upload.object_path")
    expect(finalize).toContain("object_metadata->>'mimetype' IS DISTINCT FROM upload.content_type")
    expect(finalize).toContain("(object_metadata->>'size')::bigint <> upload.size_bytes")
    expect(finalize.indexOf('EVENT_FILE_UPLOAD_MISMATCH')).toBeLessThan(finalize.indexOf('INSERT INTO public.event_files'))
    expect(lifecycle).toContain("event_id = p_event_id AND status = 'pending' AND expires_at > now()")
    expect(lifecycle).toContain('IF reserved_count >= 10 THEN')
  })

  it('preserves legacy files and makes uncertain-finalisation cleanup race-safe', () => {
    expect(lifecycle).toMatch(/INSERT INTO public.event_file_uploads[\s\S]*?'published', created_at\s+FROM public.event_files/)
    expect(lifecycle).toContain("IF p_pending_only AND (upload.uploaded_by <> auth.uid() OR upload.status = 'published')")
    expect(lifecycle).toContain("SET status = 'discarded', cleanup_by = auth.uid()")
    expect(lifecycle).not.toMatch(/(?:DELETE FROM|UPDATE) storage.objects/)
  })

  it('hardens every lifecycle function against anonymous calls and search-path injection', () => {
    for (const signature of ['create_event_file_upload(uuid, text, text, bigint)', 'finalize_event_file_upload(uuid, uuid)', 'prepare_event_file_removal(uuid, uuid, boolean)', 'event_file_storage_access(text, text)']) {
      expect(lifecycle).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon`)
      expect(lifecycle).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated`)
    }
    expect(lifecycle.match(/SECURITY DEFINER SET search_path = public/g)).toHaveLength(4)
    expect(lifecycle.match(/IF auth.uid\(\) IS NULL THEN/g)).toHaveLength(3)
  })
})
