-- Caller-owned upload sessions bind metadata to a server-generated object key.
-- Finalisation and removal lock the event/session in that order; retries cannot
-- publish discarded uploads or remove a concurrently finalised file.
CREATE TABLE public.event_file_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.users(id),
  file_name text NOT NULL CHECK (char_length(trim(file_name)) BETWEEN 1 AND 255),
  object_path text NOT NULL UNIQUE,
  content_type text NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'discarded')),
  cleanup_by uuid REFERENCES public.users(id),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_file_uploads_pending_event_idx
  ON public.event_file_uploads(event_id, expires_at) WHERE status = 'pending';

ALTER TABLE public.event_file_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_file_uploads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_file_uploads TO authenticated;
CREATE POLICY event_file_uploads_select_owner ON public.event_file_uploads
  FOR SELECT TO authenticated USING (uploaded_by = auth.uid() OR cleanup_by = auth.uid());

-- Preserve any files created after Phase 1 was deployed. They can be removed
-- through the same lifecycle as new files, without moving their storage keys.
INSERT INTO public.event_file_uploads (
  id, event_id, uploaded_by, file_name, object_path, content_type,
  size_bytes, status, created_at
)
SELECT id, event_id, uploaded_by, file_name, object_path, content_type,
  size_bytes, 'published', created_at
FROM public.event_files;

-- Metadata insertion/removal must use the lifecycle functions below. This also
-- prevents direct REST writes from bypassing storage validation.
REVOKE INSERT (event_id, uploaded_by, file_name, object_path, content_type, size_bytes)
  ON public.event_files FROM authenticated;
REVOKE DELETE ON public.event_files FROM authenticated;

