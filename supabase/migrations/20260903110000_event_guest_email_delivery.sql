-- An email invitation is only marked sent after the server receives a
-- successful response from Resend. The API uses a service-role client for
-- that small, post-delivery update.

CREATE OR REPLACE FUNCTION public.clear_unconfirmed_event_guest_email_sent_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invitation_channel = 'email' THEN
    NEW.invitation_sent_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_guests_clear_unconfirmed_email_sent_at ON public.event_guests;

CREATE TRIGGER event_guests_clear_unconfirmed_email_sent_at
  BEFORE INSERT ON public.event_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_unconfirmed_event_guest_email_sent_at();
