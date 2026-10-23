-- App UI requires an SMS code for the current number. Enforce the same rule
-- for direct Auth API requests: a phone_change reservation needs a session
-- created from the current number within the last ten minutes.
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

  IF OLD.last_sign_in_at IS NULL OR OLD.last_sign_in_at < pg_catalog.now() - INTERVAL '10 minutes' THEN
    RAISE EXCEPTION 'PHONE_CHANGE_REAUTHENTICATION_REQUIRED' USING ERRCODE = 'insufficient_privilege';
  END IF;

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
