-- Refreshing a token must not count as fresh authentication. Use Auth's
-- signed authentication-method timestamp, not the access token's issued-at.
BEGIN;
CREATE OR REPLACE FUNCTION public.require_recent_payment_auth()
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(auth.jwt()->'amr')='array'
        THEN auth.jwt()->'amr' ELSE '[]'::jsonb END
    ) AS proof
    WHERE proof->>'method' IN ('otp','totp','mfa/totp')
      AND CASE WHEN jsonb_typeof(proof->'timestamp')='number' THEN
        (proof->>'timestamp')::numeric BETWEEN extract(epoch FROM now())-300
          AND extract(epoch FROM now())+30
        ELSE false END
  ) THEN
    RAISE EXCEPTION 'Sign in again before changing payment details' USING ERRCODE='PT401';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.require_recent_payment_auth() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_own_payment_details(p_details jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  profile public.users%ROWTYPE;
  next_mobile_provider public.payment_method;
  next_mobile_number text;
  next_mobile_name text;
  next_bank_name text;
  next_bank_account_number text;
  next_bank_account_name text;
  next_bank_branch_code text;
  current_mobile_number text;
  current_bank_account_number text;
  mobile_changed boolean := false;
  bank_changed boolean := false;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  PERFORM public.require_recent_payment_auth();
  IF p_details IS NULL OR jsonb_typeof(p_details) <> 'object'
    OR p_details - ARRAY['mobile_money_provider', 'mobile_money_number', 'mobile_money_name', 'bank_name', 'bank_account_number', 'bank_account_name', 'bank_branch_code'] <> '{}'::jsonb
  THEN RAISE EXCEPTION 'PAYMENT_DETAILS_INVALID'; END IF;

  SELECT * INTO profile FROM public.users WHERE id = caller_id AND deleted_at IS NULL FOR UPDATE;
  IF profile.id IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  current_mobile_number := public.decrypt_payment_identifier(profile.mobile_money_number_ciphertext);
  current_bank_account_number := public.decrypt_payment_identifier(profile.bank_account_number_ciphertext);

  next_mobile_provider := CASE WHEN p_details ? 'mobile_money_provider' THEN NULLIF(p_details->>'mobile_money_provider', '')::public.payment_method ELSE profile.mobile_money_provider END;
  next_mobile_number := CASE WHEN p_details ? 'mobile_money_number' THEN NULLIF(btrim(p_details->>'mobile_money_number'), '') ELSE current_mobile_number END;
  next_mobile_name := CASE WHEN p_details ? 'mobile_money_name' THEN NULLIF(btrim(p_details->>'mobile_money_name'), '') ELSE profile.mobile_money_name END;
  next_bank_name := CASE WHEN p_details ? 'bank_name' THEN NULLIF(btrim(p_details->>'bank_name'), '') ELSE profile.bank_name END;
  next_bank_account_number := CASE WHEN p_details ? 'bank_account_number' THEN NULLIF(btrim(p_details->>'bank_account_number'), '') ELSE current_bank_account_number END;
  next_bank_account_name := CASE WHEN p_details ? 'bank_account_name' THEN NULLIF(btrim(p_details->>'bank_account_name'), '') ELSE profile.bank_account_name END;
  next_bank_branch_code := CASE WHEN p_details ? 'bank_branch_code' THEN NULLIF(btrim(p_details->>'bank_branch_code'), '') ELSE profile.bank_branch_code END;

  IF (next_mobile_number IS NOT NULL AND length(next_mobile_number) > 20)
    OR (next_bank_account_number IS NOT NULL AND length(next_bank_account_number) > 50)
  THEN RAISE EXCEPTION 'PAYMENT_DETAILS_INVALID'; END IF;

  mobile_changed := (next_mobile_provider, next_mobile_number, next_mobile_name) IS DISTINCT FROM (profile.mobile_money_provider, current_mobile_number, profile.mobile_money_name);
  bank_changed := (next_bank_name, next_bank_account_number, next_bank_account_name, next_bank_branch_code) IS DISTINCT FROM (profile.bank_name, current_bank_account_number, profile.bank_account_name, profile.bank_branch_code);
  IF NOT mobile_changed AND NOT bank_changed THEN RETURN; END IF;

  UPDATE public.users
  SET mobile_money_provider = next_mobile_provider,
      mobile_money_number_ciphertext = CASE WHEN next_mobile_number IS DISTINCT FROM current_mobile_number THEN public.encrypt_payment_identifier(next_mobile_number) ELSE mobile_money_number_ciphertext END,
      mobile_money_name = next_mobile_name,
      bank_name = next_bank_name,
      bank_account_number_ciphertext = CASE WHEN next_bank_account_number IS DISTINCT FROM current_bank_account_number THEN public.encrypt_payment_identifier(next_bank_account_number) ELSE bank_account_number_ciphertext END,
      bank_account_name = next_bank_account_name,
      bank_branch_code = next_bank_branch_code,
      mobile_money_verified = CASE WHEN mobile_changed THEN false ELSE mobile_money_verified END,
      mobile_money_verified_at = CASE WHEN mobile_changed THEN NULL ELSE mobile_money_verified_at END,
      bank_account_verified = CASE WHEN bank_changed THEN false ELSE bank_account_verified END,
      bank_account_verified_at = CASE WHEN bank_changed THEN NULL ELSE bank_account_verified_at END,
      updated_at = now()
  WHERE id = caller_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    caller_id, 'system_announcement'::public.notification_type,
    'Payment details changed',
    'Your payment details changed. Verification has been reset and is required before they can be used.',
    jsonb_build_object('kind', 'payment_details_changed', 'mobile_money_changed', mobile_changed, 'bank_changed', bank_changed)
  );
END;
$$;
COMMIT;
