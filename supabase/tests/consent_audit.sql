-- Strict regression test against migrated PostgreSQL. All synthetic profiles
-- and audit entries roll back before the summary is returned.
CREATE OR REPLACE FUNCTION pg_temp.assert_consent(ok boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Consent regression: %',message; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pg_temp.verify_consent_audit()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  legacy_id uuid := 'e1000000-0000-4000-8000-000000000001';
  fresh_id uuid := 'e1000000-0000-4000-8000-000000000002';
  before_count int; invalid jsonb; output jsonb;
BEGIN
  BEGIN
    INSERT INTO public.users(id,phone,name,data_processing_consent)
    VALUES(legacy_id,'+26770000401','Legacy consent fixture',true);
    INSERT INTO public.users(id,phone,name) VALUES(fresh_id,'+26770000402','New consent fixture');
    PERFORM pg_temp.assert_consent((SELECT data_processing_consent=false FROM public.users WHERE id=fresh_id),'new profile must default to false');
    PERFORM pg_temp.assert_consent((SELECT data_processing_consent=true AND data_processing_consent_at IS NULL FROM public.users WHERE id=legacy_id),'legacy fixture setup');
    PERFORM set_config('request.jwt.claim.sub',legacy_id::text,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',legacy_id,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;
    PERFORM public.record_own_consents('{"terms_version":" v1 ","privacy_version":" v1 ","data_processing_consent":true}');
    PERFORM pg_temp.assert_consent((SELECT count(*)=3 FROM public.consent_log WHERE user_id=legacy_id),'first acceptance must log terms/privacy/processing');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='data_processing' AND action='granted' AND consent_version='v1' AND created_at=now()),'versioned server-timestamp processing event');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.users WHERE id=legacy_id AND terms_version='v1' AND privacy_version='v1' AND terms_accepted_at=now() AND privacy_accepted_at=now() AND data_processing_consent_at=now()),'server profile timestamps/version');
    PERFORM public.record_own_consents('{"data_processing_consent":true}');
    PERFORM pg_temp.assert_consent((SELECT count(*)=1 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='data_processing'),'processing retry must not duplicate');
    PERFORM public.record_own_consents('{"data_processing_consent":false}');
    PERFORM public.record_own_consents('{"data_processing_consent":true}');
    PERFORM pg_temp.assert_consent((SELECT count(*)=3 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='data_processing'),'withdrawal/regrant audit');
    PERFORM public.record_own_consents('{"privacy_version":"v2","data_processing_consent":true}');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='data_processing' AND consent_version='v2' AND action='granted'),'new policy explicit acceptance');

    PERFORM public.record_own_consents('{"marketing_email_enabled":true}');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.users WHERE id=legacy_id AND marketing_consent AND marketing_email_enabled AND NOT marketing_sms_enabled AND NOT marketing_push_enabled),'channel opt-in must enable aggregate');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='marketing_email' AND action='granted' AND consent_version='v2'),'email grant audit');
    PERFORM public.record_own_consents('{"marketing_email_enabled":false,"marketing_sms_enabled":true,"marketing_push_enabled":true}');
    PERFORM pg_temp.assert_consent((SELECT count(*)=1 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='marketing'),'channel switch must preserve aggregate true without duplicate grant');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='marketing_email' AND action='withdrawn') AND EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='marketing_sms' AND action='granted') AND EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='marketing_push' AND action='granted'),'channel-only changes must each be audited');
    PERFORM public.record_own_consents('{"marketing_consent":false}');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.users WHERE id=legacy_id AND NOT marketing_consent AND NOT marketing_email_enabled AND NOT marketing_sms_enabled AND NOT marketing_push_enabled AND marketing_consent_at IS NULL),'aggregate withdrawal must disable every channel');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='marketing' AND action='withdrawn') AND EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='marketing_sms' AND action='withdrawn') AND EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=legacy_id AND consent_type='marketing_push' AND action='withdrawn'),'withdrawal audit must include disabled channels');
    SELECT count(*) INTO before_count FROM public.consent_log WHERE user_id=legacy_id;
    PERFORM public.record_own_consents('{"marketing_consent":false}');
    PERFORM pg_temp.assert_consent((SELECT count(*)=before_count FROM public.consent_log WHERE user_id=legacy_id),'repeated withdrawal is idempotent');
    PERFORM public.record_own_consents('{"marketing_email_enabled":true}');
    PERFORM public.record_own_consents('{"marketing_consent":false,"marketing_email_enabled":true}');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.users WHERE id=legacy_id AND NOT marketing_consent AND NOT marketing_email_enabled AND NOT marketing_sms_enabled AND NOT marketing_push_enabled),'withdrawal must override contradictory channel opt-in');
    PERFORM public.record_own_consents('{"marketing_sms_enabled":true}');
    PERFORM public.record_own_consents('{"marketing_sms_enabled":false}');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.users WHERE id=legacy_id AND NOT marketing_consent),'disabling last channel must clear aggregate');
    SELECT count(*) INTO before_count FROM public.consent_log WHERE user_id=legacy_id;
    PERFORM public.record_own_consents('{}');
    PERFORM pg_temp.assert_consent((SELECT count(*)=before_count FROM public.consent_log WHERE user_id=legacy_id),'empty patch must not invent consent');

    FOREACH invalid IN ARRAY ARRAY[
      'null'::jsonb,'[]'::jsonb,'{"data_processing_consent":null}'::jsonb,
      '{"marketing_consent":"false"}'::jsonb,'{"marketing_email_enabled":1}'::jsonb,
      '{"marketing_sms_enabled":null}'::jsonb,'{"marketing_push_enabled":[]}'::jsonb,
      '{"privacy_version":null}'::jsonb,'{"privacy_version":" "}'::jsonb,
      '{"terms_version":true}'::jsonb,'{"terms_version":"123456789012345678901"}'::jsonb,
      '{"terms_accepted_at":"2000-01-01"}'::jsonb,'{"user_id":"e1000000-0000-4000-8000-000000000002"}'::jsonb
    ] LOOP
      BEGIN
        PERFORM public.record_own_consents(invalid);
        RAISE EXCEPTION 'Consent regression: invalid payload accepted';
      EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CONSENT_INVALID' THEN RAISE; END IF; END;
    END LOOP;
    PERFORM pg_temp.assert_consent((SELECT count(*)=before_count FROM public.consent_log WHERE user_id=legacy_id),'invalid payload must leave audit unchanged');
    BEGIN
      INSERT INTO public.consent_log(user_id,consent_type,action) VALUES(legacy_id,'terms','accepted');
      RAISE EXCEPTION 'Consent regression: client audit insert allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      UPDATE public.consent_log SET action='forged' WHERE user_id=legacy_id;
      RAISE EXCEPTION 'Consent regression: client audit update allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      DELETE FROM public.consent_log WHERE user_id=legacy_id;
      RAISE EXCEPTION 'Consent regression: client audit delete allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      UPDATE public.users SET data_processing_consent_at=now()-interval '1 year' WHERE id=legacy_id;
      RAISE EXCEPTION 'Consent regression: client timestamp mutation allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    PERFORM set_config('request.jwt.claim.sub',fresh_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',fresh_id,'role','authenticated')::text,true);
    PERFORM pg_temp.assert_consent(NOT EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=legacy_id),'another user must not read audit');
    BEGIN
      PERFORM public.record_own_consents('{"data_processing_consent":true}');
      RAISE EXCEPTION 'Consent regression: processing grant missing policy version accepted';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CONSENT_POLICY_VERSION_REQUIRED' THEN RAISE; END IF; END;
    PERFORM pg_temp.assert_consent(NOT EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=fresh_id),'failed acceptance must not invent log');
    PERFORM public.record_own_consents('{"data_processing_consent":false}');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=fresh_id AND consent_type='data_processing' AND action='withdrawn'),'withdrawal must not require policy acceptance');
    PERFORM public.record_own_consents('{"privacy_version":"v1","data_processing_consent":true}');
    PERFORM pg_temp.assert_consent(EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=fresh_id AND consent_type='data_processing' AND action='granted' AND consent_version='v1'),'new false-default acceptance');
    RESET ROLE;
    UPDATE public.users SET deleted_at=now() WHERE id=fresh_id;
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public.record_own_consents('{"marketing_consent":true}');
      RAISE EXCEPTION 'Consent regression: deleted profile mutation allowed';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'PROFILE_NOT_FOUND' THEN RAISE; END IF; END;
    PERFORM set_config('request.jwt.claim.sub','',true);
    PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
    BEGIN
      PERFORM public.record_own_consents('{"marketing_consent":true}');
      RAISE EXCEPTION 'Consent regression: missing identity accepted';
    EXCEPTION WHEN invalid_authorization_specification THEN NULL; END;
    RESET ROLE;
    SET LOCAL ROLE anon;
    BEGIN
      PERFORM public.record_own_consents('{}');
      RAISE EXCEPTION 'Consent regression: anonymous execution allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
    output := jsonb_build_object('result','PASS','legacy_initial_acceptance',true,'new_default_false',true,'policy_version_recorded',true,'channel_changes_audited',true,'master_withdrawal_disables_all',true,'withdrawal_overrides_conflicting_channels',true,'last_channel_disables_aggregate',true,'retry_idempotency',true,'invalid_payloads_denied',13,'audit_access_controls',true,'deleted_and_missing_identity_denied',true);
    RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback consent regression fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  IF EXISTS(SELECT 1 FROM public.users WHERE id IN(legacy_id,fresh_id)) OR EXISTS(SELECT 1 FROM public.consent_log WHERE user_id IN(legacy_id,fresh_id)) THEN
    RAISE EXCEPTION 'Consent regression fixtures were not rolled back';
  END IF;
  RETURN output || jsonb_build_object('fixtures_rolled_back',true);
END;
$$;
SELECT pg_temp.verify_consent_audit() AS evidence;
