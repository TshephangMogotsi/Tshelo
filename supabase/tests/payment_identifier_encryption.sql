-- Executes real pgcrypto/Vault routines and role boundaries. Safe to run against
-- the linked project: synthetic profiles and notifications are rolled back.
-- Never SELECT or print plaintext, ciphertext, keys, or existing user IDs.
BEGIN;

CREATE FUNCTION pg_temp.assert_payment(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'Payment encryption check failed: %', message; END IF;
END;
$$;

DO $$
DECLARE signature text; role_name text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.payment_identifier_encryption_key()',
    'public.encrypt_payment_identifier(text)',
    'public.decrypt_payment_identifier(bytea)'
  ] LOOP
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      PERFORM pg_temp.assert_payment(NOT has_function_privilege(role_name, signature, 'EXECUTE'), 'private helper execution grant');
    END LOOP;
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    PERFORM pg_temp.assert_payment(NOT has_function_privilege(role_name, 'public.get_payment_identifiers_for_service(uuid)', 'EXECUTE'), 'client retrieval execution grant');
    PERFORM pg_temp.assert_payment(NOT has_column_privilege(role_name, 'public.users', 'bank_account_number_ciphertext', 'UPDATE'), 'client ciphertext update grant');
    PERFORM pg_temp.assert_payment(NOT has_column_privilege(role_name, 'public.users', 'payment_identifier_key_version', 'UPDATE'), 'client key version update grant');
  END LOOP;
  PERFORM pg_temp.assert_payment(NOT EXISTS(SELECT 1 FROM public.users WHERE mobile_money_number IS NOT NULL OR bank_account_number IS NOT NULL), 'legacy plaintext remains');
  PERFORM pg_temp.assert_payment(EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname='users_payment_identifier_ciphertext_present' AND convalidated), 'plaintext constraint not validated');
END;
$$;

INSERT INTO public.users(id, phone, name, bank_account_verified, mobile_money_verified, bank_account_verified_at, mobile_money_verified_at)
VALUES ('a0000000-0000-4000-8000-000000000031', '+26770000031', 'Encryption rollback fixture', true, true, now(), now()),
       ('a0000000-0000-4000-8000-000000000032', '+26770000032', 'Encryption isolation fixture', false, false, NULL, NULL);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000031', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.update_own_payment_details('{"mobile_money_number":"26770000031","bank_account_number":"TEST-ACCOUNT-000031"}'::jsonb);

DO $$
BEGIN
  PERFORM pg_temp.assert_payment(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND bank_account_number IS NULL AND mobile_money_number IS NULL AND bank_account_number_ciphertext IS NOT NULL AND mobile_money_number_ciphertext IS NOT NULL AND NOT bank_account_verified AND NOT mobile_money_verified AND bank_account_verified_at IS NULL AND mobile_money_verified_at IS NULL), 'encrypted write or verification reset');
  BEGIN
    PERFORM public.get_payment_identifiers_for_service(auth.uid());
    RAISE EXCEPTION 'client retrieval unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.decrypt_payment_identifier(NULL);
    RAISE EXCEPTION 'client decrypt unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.users SET bank_account_number_ciphertext='\x00'::bytea WHERE id=auth.uid();
    RAISE EXCEPTION 'client ciphertext update unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.users SET bank_account_number='TEST-DIRECT-WRITE' WHERE id=auth.uid();
    RAISE EXCEPTION 'client plaintext update unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.update_own_payment_details('{"bank_account_verified":true}');
    RAISE EXCEPTION 'protected-field injection unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PAYMENT_DETAILS_INVALID' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.update_own_payment_details(jsonb_build_object('bank_account_number', repeat('x',51)));
    RAISE EXCEPTION 'oversized identifier unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PAYMENT_DETAILS_INVALID' THEN RAISE; END IF;
  END;
END;
$$;

