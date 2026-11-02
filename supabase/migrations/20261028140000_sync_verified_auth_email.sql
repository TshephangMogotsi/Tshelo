-- Keep the displayed profile email in sync when Supabase Auth completes a
-- verified sign-in email change. Pending changes do not alter the profile.
BEGIN;
CREATE OR REPLACE FUNCTION public.sync_verified_auth_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    IF NEW.email_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'EMAIL_CHANGE_REQUIRES_VERIFICATION';
    END IF;
    UPDATE public.users SET email = NEW.email WHERE id = NEW.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'EMAIL_CHANGE_PROFILE_MISSING';
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.id,
      'system_announcement'::public.notification_type,
      'Sign-in email changed',
      'Your Tshelo sign-in email was changed. If this was not you, contact support immediately.',
      jsonb_build_object('security_event', 'email_change')
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_verified_auth_email() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_email_changed ON auth.users;
CREATE TRIGGER on_auth_email_changed
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_verified_auth_email();
COMMIT;
