-- Disposable migrated database only. Every synthetic record/change rolls back.
BEGIN;
CREATE FUNCTION pg_temp.assert_email(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Profile email regression: %',label; END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.assert_email(boolean,text) TO authenticated,service_role;
INSERT INTO auth.users(id,phone,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES('e2000000-0000-4000-8000-000000000001','26770000601','email-owner@example.invalid',now(),'{}','{}'),
      ('e2000000-0000-4000-8000-000000000002','26770000602','email-attacker@example.invalid',now(),'{}','{}'),
      ('e2000000-0000-4000-8000-000000000003','26770000603','email-unverified@example.invalid',NULL,'{}','{}');
-- Model a forged historical value without making the new guard accept it.
ALTER TABLE public.users DISABLE TRIGGER enforce_verified_profile_email;
UPDATE public.users SET email='email-owner@example.invalid' WHERE id='e2000000-0000-4000-8000-000000000002';
ALTER TABLE public.users ENABLE TRIGGER enforce_verified_profile_email;
SELECT set_config('request.jwt.claim.sub','e2000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    UPDATE public.users SET email='another@example.invalid' WHERE id=auth.uid();
    RAISE EXCEPTION 'Direct email edit succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.users SET email=NULL WHERE id=auth.uid();
    RAISE EXCEPTION 'Direct email clearing succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.users SET name='Permitted profile edit' WHERE id=auth.uid();
  PERFORM pg_temp.assert_email(FOUND,'ordinary name edit remains allowed');
  IF has_column_privilege('authenticated','public.users','email','UPDATE') THEN
    UPDATE public.users SET name='Legacy client name edit',email=email WHERE id=auth.uid();
    PERFORM pg_temp.assert_email(FOUND,'phase-one unchanged-email legacy save remains allowed');
  END IF;
  BEGIN
    PERFORM public.resolve_verified_closure_account('email-owner@example.invalid');
    RAISE EXCEPTION 'Authenticated caller can resolve deletion identities';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
  BEGIN
    UPDATE public.users SET email='unverified-new@example.invalid' WHERE id='e2000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Trusted caller set an unverified profile address';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE auth.users SET email='pending@example.invalid',email_confirmed_at=NULL WHERE id='e2000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Unverified Auth change succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'EMAIL_CHANGE_REQUIRES_VERIFICATION' THEN RAISE; END IF;
  END;
END $$;
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_email(public.resolve_verified_closure_account(' EMAIL-OWNER@example.invalid ')='e2000000-0000-4000-8000-000000000001','confirmed Auth identity wins over duplicate forged profile email');
SELECT pg_temp.assert_email(public.resolve_verified_closure_account('email-unverified@example.invalid') IS NULL,'unverified Auth address rejected');
INSERT INTO public.account_closure_verifications(contact_email,token_hash,expires_at)
VALUES(' EMAIL-OWNER@example.invalid ','profile-email-token',now()+interval '30 minutes');
SELECT pg_temp.assert_email((SELECT account_user_id='e2000000-0000-4000-8000-000000000001' FROM public.account_closure_verifications WHERE token_hash='profile-email-token'),'old API insert automatically binds correct account');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.account_closure_verifications(contact_email,account_user_id,token_hash,expires_at)
    VALUES('email-owner@example.invalid','e2000000-0000-4000-8000-000000000002','forged-binding',now()+interval '30 minutes');
    RAISE EXCEPTION 'Wrong account binding succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.account_closure_verifications(contact_email,token_hash,expires_at)
    VALUES('email-unverified@example.invalid','unverified-token',now()+interval '30 minutes');
    RAISE EXCEPTION 'Unverified closure identity succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT pg_temp.assert_email((SELECT count(*)=1 FROM public.consume_verified_account_closure_request('profile-email-token')),'verified request creates a ticket');
SELECT pg_temp.assert_email((SELECT count(*)=0 FROM public.consume_verified_account_closure_request('profile-email-token')),'token replay rejected');
SELECT pg_temp.assert_email(EXISTS(SELECT 1 FROM public.support_tickets WHERE user_id='e2000000-0000-4000-8000-000000000001' AND category='account_closure'),'ticket belongs to verified account');
SELECT pg_temp.assert_email(NOT EXISTS(SELECT 1 FROM public.support_tickets WHERE user_id='e2000000-0000-4000-8000-000000000002' AND category='account_closure'),'no ticket on forged profile account');
INSERT INTO public.account_closure_verifications(contact_email,token_hash,expires_at)
VALUES('email-owner@example.invalid','stale-email-token',now()+interval '30 minutes'),
      ('email-owner@example.invalid','expired-email-token',now()-interval '1 second');
SELECT pg_temp.assert_email((SELECT count(*)=0 FROM public.consume_verified_account_closure_request('expired-email-token')),'expired token rejected');
RESET ROLE;
UPDATE auth.users SET email='email-owner-new@example.invalid',email_confirmed_at=now() WHERE id='e2000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_email((SELECT email='email-owner-new@example.invalid' FROM public.users WHERE id='e2000000-0000-4000-8000-000000000001'),'verified Auth email sync succeeds');
SELECT pg_temp.assert_email(EXISTS(SELECT 1 FROM public.notifications WHERE user_id='e2000000-0000-4000-8000-000000000001' AND data->>'security_event'='email_change'),'owner notification created');
SELECT pg_temp.assert_email((SELECT count(*)=0 FROM public.consume_verified_account_closure_request('stale-email-token')),'email change invalidates pending token');
-- Pre-migration tokens have no trustworthy account binding and must not work.
ALTER TABLE public.account_closure_verifications DISABLE TRIGGER bind_verified_closure_account;
INSERT INTO public.account_closure_verifications(contact_email,token_hash,expires_at)
VALUES('email-owner-new@example.invalid','legacy-unbound-token',now()+interval '30 minutes');
ALTER TABLE public.account_closure_verifications ENABLE TRIGGER bind_verified_closure_account;
SELECT pg_temp.assert_email((SELECT count(*)=0 FROM public.consume_verified_account_closure_request('legacy-unbound-token')),'legacy unbound token rejected');
ROLLBACK;
