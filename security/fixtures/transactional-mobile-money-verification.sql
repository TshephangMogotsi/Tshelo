-- Item 2 live regression: strict assertions; all fixture changes roll back in
-- the deliberate exception subtransaction before the PASS summary is returned.
CREATE OR REPLACE FUNCTION pg_temp.verify_mobile_money_boundary()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  owner_id uuid := 'c1000000-0000-4000-8000-000000000001';
  other_id uuid := 'c1000000-0000-4000-8000-000000000002';
  record_id uuid := 'c2000000-0000-4000-8000-000000000001';
  other_record_id uuid := 'c2000000-0000-4000-8000-000000000002';
  role_name text; statement text; country text; rejected int := 0;
  output jsonb;
BEGIN
  BEGIN
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_any_column_privilege(role_name,'public.mobile_money_verifications','INSERT')
        OR has_any_column_privilege(role_name,'public.mobile_money_verifications','UPDATE')
        OR has_table_privilege(role_name,'public.mobile_money_verifications','DELETE')
        OR has_table_privilege(role_name,'public.mobile_money_verifications','TRUNCATE') THEN
        RAISE EXCEPTION 'Client verification mutation grant remains';
      END IF;
    END LOOP;
    IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mobile_money_verifications' AND cmd IN('INSERT','UPDATE','DELETE','ALL')) THEN
      RAISE EXCEPTION 'Client verification mutation policy remains';
    END IF;
    INSERT INTO public.users(id,phone,name) VALUES(owner_id,'+26770000201','Verification fixture owner'),(other_id,'+26770000202','Verification fixture other');
    SELECT code INTO country FROM public.countries WHERE currency_code='BWP' ORDER BY code LIMIT 1;
    IF country IS NULL THEN RAISE EXCEPTION 'Missing BWP country fixture dependency'; END IF;
    PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','service_role')::text,true);
    SET LOCAL ROLE service_role;
    INSERT INTO public.mobile_money_verifications(id,user_id,country_code,provider,phone_number,expected_reference,expected_currency)
    VALUES(record_id,owner_id,country,'orange_money','26770000201','ITEM2-ROLLBACK-OWNER','BWP'),
          (other_record_id,other_id,country,'orange_money','26770000202','ITEM2-ROLLBACK-OTHER','BWP');
    UPDATE public.mobile_money_verifications SET status='verified',received=true,received_amount=1,phone_matches=true WHERE id=record_id;
    IF NOT EXISTS(SELECT 1 FROM public.mobile_money_verifications WHERE id=record_id AND status='verified' AND received AND received_amount=1 AND phone_matches) THEN
      RAISE EXCEPTION 'Trusted service creation/update failed';
    END IF;
    RESET ROLE;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      PERFORM set_config('request.jwt.claim.sub',CASE WHEN role_name='anon' THEN '' ELSE owner_id::text END,true);
      PERFORM set_config('request.jwt.claim.role',role_name,true);
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',CASE WHEN role_name='anon' THEN NULL ELSE owner_id END,'role',role_name)::text,true);
      EXECUTE format('SET LOCAL ROLE %I',role_name);
      FOREACH statement IN ARRAY ARRAY[
        format('INSERT INTO public.mobile_money_verifications(user_id,country_code,provider,phone_number,expected_reference,expected_currency,status,received,received_amount,phone_matches) VALUES(%L,%L,''orange_money'',''26770000201'',''FORGED-APPROVAL'',''BWP'',''verified'',true,999,true)',owner_id,country),
        format('UPDATE public.mobile_money_verifications SET status=''verified'' WHERE id=%L',record_id),
        format('UPDATE public.mobile_money_verifications SET received=true,received_amount=999,phone_matches=true WHERE id=%L',record_id),
        format('DELETE FROM public.mobile_money_verifications WHERE id=%L',record_id),
        format('UPDATE public.users SET mobile_money_verified=true WHERE id=%L',owner_id)
      ] LOOP
        BEGIN
          EXECUTE statement;
          RAISE EXCEPTION 'SECURITY_REGRESSION: client verification mutation succeeded';
        EXCEPTION WHEN insufficient_privilege THEN rejected := rejected+1;
        END;
      END LOOP;
      IF role_name='anon' THEN
        BEGIN
          PERFORM id FROM public.mobile_money_verifications WHERE id=record_id;
          RAISE EXCEPTION 'Anonymous verification read succeeded';
        EXCEPTION WHEN insufficient_privilege THEN rejected := rejected+1;
        END;
      ELSE
        IF (SELECT count(*) FROM public.mobile_money_verifications WHERE id IN(record_id,other_record_id))<>1
          OR NOT EXISTS(SELECT 1 FROM public.mobile_money_verifications WHERE id=record_id)
          OR EXISTS(SELECT 1 FROM public.mobile_money_verifications WHERE id=other_record_id) THEN
          RAISE EXCEPTION 'Owner-read isolation failed';
        END IF;
      END IF;
      RESET ROLE;
    END LOOP;
    output := jsonb_build_object('result','PASS','client_operations_denied',rejected,'table_and_column_write_grants_closed',true,'client_write_policies_absent',true,'owner_only_reads',true,'service_create_update',true);
    RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback verification fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  IF EXISTS(SELECT 1 FROM public.users WHERE id IN(owner_id,other_id))
    OR EXISTS(SELECT 1 FROM public.mobile_money_verifications WHERE id IN(record_id,other_record_id)) THEN
    RAISE EXCEPTION 'Verification fixtures were not rolled back';
  END IF;
  RETURN output || jsonb_build_object('fixtures_rolled_back',true);
END;
$$;
SELECT pg_temp.verify_mobile_money_boundary() AS evidence;
