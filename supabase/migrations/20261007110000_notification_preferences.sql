-- Members can control routine push-alert categories without opting out of
-- security and account-protection alerts.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb;

UPDATE public.users
SET notification_preferences = jsonb_build_object(
  'fund_invites', true,
  'contributions', true,
  'expenses', true,
  'deadlines', true,
  'event_reminders', true
)
WHERE notification_preferences IS NULL;

ALTER TABLE public.users
  ALTER COLUMN notification_preferences SET DEFAULT jsonb_build_object(
    'fund_invites', true,
    'contributions', true,
    'expenses', true,
    'deadlines', true,
    'event_reminders', true
  ),
  ALTER COLUMN notification_preferences SET NOT NULL;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_notification_preferences_shape;

ALTER TABLE public.users
  ADD CONSTRAINT users_notification_preferences_shape CHECK (
    jsonb_typeof(notification_preferences) = 'object'
    AND notification_preferences ?& ARRAY[
      'fund_invites', 'contributions', 'expenses', 'deadlines', 'event_reminders'
    ]
    AND jsonb_typeof(notification_preferences -> 'fund_invites') = 'boolean'
    AND jsonb_typeof(notification_preferences -> 'contributions') = 'boolean'
    AND jsonb_typeof(notification_preferences -> 'expenses') = 'boolean'
    AND jsonb_typeof(notification_preferences -> 'deadlines') = 'boolean'
    AND jsonb_typeof(notification_preferences -> 'event_reminders') = 'boolean'
  ) NOT VALID;

GRANT UPDATE (notification_preferences) ON public.users TO authenticated;

COMMENT ON COLUMN public.users.notification_preferences IS
  'Member push-alert choices for routine fund and event updates. Security notifications bypass these preferences.';
