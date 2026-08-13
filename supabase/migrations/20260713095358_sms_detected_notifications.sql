-- SMS-detected money-in alerts land in the in-app notifications list.
-- The app inserts these rows for the signed-in user itself (previously
-- only server-side triggers/functions wrote to notifications).

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'sms_detected';

CREATE POLICY notifications_insert_own ON public.notifications
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
