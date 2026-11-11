-- Supabase verifies phone changes by looking up auth.users.phone_change. Keep
-- that lookup unambiguous even when a member abandons a previous request.
-- A trigger is used because Supabase retains ownership of auth.users and does
-- not allow project migrations to create an index on that internal table.
CREATE OR REPLACE FUNCTION public.reserve_pending_auth_phone_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.phone_change IS NULL OR NEW.phone_change IS NOT DISTINCT FROM OLD.phone_change THEN
    RETURN NEW;
  END IF;

  -- Serialise competing requests for the same target number before checking.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.phone_change, 0));
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id <> NEW.id AND phone_change = NEW.phone_change
  ) THEN
    RAISE EXCEPTION 'PHONE_CHANGE_ALREADY_PENDING' USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_pending_auth_phone_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER reserve_auth_phone_change
BEFORE UPDATE OF phone_change ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.reserve_pending_auth_phone_change();

-- The Auth trigger runs only after Supabase has accepted a phone_change OTP.
-- Add a durable in-app security notice while synchronising the profile number.
CREATE OR REPLACE FUNCTION public.sync_verified_auth_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    IF NEW.phone IS NULL OR NEW.phone !~ '^[1-9][0-9]{6,14}$'
       OR NEW.phone_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'PHONE_CHANGE_REQUIRES_VERIFICATION';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.users
      WHERE id <> NEW.id AND ltrim(phone, '+') = NEW.phone
    ) THEN
      RAISE EXCEPTION 'PHONE_ALREADY_IN_USE';
    END IF;

    UPDATE public.users SET phone = NEW.phone WHERE id = NEW.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PHONE_CHANGE_PROFILE_MISSING';
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.id,
      'system_announcement'::public.notification_type,
      'Sign-in number changed',
      'Your Tshelo sign-in number was changed. If this was not you, contact support immediately.',
      jsonb_build_object('security_event', 'phone_change', 'new_phone_last4', right(NEW.phone, 4))
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_verified_auth_phone() FROM PUBLIC, anon, authenticated;
