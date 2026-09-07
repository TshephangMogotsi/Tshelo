-- Private PDF and image attachments for event announcements. Object metadata
-- lives with the announcement; the bytes remain in private Storage and are
-- readable only by event-announcement participants.

ALTER TABLE public.event_announcements
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_announcements_attachments_array'
      AND conrelid = 'public.event_announcements'::regclass
  ) THEN
    ALTER TABLE public.event_announcements
      ADD CONSTRAINT event_announcements_attachments_array
      CHECK (jsonb_typeof(attachments) = 'array');
  END IF;
END;
$$;

COMMENT ON COLUMN public.event_announcements.attachments IS
  'Private event-announcement attachment metadata. Files are stored in the event-announcement-files bucket.';

GRANT INSERT (event_id, author_id, title, body, attachments)
  ON TABLE public.event_announcements TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-announcement-files',
  'event-announcement-files',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Object key format: <event UUID>/<uploading user UUID>/<random filename>.
DROP POLICY IF EXISTS event_announcement_files_insert_manager ON storage.objects;
DROP POLICY IF EXISTS event_announcement_files_select_participant ON storage.objects;
DROP POLICY IF EXISTS event_announcement_files_delete_manager ON storage.objects;

CREATE POLICY event_announcement_files_insert_manager ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-announcement-files'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.can_manage_event_announcements(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY event_announcement_files_select_participant ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'event-announcement-files'
    AND public.can_view_event_announcements(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY event_announcement_files_delete_manager ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-announcement-files'
    AND public.can_manage_event_announcements(((storage.foldername(name))[1])::uuid)
  );
