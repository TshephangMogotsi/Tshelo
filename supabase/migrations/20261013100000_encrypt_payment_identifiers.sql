-- Encrypt the two payment identifiers at rest. The application never needs an
-- equality lookup for either value, so do not add a deterministic/hash index
-- that would enable identifier correlation. Vault owns the key; it is generated
-- in the database and never appears in migrations, application configuration,
-- browser bundles, or logs.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'payment_identifiers_encryption_v1'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'payment_identifiers_encryption_v1',
      'Tshelo bank-account and mobile-money identifier encryption key, version 1'
    );
  END IF;
END;
$$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS mobile_money_number_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS bank_account_number_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS payment_identifier_key_version smallint NOT NULL DEFAULT 1;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_payment_identifier_ciphertext_present;
ALTER TABLE public.users
  ADD CONSTRAINT users_payment_identifier_ciphertext_present CHECK (
    mobile_money_number IS NULL
    AND bank_account_number IS NULL
  ) NOT VALID;

-- This helper is intentionally not executable by application roles. It is used
-- only inside security-definer payment routines below.
CREATE OR REPLACE FUNCTION public.payment_identifier_encryption_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, vault, public, pg_temp
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'payment_identifiers_encryption_v1'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.payment_identifier_encryption_key() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.encrypt_payment_identifier(p_value text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE encryption_key text;
BEGIN
  IF p_value IS NULL THEN RETURN NULL; END IF;
  SELECT public.payment_identifier_encryption_key() INTO encryption_key;
  IF encryption_key IS NULL OR length(encryption_key) < 32 THEN
    RAISE EXCEPTION 'PAYMENT_IDENTIFIER_ENCRYPTION_KEY_UNAVAILABLE';
  END IF;
  RETURN extensions.pgp_sym_encrypt(p_value, encryption_key, 'cipher-algo=aes256,compress-algo=0');
END;
$$;
REVOKE ALL ON FUNCTION public.encrypt_payment_identifier(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decrypt_payment_identifier(p_ciphertext bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE encryption_key text;
BEGIN
  IF p_ciphertext IS NULL THEN RETURN NULL; END IF;
  SELECT public.payment_identifier_encryption_key() INTO encryption_key;
  IF encryption_key IS NULL OR length(encryption_key) < 32 THEN
    RAISE EXCEPTION 'PAYMENT_IDENTIFIER_ENCRYPTION_KEY_UNAVAILABLE';
  END IF;
  RETURN extensions.pgp_sym_decrypt(p_ciphertext, encryption_key);
END;
$$;
REVOKE ALL ON FUNCTION public.decrypt_payment_identifier(bytea) FROM PUBLIC, anon, authenticated, service_role;

-- Encrypt historical data and remove its plaintext in the same transaction.
UPDATE public.users
SET mobile_money_number_ciphertext = public.encrypt_payment_identifier(mobile_money_number),
    bank_account_number_ciphertext = public.encrypt_payment_identifier(bank_account_number),
    mobile_money_number = NULL,
    bank_account_number = NULL
WHERE mobile_money_number IS NOT NULL OR bank_account_number IS NOT NULL;

ALTER TABLE public.users VALIDATE CONSTRAINT users_payment_identifier_ciphertext_present;

-- Replace the narrowly scoped user-owned payment update. Only this routine can
-- decrypt/compare/update identifiers. A changed number resets verification;
-- no caller can mark a new number verified.
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

-- Trusted server code that has an operational need can retrieve plaintext by
-- user ID. It is deliberately unavailable to browser roles and validates the
-- caller before returning either identifier.
CREATE OR REPLACE FUNCTION public.get_payment_identifiers_for_service(p_user_id uuid)
RETURNS TABLE (mobile_money_number text, bank_account_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_IDENTIFIER_FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT public.decrypt_payment_identifier(u.mobile_money_number_ciphertext),
         public.decrypt_payment_identifier(u.bank_account_number_ciphertext)
  FROM public.users u WHERE u.id = p_user_id AND u.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_payment_details(jsonb), public.get_payment_identifiers_for_service(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_payment_details(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payment_identifiers_for_service(uuid) TO service_role;

COMMENT ON COLUMN public.users.mobile_money_number IS 'Retired plaintext column. Must remain NULL; use mobile_money_number_ciphertext through approved routines.';
COMMENT ON COLUMN public.users.bank_account_number IS 'Retired plaintext column. Must remain NULL; use bank_account_number_ciphertext through approved routines.';
COMMENT ON COLUMN public.users.mobile_money_number_ciphertext IS 'AES-256 OpenPGP ciphertext; decrypt only through service-owned payment routines.';
COMMENT ON COLUMN public.users.bank_account_number_ciphertext IS 'AES-256 OpenPGP ciphertext; decrypt only through service-owned payment routines.';

SELECT public.assert_application_table_security();
