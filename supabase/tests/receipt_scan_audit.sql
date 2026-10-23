-- No provider call: verifies real audit routines using synthetic rows. All
-- profile/fund/audit fixtures roll back before the evidence row is returned.
CREATE OR REPLACE FUNCTION pg_temp.assert_receipt(ok boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Receipt audit regression: %', message; END IF;
END; $$;

CREATE OR REPLACE FUNCTION pg_temp.verify_receipt_audit()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  owner_id uuid := 'f9000000-0000-4000-8000-000000000001';
  other_id uuid := 'f9000000-0000-4000-8000-000000000002';
  fid uuid := 'f9000000-0000-4000-8000-000000000003';
  scan_id uuid; failed_id uuid;
  model_result jsonb := '{"vendor":"Synthetic shop","items":[{"name":"Rice","amount":20}]}'::jsonb;
  edits jsonb := '{"vendor":"Reviewed shop","items":[{"name":"Brown rice","amount":25}]}'::jsonb;
BEGIN
  BEGIN
    INSERT INTO public.users(id,phone,name) VALUES
      (owner_id,'+26770000601','Receipt audit fixture'),(other_id,'+26770000602','Receipt isolation fixture');
    PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
    INSERT INTO public.funds(id,owner_id,fund_code,share_code,title,fund_type,currency_code,goal_amount,status)
    VALUES(fid,owner_id,'RCTAUDIT','RECEIPT-AUDIT-CHECK','Receipt audit fixture','other','BWP',10000,'active');

    PERFORM pg_temp.assert_receipt(NOT has_function_privilege('anon','public.complete_receipt_scan(uuid,jsonb)','EXECUTE'),'anonymous completion');
    PERFORM pg_temp.assert_receipt(NOT has_function_privilege('authenticated','public.log_receipt_scan(uuid,uuid,text,text,text,jsonb,text)','EXECUTE'),'client model-result creation');
    PERFORM pg_temp.assert_receipt(NOT has_table_privilege('authenticated','public.receipt_scan_audit_log','INSERT'),'client direct insert');
    PERFORM pg_temp.assert_receipt(NOT has_table_privilege('authenticated','public.receipt_scan_audit_log','UPDATE'),'client direct update');
    PERFORM pg_temp.assert_receipt(NOT has_table_privilege('authenticated','public.receipt_scan_audit_log','SELECT'),'client raw audit reads');

    SET LOCAL ROLE service_role;
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
    scan_id := public.log_receipt_scan(owner_id,fid,fid::text||'/'||owner_id::text||'/fixture.jpg','fixture-model','fixture-version',model_result,NULL);
    failed_id := public.log_receipt_scan(owner_id,fid,'','fixture-model','fixture-version',NULL,'SYNTHETIC_PROVIDER_FAILURE');
    RESET ROLE;
    PERFORM pg_temp.assert_receipt(EXISTS(SELECT 1 FROM public.receipt_scan_audit_log WHERE id=scan_id AND model='fixture-model' AND model_version='fixture-version' AND result=model_result AND user_edits IS NULL AND completed_at IS NULL AND created_at IS NOT NULL),'server result/model/version creation');
    PERFORM pg_temp.assert_receipt(EXISTS(SELECT 1 FROM public.receipt_scan_audit_log WHERE id=failed_id AND failure_code='SYNTHETIC_PROVIDER_FAILURE' AND result IS NULL),'failure audit creation');

    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claim.sub',other_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public.complete_receipt_scan(scan_id,edits);
      RAISE EXCEPTION 'cross-user completion succeeded';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'RECEIPT_SCAN_NOT_FOUND' THEN RAISE; END IF; END;

    PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
    BEGIN
      PERFORM public.complete_receipt_scan(scan_id,'[]'::jsonb);
      RAISE EXCEPTION 'invalid edits accepted';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'RECEIPT_SCAN_INVALID' THEN RAISE; END IF; END;
    PERFORM public.complete_receipt_scan(scan_id,edits);
    BEGIN
      PERFORM public.complete_receipt_scan(scan_id,'{"vendor":"overwrite"}'::jsonb);
      RAISE EXCEPTION 'immutable edits overwritten';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'RECEIPT_SCAN_NOT_FOUND' THEN RAISE; END IF; END;
    RESET ROLE;
    PERFORM pg_temp.assert_receipt(EXISTS(SELECT 1 FROM public.receipt_scan_audit_log WHERE id=scan_id AND result=model_result AND user_edits=edits AND completed_at IS NOT NULL),'model preserved and reviewed edits/timestamp recorded');
    RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback receipt audit fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
  PERFORM pg_temp.assert_receipt(NOT EXISTS(SELECT 1 FROM public.users WHERE id IN(owner_id,other_id)) AND NOT EXISTS(SELECT 1 FROM public.funds WHERE id=fid) AND NOT EXISTS(SELECT 1 FROM public.receipt_scan_audit_log WHERE fund_id=fid),'fixture rollback');
  RETURN jsonb_build_object('result','PASS','model_version_result_preserved',true,'failure_logged',true,'owner_edits_recorded',true,'cross_user_denied',true,'client_model_writes_denied',true,'immutable_completion',true,'fixtures_rolled_back',true);
END; $$;
SELECT pg_temp.verify_receipt_audit() AS evidence;