CREATE OR REPLACE FUNCTION public.create_event_file_upload(
  p_event_id uuid, p_file_name text, p_content_type text, p_size_bytes bigint
)
RETURNS public.event_file_uploads
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_event public.events%ROWTYPE;
  upload public.event_file_uploads%ROWTYPE;
  extension text;
  reserved_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO target_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR target_event.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'EVENT_FILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.can_view_event_files(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_FILE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF target_event.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'EVENT_FILE_INACTIVE' USING ERRCODE = '23514';
  END IF;
  IF NOT public.can_manage_event_files(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_FILE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  extension := CASE p_content_type WHEN 'application/pdf' THEN 'pdf'
    WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END;
  IF extension IS NULL OR p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 10485760
    OR p_file_name IS NULL OR char_length(trim(p_file_name)) NOT BETWEEN 1 AND 255
    OR p_file_name ~ '[[:cntrl:]/\\]' THEN
    RAISE EXCEPTION 'EVENT_FILE_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT (SELECT count(*) FROM public.event_files WHERE event_id = p_event_id)
    + (SELECT count(*) FROM public.event_file_uploads
       WHERE event_id = p_event_id AND status = 'pending' AND expires_at > now())
    INTO reserved_count;
  IF reserved_count >= 10 THEN
    RAISE EXCEPTION 'EVENT_FILE_LIMIT_REACHED' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.event_file_uploads (event_id, uploaded_by, file_name, object_path, content_type, size_bytes)
  VALUES (p_event_id, auth.uid(), trim(p_file_name),
    p_event_id::text || '/' || auth.uid()::text || '/' || gen_random_uuid()::text || '.' || extension,
    p_content_type, p_size_bytes)
  RETURNING * INTO upload;
  RETURN upload;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_event_file_upload(p_event_id uuid, p_upload_id uuid)
RETURNS public.event_files
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_event public.events%ROWTYPE;
  upload public.event_file_uploads%ROWTYPE;
  saved_file public.event_files%ROWTYPE;
  object_metadata jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO target_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  SELECT * INTO upload FROM public.event_file_uploads
    WHERE id = p_upload_id AND event_id = p_event_id AND uploaded_by = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_FILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.can_view_event_files(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_FILE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF upload.status = 'published' THEN
    SELECT * INTO saved_file FROM public.event_files WHERE id = upload.id;
    RETURN saved_file;
  END IF;
  IF upload.status <> 'pending' OR upload.expires_at <= now() THEN
    RAISE EXCEPTION 'EVENT_FILE_UPLOAD_EXPIRED' USING ERRCODE = '23514';
  END IF;
  IF target_event.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'EVENT_FILE_INACTIVE' USING ERRCODE = '23514';
  END IF;
  IF NOT public.can_manage_event_files(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_FILE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  -- Storage metadata is read-only here. Bytes are uploaded/deleted exclusively
  -- through the Storage API. A signed URL alone is not proof of an upload.
  SELECT metadata INTO object_metadata FROM storage.objects
    WHERE bucket_id = 'event-files' AND name = upload.object_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_FILE_UPLOAD_MISSING' USING ERRCODE = '22023';
  END IF;
  IF object_metadata->>'mimetype' IS DISTINCT FROM upload.content_type
    OR object_metadata->>'size' IS NULL
    OR (object_metadata->>'size') !~ '^[0-9]{1,8}$' THEN
    RAISE EXCEPTION 'EVENT_FILE_UPLOAD_MISMATCH' USING ERRCODE = '22023';
  END IF;
  IF (object_metadata->>'size')::bigint <> upload.size_bytes THEN
    RAISE EXCEPTION 'EVENT_FILE_UPLOAD_MISMATCH' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.event_files (id, event_id, uploaded_by, file_name, object_path, content_type, size_bytes)
  VALUES (upload.id, upload.event_id, upload.uploaded_by, upload.file_name,
    upload.object_path, upload.content_type, upload.size_bytes)
  RETURNING * INTO saved_file;
  UPDATE public.event_file_uploads SET status = 'published' WHERE id = upload.id;
  RETURN saved_file;
END;
$$;

-- Pending-only cleanup is safe to call after a failed or uncertain finalise:
-- a concurrent success returns NULL and its published object is left intact.
-- The durable discarded state makes physical deletion retryable even if the
-- event completes or the caller loses their manager grant during cleanup.
CREATE OR REPLACE FUNCTION public.prepare_event_file_removal(
  p_event_id uuid, p_file_id uuid, p_pending_only boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  upload public.event_file_uploads%ROWTYPE;
  event_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT status INTO event_status FROM public.events WHERE id = p_event_id FOR UPDATE;
  SELECT * INTO upload FROM public.event_file_uploads
    WHERE id = p_file_id AND event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_pending_only THEN RETURN NULL; END IF;
    RAISE EXCEPTION 'EVENT_FILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_pending_only AND (upload.uploaded_by <> auth.uid() OR upload.status = 'published') THEN
    RETURN NULL;
  END IF;
  IF upload.status = 'discarded' THEN
    IF upload.cleanup_by = auth.uid() THEN RETURN upload.object_path; END IF;
    RAISE EXCEPTION 'EVENT_FILE_FORBIDDEN' USING ERRCODE = '42501';
  ELSIF upload.status = 'pending' THEN
    IF upload.uploaded_by <> auth.uid() THEN
      RAISE EXCEPTION 'EVENT_FILE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT public.can_view_event_files(p_event_id) THEN
      RAISE EXCEPTION 'EVENT_FILE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF event_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'EVENT_FILE_INACTIVE' USING ERRCODE = '23514';
    END IF;
    IF NOT public.can_manage_event_files(p_event_id) THEN
      RAISE EXCEPTION 'EVENT_FILE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.event_files WHERE id = upload.id;
  END IF;
  UPDATE public.event_file_uploads SET status = 'discarded', cleanup_by = auth.uid() WHERE id = upload.id;
  RETURN upload.object_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.event_file_storage_access(p_object_path text, p_action text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_file_uploads AS upload
    WHERE upload.object_path = p_object_path AND CASE p_action
      WHEN 'insert' THEN upload.status = 'pending' AND upload.uploaded_by = auth.uid()
        AND upload.expires_at > now() AND public.can_manage_event_files(upload.event_id)
      WHEN 'select' THEN
        (upload.status = 'published' AND public.can_view_event_files(upload.event_id)
          AND EXISTS (SELECT 1 FROM public.event_files WHERE id = upload.id))
        OR (upload.status = 'pending' AND upload.uploaded_by = auth.uid())
        OR (upload.status = 'discarded' AND upload.cleanup_by = auth.uid())
      WHEN 'delete' THEN upload.status = 'discarded' AND upload.cleanup_by = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM public.event_files WHERE object_path = p_object_path)
      ELSE false END
  );
$$;

DROP POLICY event_files_insert_manager ON storage.objects;
DROP POLICY event_files_select_participant ON storage.objects;
DROP POLICY event_files_delete_manager ON storage.objects;
CREATE POLICY event_files_insert_manager ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-files' AND public.event_file_storage_access(name, 'insert'));
CREATE POLICY event_files_select_participant ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'event-files' AND public.event_file_storage_access(name, 'select'));
CREATE POLICY event_files_delete_manager ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-files' AND public.event_file_storage_access(name, 'delete'));

REVOKE ALL ON FUNCTION public.create_event_file_upload(uuid, text, text, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_event_file_upload(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prepare_event_file_removal(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.event_file_storage_access(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_event_file_upload(uuid, text, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_event_file_upload(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_event_file_removal(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.event_file_storage_access(text, text) TO authenticated;

COMMENT ON TABLE public.event_file_uploads IS
  'Server-owned upload sessions and durable cleanup claims. Discarded paths can never be finalised. Retain until the signed upload URL expires and Storage cleanup is confirmed.';
