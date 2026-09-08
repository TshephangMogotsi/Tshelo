-- First-class files for an event workspace. Metadata is stored separately from
-- announcements so participants can find enduring event resources in one
-- place. File bytes remain private in Supabase Storage.

CREATE TABLE public.event_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.users(id),
  file_name character varying(255) NOT NULL,
  object_path text NOT NULL UNIQUE,
  content_type character varying(100) NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_files_file_name_length
    CHECK (char_length(trim(file_name)) BETWEEN 1 AND 255),
  CONSTRAINT event_files_object_path_length
    CHECK (char_length(object_path) BETWEEN 1 AND 500),
  CONSTRAINT event_files_content_type_valid
    CHECK (content_type IN (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    )),
  CONSTRAINT event_files_size_valid
    CHECK (size_bytes BETWEEN 1 AND 10485760),
  CONSTRAINT event_files_object_path_scope
    CHECK (
      object_path ~* (
        '^' || event_id::text || '/' || uploaded_by::text ||
        '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$'
      )
    ),
  CONSTRAINT event_files_extension_matches_type
    CHECK (
      (content_type = 'application/pdf' AND lower(object_path) ~ '\.pdf$')
      OR (content_type = 'image/jpeg' AND lower(object_path) ~ '\.jpg$')
      OR (content_type = 'image/png' AND lower(object_path) ~ '\.png$')
      OR (content_type = 'image/webp' AND lower(object_path) ~ '\.webp$')
    )
);

CREATE INDEX event_files_event_created_idx
  ON public.event_files(event_id, created_at DESC, id DESC);

COMMENT ON TABLE public.event_files IS
  'Private event-wide file metadata visible to event participants and manageable by event content administrators.';
COMMENT ON COLUMN public.event_files.object_path IS
  'Object key in the private event-files bucket: <event UUID>/<uploader UUID>/<random UUID>.<extension>.';

CREATE TRIGGER tr_event_files_updated_at
  BEFORE UPDATE ON public.event_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Event files use the same audience as announcements: the event creator,
-- active organisers, joined event guests, and members of the linked fund.
CREATE OR REPLACE FUNCTION public.can_view_event_files(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events AS target_event
    WHERE target_event.id = target_event_id
      AND target_event.deleted_at IS NULL
      AND (
        target_event.creator_id = auth.uid()
        OR public.is_event_organiser(target_event.id)
        OR public.is_event_guest(target_event.id)
        OR (
          target_event.linked_fund_id IS NOT NULL
          AND public.is_fund_member(target_event.linked_fund_id)
        )
      )
  );
$$;

-- Keep the stable permission key used by existing grants. In the UI this
-- capability is now described as managing event updates and files.
CREATE OR REPLACE FUNCTION public.can_manage_event_files(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events AS target_event
    WHERE target_event.id = target_event_id
      AND target_event.deleted_at IS NULL
      AND target_event.status = 'active'
      AND (
        target_event.creator_id = auth.uid()
        OR public.is_event_organiser(target_event.id)
        OR public.has_linked_event_fund_permission(
          target_event.id,
          'post_event_announcements'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_event_files(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_event_files(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_event_files(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_event_files(uuid)
  TO authenticated, service_role;

-- Serialise inserts for each event so two simultaneous uploads cannot both
-- cross the ten-file event limit.
CREATE OR REPLACE FUNCTION public.enforce_event_file_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('event_files'),
    hashtext(NEW.event_id::text)
  );

  IF (
    SELECT count(*)
    FROM public.event_files AS existing_file
    WHERE existing_file.event_id = NEW.event_id
  ) >= 10 THEN
    RAISE EXCEPTION 'EVENT_FILE_LIMIT_REACHED'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_event_file_limit()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_event_file_limit
  BEFORE INSERT ON public.event_files
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_file_limit();

ALTER TABLE public.event_files ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_files FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.event_files TO authenticated;
GRANT INSERT (
  event_id,
  uploaded_by,
  file_name,
  object_path,
  content_type,
  size_bytes
) ON TABLE public.event_files TO authenticated;
GRANT UPDATE (file_name) ON TABLE public.event_files TO authenticated;
GRANT DELETE ON TABLE public.event_files TO authenticated;

CREATE POLICY event_files_select_participant
  ON public.event_files
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_view_event_files(event_id));

CREATE POLICY event_files_insert_manager
  ON public.event_files
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.can_manage_event_files(event_id)
  );

CREATE POLICY event_files_update_manager
  ON public.event_files
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.can_manage_event_files(event_id))
  WITH CHECK (public.can_manage_event_files(event_id));

CREATE POLICY event_files_delete_manager
  ON public.event_files
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.can_manage_event_files(event_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-files',
  'event-files',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Object key format: <event UUID>/<uploading user UUID>/<random UUID>.<extension>.
-- Requiring a published metadata row on reads keeps abandoned uploads hidden.
DROP POLICY IF EXISTS event_files_insert_manager ON storage.objects;
DROP POLICY IF EXISTS event_files_select_participant ON storage.objects;
DROP POLICY IF EXISTS event_files_delete_manager ON storage.objects;

CREATE POLICY event_files_insert_manager ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-files'
    AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.can_manage_event_files(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY event_files_select_participant ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'event-files'
    AND EXISTS (
      SELECT 1
      FROM public.event_files AS published_file
      WHERE published_file.object_path = name
        AND public.can_view_event_files(published_file.event_id)
    )
  );

CREATE POLICY event_files_delete_manager ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-files'
    AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$'
    AND public.can_manage_event_files(((storage.foldername(name))[1])::uuid)
  );

UPDATE public.fund_permission_definitions
SET label = 'Manage event updates and files',
    description = 'Publish event updates and manage shared files for the linked event.'
WHERE permission_key = 'post_event_announcements';
