-- Google Play reviewers sign in with a dedicated Supabase account whose
-- app_metadata.google_play_reviewer flag can only be set by the Auth admin API.
-- Keep its writes away from anything that could represent money or a real
-- mobile-money verification, even if a reviewer credential is disclosed.

CREATE OR REPLACE FUNCTION public.is_google_play_reviewer()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'google_play_reviewer')::boolean,
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_google_play_reviewer_sensitive_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_google_play_reviewer() THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Google Play reviewer accounts cannot perform sensitive financial operations.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER block_google_play_reviewer_payments
BEFORE INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_google_play_reviewer_sensitive_mutation();

CREATE TRIGGER block_google_play_reviewer_payouts
BEFORE INSERT OR UPDATE OR DELETE ON public.payouts
FOR EACH ROW EXECUTE FUNCTION public.prevent_google_play_reviewer_sensitive_mutation();

CREATE TRIGGER block_google_play_reviewer_organisation_payouts
BEFORE INSERT OR UPDATE OR DELETE ON public.organization_payouts
FOR EACH ROW EXECUTE FUNCTION public.prevent_google_play_reviewer_sensitive_mutation();

CREATE TRIGGER block_google_play_reviewer_mobile_money_verifications
BEFORE INSERT OR UPDATE OR DELETE ON public.mobile_money_verifications
FOR EACH ROW EXECUTE FUNCTION public.prevent_google_play_reviewer_sensitive_mutation();

CREATE TRIGGER block_google_play_reviewer_token_transactions
BEFORE INSERT OR UPDATE OR DELETE ON public.token_transactions
FOR EACH ROW EXECUTE FUNCTION public.prevent_google_play_reviewer_sensitive_mutation();
