-- Insert in-app notifications for every signed-in participant. The existing
-- notifications webhook turns these same rows into push notifications.
CREATE OR REPLACE FUNCTION public.notify_event_announcement_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_name text;
  linked_fund_id uuid;
BEGIN
  SELECT e.name, e.linked_fund_id
    INTO event_name, linked_fund_id
  FROM public.events e
  WHERE e.id = NEW.event_id;

  INSERT INTO public.notifications (user_id, fund_id, type, title, body, data)
  SELECT
    recipients.user_id,
    linked_fund_id,
    'event_announcement'::public.notification_type,
    left(coalesce(event_name, 'Event') || ': ' || NEW.title, 200),
    NEW.body,
    jsonb_build_object(
      'kind', 'event_announcement',
      'eventId', NEW.event_id,
      'announcementId', NEW.id
    )
  FROM (
    SELECT e.creator_id AS user_id
    FROM public.events e
    WHERE e.id = NEW.event_id

    UNION

    SELECT eo.user_id
    FROM public.event_organisers eo
    WHERE eo.event_id = NEW.event_id
      AND eo.status = 'active'
      AND eo.user_id IS NOT NULL

    UNION

    SELECT eg.user_id
    FROM public.event_guests eg
    WHERE eg.event_id = NEW.event_id
      AND eg.user_id IS NOT NULL

    UNION

    SELECT fm.user_id
    FROM public.events e
    JOIN public.fund_members fm
      ON fm.fund_id = e.linked_fund_id
     AND fm.status = 'joined'
    WHERE e.id = NEW.event_id
      AND fm.user_id IS NOT NULL
  ) recipients
  WHERE recipients.user_id IS NOT NULL
    AND recipients.user_id <> NEW.author_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_event_announcement_insert()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_event_announcement_insert
  AFTER INSERT ON public.event_announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_announcement_insert();
