-- Item 1 live verification: normal authenticated role, synthetic own/other
-- profiles, and automatic rollback before aggregate PASS evidence is returned.
-- No account values, encryption keys, or real user records leave the database.
CREATE OR REPLACE FUNCTION pg_temp.verify_protected_profile_boundary()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  owner_id uuid := 'd1000000-0000-4000-8000-000000000001';
  other_id uuid := 'd1000000-0000-4000-8000-000000000002';
  allowed text[] := ARRAY['name','email','avatar_url','country_code','preferred_currency','language','notifications_enabled','profile_completed','onboarding_completed','notification_preferences'];
  assignment text; column_name text; country text; changed_rows bigint; n bigint;
  blocked_names jsonb := '[]'; explicit_denials int := 0; catalog_denials int := 0;
  bank_cipher bytea; mobile_cipher bytea; other_before jsonb; output jsonb;
  preferences jsonb := '{"fund_invites":false,"contributions":false,"expenses":false,"deadlines":false,"event_reminders":false}';
BEGIN
  BEGIN
    IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.users'::regclass AND attnum>0 AND NOT attisdropped AND has_column_privilege('authenticated','public.users',attname,'UPDATE') <> (attname=ANY(allowed))) THEN
      RAISE EXCEPTION 'Profile UPDATE grant allowlist differs from expected profile/preference fields';
    END IF;
    SELECT code INTO country FROM public.countries WHERE currency_code='BWP' ORDER BY code LIMIT 1;
    INSERT INTO public.users(id,phone,name,bank_name,bank_account_name,mobile_money_name,mobile_money_provider,bank_account_number_ciphertext,mobile_money_number_ciphertext,bank_account_verified,bank_account_verified_at,mobile_money_verified,mobile_money_verified_at)
    VALUES(owner_id,'+26770000301','Profile fixture owner','Fixture Bank','Fixture Owner','Fixture Owner','orange_money',public.encrypt_payment_identifier('TEST-OLD-BANK'),public.encrypt_payment_identifier('26770000301'),true,now(),true,now()),
          (other_id,'+26770000302','Profile fixture other','Other Bank','Other Owner','Other Owner','orange_money',public.encrypt_payment_identifier('TEST-OTHER-BANK'),public.encrypt_payment_identifier('26770000302'),true,now(),true,now());
    SELECT to_jsonb(u) INTO other_before FROM public.users u WHERE id=other_id;
    PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;

    -- Actual escalating assignments for every field explicitly named in item 1,
    -- plus verification timestamps, consent values and direct payment fields.
    FOREACH assignment IN ARRAY ARRAY[
      'bank_account_verified=true','mobile_money_verified=true','is_banned=true',
      'locked_until=now()+interval ''1 hour''','token_balance=999999',
      'trust_score=999999','trust_level=''verified''::public.trust_level',
      'terms_accepted_at=now()-interval ''1 year''','privacy_accepted_at=now()-interval ''1 year''',
      'marketing_consent_at=now()-interval ''1 year''','data_processing_consent_at=now()-interval ''1 year''',
      'bank_account_verified_at=now()','mobile_money_verified_at=now()',
      'terms_version=''forged''','privacy_version=''forged''','marketing_consent=true',
      'marketing_email_enabled=true','marketing_sms_enabled=true','marketing_push_enabled=true','data_processing_consent=false',
      'bank_name=''Forged Bank''','bank_account_number=''TEST-FORGED-BANK''','bank_account_name=''Forged Owner''','bank_branch_code=''9999''',
      'mobile_money_provider=''orange_money''','mobile_money_number=''26770000999''','mobile_money_name=''Forged Owner''',
      'bank_account_number_ciphertext=''\x00''::bytea','mobile_money_number_ciphertext=''\x00''::bytea','payment_identifier_key_version=99'
    ] LOOP
      BEGIN
        EXECUTE format('UPDATE public.users SET %s WHERE id=$1',assignment) USING owner_id;
        RAISE EXCEPTION 'SECURITY_REGRESSION: protected assignment succeeded: %',split_part(assignment,'=',1);
      EXCEPTION WHEN insufficient_privilege THEN
        explicit_denials := explicit_denials+1;
        blocked_names := blocked_names || jsonb_build_array(split_part(assignment,'=',1));
      END;
    END LOOP;
    -- Exhaustive coverage: every other users column outside the ten-field
    -- allowlist must reject even an own-row no-op UPDATE with SQLSTATE 42501.
    FOR column_name IN SELECT attname FROM pg_attribute WHERE attrelid='public.users'::regclass AND attnum>0 AND NOT attisdropped AND NOT attname=ANY(allowed) ORDER BY attnum LOOP
      BEGIN
        EXECUTE format('UPDATE public.users SET %I=%I WHERE id=$1',column_name,column_name) USING owner_id;
        RAISE EXCEPTION 'SECURITY_REGRESSION: protected column UPDATE permitted: %',column_name;
      EXCEPTION WHEN insufficient_privilege THEN catalog_denials := catalog_denials+1;
      END;
    END LOOP;

    UPDATE public.users SET name='Profile fixture edited',email='profile-fixture@example.invalid',avatar_url='https://example.invalid/avatar.jpg',country_code=country,preferred_currency='BWP',language='en',notifications_enabled=false,profile_completed=false,onboarding_completed=true,notification_preferences=preferences WHERE id=owner_id;
    GET DIAGNOSTICS changed_rows=ROW_COUNT;
    IF changed_rows<>1 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=owner_id AND name='Profile fixture edited' AND email='profile-fixture@example.invalid' AND avatar_url='https://example.invalid/avatar.jpg' AND country_code=country AND preferred_currency='BWP' AND language='en' AND notifications_enabled=false AND profile_completed=false AND onboarding_completed=true AND notification_preferences=preferences) THEN
      RAISE EXCEPTION 'Permitted own profile/preferences edit failed';
    END IF;
    UPDATE public.users SET name='Cross-account forged edit' WHERE id=other_id;
    GET DIAGNOSTICS changed_rows=ROW_COUNT;
    IF changed_rows<>0 THEN RAISE EXCEPTION 'Cross-account profile edit succeeded'; END IF;
    BEGIN
      PERFORM public.update_own_payment_details('{"bank_account_verified":true,"bank_account_number":"TEST-INJECTED"}');
      RAISE EXCEPTION 'Protected-field injection through payment RPC succeeded';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'PAYMENT_DETAILS_INVALID' THEN RAISE; END IF; END;
    BEGIN
      PERFORM public.update_own_payment_details(jsonb_build_object('user_id',other_id,'bank_account_number','TEST-CROSS-ACCOUNT'));
      RAISE EXCEPTION 'Cross-account payment targeting succeeded';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'PAYMENT_DETAILS_INVALID' THEN RAISE; END IF; END;

    SELECT mobile_money_number_ciphertext INTO mobile_cipher FROM public.users WHERE id=owner_id;
    SELECT count(*) INTO n FROM public.notifications WHERE user_id=owner_id AND data->>'kind'='payment_details_changed';
    PERFORM public.update_own_payment_details('{"bank_account_number":"TEST-NEW-BANK"}');
    IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=owner_id AND NOT bank_account_verified AND bank_account_verified_at IS NULL AND mobile_money_verified AND mobile_money_verified_at IS NOT NULL AND mobile_money_number_ciphertext=mobile_cipher AND bank_account_number IS NULL) THEN
      RAISE EXCEPTION 'Bank-only change did not reset bank verification/preserve mobile verification';
    END IF;
    IF (SELECT count(*) FROM public.notifications WHERE user_id=owner_id AND data->>'kind'='payment_details_changed')<>n+1 OR NOT EXISTS(SELECT 1 FROM public.notifications WHERE user_id=owner_id AND data->>'kind'='payment_details_changed' AND data->>'bank_changed'='true' AND data->>'mobile_money_changed'='false') THEN
      RAISE EXCEPTION 'Bank-change owner notification missing';
    END IF;
    SELECT bank_account_number_ciphertext INTO bank_cipher FROM public.users WHERE id=owner_id;
    PERFORM public.update_own_payment_details('{"bank_account_number":"TEST-NEW-BANK"}');
    IF (SELECT count(*) FROM public.notifications WHERE user_id=owner_id AND data->>'kind'='payment_details_changed')<>n+1 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=owner_id AND bank_account_number_ciphertext=bank_cipher) THEN
      RAISE EXCEPTION 'Unchanged payment input rewrote ciphertext or sent a duplicate notification';
    END IF;

    -- Restore only the synthetic verification state as a trusted operator to
    -- test mobile-only changes independently of the bank-only scenario.
    RESET ROLE;
    UPDATE public.users SET bank_account_verified=true,bank_account_verified_at=now() WHERE id=owner_id;
    SET LOCAL ROLE authenticated;
    PERFORM public.update_own_payment_details('{"mobile_money_number":"26770000399"}');
    IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=owner_id AND NOT mobile_money_verified AND mobile_money_verified_at IS NULL AND bank_account_verified AND bank_account_verified_at IS NOT NULL AND bank_account_number_ciphertext=bank_cipher AND mobile_money_number IS NULL) THEN
      RAISE EXCEPTION 'Mobile-only change did not reset mobile verification/preserve bank verification';
    END IF;
    IF (SELECT count(*) FROM public.notifications WHERE user_id=owner_id AND data->>'kind'='payment_details_changed')<>n+2 OR NOT EXISTS(SELECT 1 FROM public.notifications WHERE user_id=owner_id AND data->>'kind'='payment_details_changed' AND data->>'bank_changed'='false' AND data->>'mobile_money_changed'='true') THEN
      RAISE EXCEPTION 'Mobile-change owner notification missing';
    END IF;
    PERFORM public.update_own_payment_details('{"bank_account_number":"TEST-FINAL-BANK","mobile_money_number":"26770000388"}');
    IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=owner_id AND NOT bank_account_verified AND NOT mobile_money_verified AND bank_account_verified_at IS NULL AND mobile_money_verified_at IS NULL AND bank_account_number IS NULL AND mobile_money_number IS NULL) THEN
      RAISE EXCEPTION 'Combined payment change verification reset failed';
    END IF;
    IF (SELECT count(*) FROM public.notifications WHERE user_id=owner_id AND data->>'kind'='payment_details_changed')<>n+3 OR NOT EXISTS(SELECT 1 FROM public.notifications WHERE user_id=owner_id AND data->>'kind'='payment_details_changed' AND data->>'bank_changed'='true' AND data->>'mobile_money_changed'='true') THEN
      RAISE EXCEPTION 'Combined change owner notification missing';
    END IF;
    RESET ROLE;
    IF (SELECT to_jsonb(u) FROM public.users u WHERE id=other_id) IS DISTINCT FROM other_before THEN
      RAISE EXCEPTION 'Unrelated profile changed';
    END IF;
    IF EXISTS(SELECT 1 FROM public.notifications WHERE user_id=other_id AND data->>'kind'='payment_details_changed') OR EXISTS(SELECT 1 FROM public.notifications WHERE user_id=owner_id AND data->>'kind'='payment_details_changed' AND (data::text||body) ~ '(TEST-NEW-BANK|TEST-FINAL-BANK|26770000399|26770000388)') THEN
      RAISE EXCEPTION 'Payment notification recipient/content isolation failed';
    END IF;
    output := jsonb_build_object('result','PASS','explicit_protected_assignments_denied',explicit_denials,'explicit_fields',blocked_names,'all_nonallowlisted_columns_denied',catalog_denials,'permitted_profile_fields',allowed,'own_profile_edit',true,'cross_user_edit_denied',true,'payment_rpc_injection_denied',true,'bank_only_reset',true,'mobile_only_reset',true,'combined_reset',true,'owner_notifications',3,'security_notice_with_routine_notifications_disabled',true,'no_op_preserved',true,'unrelated_profile_unchanged',true);
    RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback all profile verification fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  IF EXISTS(SELECT 1 FROM public.users WHERE id IN(owner_id,other_id)) THEN RAISE EXCEPTION 'Profile fixtures were not rolled back'; END IF;
  RETURN output || jsonb_build_object('fixtures_rolled_back',true);
END;
$$;
SELECT pg_temp.verify_protected_profile_boundary() AS evidence;
