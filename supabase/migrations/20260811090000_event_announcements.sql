-- Event announcements give the event creator and active organisers a shared,
-- read-only-for-participants channel for important event updates. Comments are
-- deliberately not modelled yet; they can be added without changing this
-- announcement record or its audience rules.

CREATE TABLE public.event_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id),
  author_name character varying(100) NOT NULL DEFAULT 'Event admin',
  title character varying(120) NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_announcements_title_length
    CHECK (char_length(trim(title)) BETWEEN 3 AND 120),
  CONSTRAINT event_announcements_body_length
    CHECK (char_length(trim(body)) BETWEEN 3 AND 2000)
);

CREATE INDEX event_announcements_event_created_idx
  ON public.event_announcements(event_id, created_at DESC);

COMMENT ON TABLE public.event_announcements IS
  'Admin-authored event updates visible to event participants and linked fund members';

ALTER TABLE public.event_announcements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_announcements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.event_announcements TO authenticated;
GRANT INSERT (event_id, author_id, title, body)
  ON TABLE public.event_announcements TO authenticated;
GRANT UPDATE (title, body)
  ON TABLE public.event_announcements TO authenticated;
GRANT DELETE ON TABLE public.event_announcements TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_event_announcements(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = target_event_id
      AND e.deleted_at IS NULL
      AND (
        e.creator_id = auth.uid()
        OR public.is_event_organiser(e.id)
        OR public.is_event_guest(e.id)
        OR (
          e.linked_fund_id IS NOT NULL
          AND public.is_fund_member(e.linked_fund_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_event_announcements(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = target_event_id
      AND e.deleted_at IS NULL
      AND (
        e.creator_id = auth.uid()
        OR public.is_event_organiser(e.id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_event_announcements(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_event_announcements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_event_announcements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_event_announcements(uuid) TO authenticated;

CREATE POLICY event_announcements_select_participant
  ON public.event_announcements
  FOR SELECT TO authenticated
  USING (public.can_view_event_announcements(event_id));

CREATE POLICY event_announcements_insert_admin
  ON public.event_announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_manage_event_announcements(event_id)
  );

CREATE POLICY event_announcements_update_admin
  ON public.event_announcements
  FOR UPDATE TO authenticated
  USING (public.can_manage_event_announcements(event_id))
  WITH CHECK (public.can_manage_event_announcements(event_id));

CREATE POLICY event_announcements_delete_admin
  ON public.event_announcements
  FOR DELETE TO authenticated
  USING (public.can_manage_event_announcements(event_id));

CREATE OR REPLACE FUNCTION public.set_event_announcement_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := auth.uid();
    SELECT coalesce(nullif(trim(u.name), ''), 'Event admin')
      INTO NEW.author_name
    FROM public.users u
    WHERE u.id = auth.uid();
    NEW.author_name := coalesce(NEW.author_name, 'Event admin');
    NEW.created_at := now();
  ELSE
    IF NEW.event_id IS DISTINCT FROM OLD.event_id
      OR NEW.author_id IS DISTINCT FROM OLD.author_id THEN
      RAISE EXCEPTION 'Announcement ownership fields cannot be changed';
    END IF;
    NEW.author_name := OLD.author_name;
    NEW.created_at := OLD.created_at;
  END IF;

  NEW.title := trim(NEW.title);
  NEW.body := trim(NEW.body);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_event_announcement_metadata() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER set_event_announcement_metadata
  BEFORE INSERT OR UPDATE ON public.event_announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_event_announcement_metadata();

-- A joined member of a linked fund is an event participant and must be able to
-- open the Event Detail screen where announcements are presented.
DROP POLICY IF EXISTS events_select_related ON public.events;
CREATE POLICY events_select_related ON public.events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      creator_id = auth.uid()
      OR public.is_event_organiser(id)
      OR public.is_event_guest(id)
      OR (
        linked_fund_id IS NOT NULL
        AND public.is_fund_member(linked_fund_id)
      )
    )
  );
