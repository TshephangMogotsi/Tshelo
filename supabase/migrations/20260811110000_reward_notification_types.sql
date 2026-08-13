-- Reward notifications are added separately because PostgreSQL enum values
-- must be committed before later migrations can use them in functions.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'reward_earned';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'trust_level_changed';
