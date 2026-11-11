-- Queue routine reminders once per morning. A database job only inserts normal
-- notification rows; the existing webhook delivers them to the inbox and, if
-- enabled by the member, Expo push.

CREATE UNIQUE INDEX IF NOT EXISTS notifications_routine_reminder_key_unique
  ON public.notifications ((data ->> 'reminderKey'))
  WHERE data ? 'reminderKey';

CREATE OR REPLACE FUNCTION public.queue_notification_reminders(p_today date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Contribution deadlines: one week, three days, and one day beforehand.
  INSERT INTO public.notifications (user_id, fund_id, type, title, body, data)
  SELECT
    member_id,
    fund_id,
    'deadline_reminder'::public.notification_type,
    'Contribution deadline approaching',
    CASE days_until
      WHEN 1 THEN fund_title || ' closes for contributions tomorrow.'
      ELSE fund_title || ' closes for contributions in ' || days_until || ' days.'
    END,
    jsonb_build_object(
      'kind', 'deadline_reminder',
      'fundId', fund_id,
      'daysUntil', days_until,
      'reminderKey', 'deadline:' || fund_id::text || ':' || member_id::text || ':' || p_today::text
    )
  FROM (
    SELECT
      fund.id AS fund_id,
      fund.title AS fund_title,
      member.user_id AS member_id,
      (fund.contribution_deadline - p_today) AS days_until
    FROM public.funds fund
    JOIN public.fund_members member
      ON member.fund_id = fund.id
     AND member.status = 'joined'
    WHERE fund.status = 'active'
      AND fund.deleted_at IS NULL
      AND fund.contribution_deadline IN (p_today + 7, p_today + 3, p_today + 1)
      AND member.user_id IS NOT NULL
  ) due_deadlines
  ON CONFLICT DO NOTHING;

  -- Event dates: one week and one day beforehand. A UNION makes each member
  -- receive one reminder even if they are an organiser, guest, and fund member.
  INSERT INTO public.notifications (user_id, fund_id, type, title, body, data)
  SELECT
    recipient.user_id,
    recipient.fund_id,
    'event_reminder'::public.notification_type,
    'Event reminder',
    CASE recipient.days_until
      WHEN 1 THEN recipient.event_name || ' is tomorrow.'
      ELSE recipient.event_name || ' is in ' || recipient.days_until || ' days.'
    END,
    jsonb_build_object(
      'kind', 'event_reminder',
      'eventId', recipient.event_id,
      'fundId', recipient.fund_id,
      'daysUntil', recipient.days_until,
      'reminderKey', 'event:' || recipient.event_id::text || ':' || recipient.user_id::text || ':' || p_today::text
    )
  FROM (
    SELECT DISTINCT
      event.id AS event_id,
      event.name AS event_name,
      event.linked_fund_id AS fund_id,
      participant.user_id,
      (event.event_date - p_today) AS days_until
    FROM public.events event
    CROSS JOIN LATERAL (
      SELECT event.creator_id AS user_id
      UNION
      SELECT organiser.user_id
      FROM public.event_organisers organiser
      WHERE organiser.event_id = event.id
        AND organiser.status = 'active'
      UNION
      SELECT guest.user_id
      FROM public.event_guests guest
      WHERE guest.event_id = event.id
        AND guest.user_id IS NOT NULL
      UNION
      SELECT member.user_id
      FROM public.fund_members member
      WHERE member.fund_id = event.linked_fund_id
        AND member.status = 'joined'
        AND member.user_id IS NOT NULL
    ) participant
    WHERE event.status = 'active'
      AND event.event_date IN (p_today + 7, p_today + 1)
      AND participant.user_id IS NOT NULL
  ) recipient
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_notification_reminders(date)
  FROM PUBLIC, anon, authenticated;

-- Supabase Cron runs in UTC. 05:05 UTC is 07:05 in Botswana, leaving a
-- predictable morning window while keeping all reminder inserts in-database.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO existing_job_id
    FROM cron.job
    WHERE jobname = 'tshelo-daily-notification-reminders'
    LIMIT 1;

    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;

    PERFORM cron.schedule(
      'tshelo-daily-notification-reminders',
      '5 5 * * *',
      'SELECT public.queue_notification_reminders(CURRENT_DATE);'
    );
  ELSE
    RAISE NOTICE 'pg_cron is not enabled; schedule queue_notification_reminders(CURRENT_DATE) daily after enabling it.';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.queue_notification_reminders(date) IS
  'Creates de-duplicated 7/3/1-day fund deadline reminders and 7/1-day event reminders.';