RESET ROLE;
DO $$
DECLARE before_cipher bytea; n bigint; rotated bytea; fresh_key text;
BEGIN
  PERFORM pg_temp.assert_payment(EXISTS(SELECT 1 FROM public.notifications WHERE user_id='a0000000-0000-4000-8000-000000000031' AND data->>'kind'='payment_details_changed' AND data->>'bank_changed'='true' AND data->>'mobile_money_changed'='true' AND NOT data::text LIKE '%TEST-ACCOUNT%'), 'security notification missing or leaks identifier');
  PERFORM pg_temp.assert_payment(EXISTS(SELECT 1 FROM public.users WHERE id='a0000000-0000-4000-8000-000000000032' AND bank_account_number_ciphertext IS NULL AND mobile_money_number_ciphertext IS NULL), 'another profile changed');
  PERFORM pg_temp.assert_payment(public.encrypt_payment_identifier('synthetic-value') <> public.encrypt_payment_identifier('synthetic-value'), 'encryption must be randomized');
  SELECT bank_account_number_ciphertext INTO before_cipher FROM public.users WHERE id='a0000000-0000-4000-8000-000000000031';
  SELECT count(*) INTO n FROM public.notifications WHERE user_id='a0000000-0000-4000-8000-000000000031';
  PERFORM public.update_own_payment_details('{"bank_account_number":"TEST-ACCOUNT-000031"}');
  PERFORM pg_temp.assert_payment((SELECT bank_account_number_ciphertext=before_cipher FROM public.users WHERE id='a0000000-0000-4000-8000-000000000031'), 'unchanged identifier reencrypted');
  PERFORM pg_temp.assert_payment((SELECT count(*)=n FROM public.notifications WHERE user_id='a0000000-0000-4000-8000-000000000031'), 'no-op emitted notification');
  -- Rehearse decrypt/re-encrypt under a fresh key without changing the live Vault
  -- secret or stored key version. No key or decrypted value leaves this block.
  fresh_key := encode(extensions.gen_random_bytes(32),'hex');
  rotated := extensions.pgp_sym_encrypt(public.decrypt_payment_identifier(before_cipher), fresh_key, 'cipher-algo=aes256,compress-algo=0');
  PERFORM pg_temp.assert_payment(extensions.pgp_sym_decrypt(rotated,fresh_key)='TEST-ACCOUNT-000031', 'rotation round trip');
  BEGIN
    UPDATE public.users SET bank_account_number='TEST-PLAINTEXT' WHERE id='a0000000-0000-4000-8000-000000000031';
    RAISE EXCEPTION 'plaintext constraint unexpectedly allowed a value';
  EXCEPTION WHEN check_violation THEN NULL; END;
END;
$$;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
DO $$
BEGIN
  PERFORM pg_temp.assert_payment(EXISTS(SELECT 1 FROM public.get_payment_identifiers_for_service('a0000000-0000-4000-8000-000000000031') WHERE bank_account_number='TEST-ACCOUNT-000031' AND mobile_money_number='26770000031'), 'service decrypt round trip');
  -- Existing encrypted rows must also decrypt, without exposing their values.
  PERFORM pg_temp.assert_payment(NOT EXISTS(SELECT 1 FROM public.users u CROSS JOIN LATERAL public.get_payment_identifiers_for_service(u.id) p WHERE u.deleted_at IS NULL AND ((u.bank_account_number_ciphertext IS NOT NULL AND p.bank_account_number IS NULL) OR (u.mobile_money_number_ciphertext IS NOT NULL AND p.mobile_money_number IS NULL))), 'existing ciphertext could not decrypt');
END;
$$;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.get_payment_identifiers_for_service('a0000000-0000-4000-8000-000000000031');
    RAISE EXCEPTION 'service function ignored claim check';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PAYMENT_IDENTIFIER_FORBIDDEN' THEN RAISE; END IF;
  END;
END;
$$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.update_own_payment_details('{"bank_account_number":null}'::jsonb);
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
DO $$
BEGIN
  PERFORM pg_temp.assert_payment(EXISTS(SELECT 1 FROM public.get_payment_identifiers_for_service('a0000000-0000-4000-8000-000000000031') WHERE bank_account_number IS NULL AND mobile_money_number='26770000031'), 'partial update/clear changed unrelated identifier');
END;
$$;
RESET ROLE;
UPDATE public.users SET deleted_at=now() WHERE id='a0000000-0000-4000-8000-000000000031';
SET LOCAL ROLE service_role;
DO $$
BEGIN
  PERFORM pg_temp.assert_payment(NOT EXISTS(SELECT 1 FROM public.get_payment_identifiers_for_service('a0000000-0000-4000-8000-000000000031')), 'deleted profile identifiers returned');
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: encrypted writes, randomized storage, service-only decrypt, rotation rehearsal, access denial, notification, no-op, clearing, isolation, and plaintext constraint; all fixtures rolled back.' AS result;
