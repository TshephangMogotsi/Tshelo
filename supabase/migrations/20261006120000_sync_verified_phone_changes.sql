-- Auth updates the existing user only after the phone_change OTP is verified.
-- Sync in the same transaction: a profile conflict rolls back the auth change.
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
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_verified_auth_phone() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_phone_changed
AFTER UPDATE OF phone ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_verified_auth_phone();
