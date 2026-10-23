-- Keep the enum addition in its own committed migration before it is used by
-- the scheduled-reminder function.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'event_reminder';
