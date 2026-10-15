-- Live verification only. Fixture work runs in an exception subtransaction;
-- the intentional ZX001 exception rolls it back before returning observations.
-- Returns aggregate synthetic-test evidence, never real member/consent rows.
CREATE OR REPLACE FUNCTION pg_temp.try_verification_write(statement text)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
    RAISE EXCEPTION USING ERRCODE='ZX002', MESSAGE='rollback successful test write';
  EXCEPTION
    WHEN SQLSTATE 'ZX002' THEN RETURN jsonb_build_object('allowed',true);
    WHEN insufficient_privilege THEN RETURN jsonb_build_object('allowed',false);
    WHEN OTHERS THEN RETURN jsonb_build_object('error_code',SQLSTATE,'error',SQLERRM);
  END;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.verify_membership_and_consents()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  owner_id uuid := 'b1000000-0000-4000-8000-000000000001';
  member_id uuid := 'b1000000-0000-4000-8000-000000000002';
  peer_id uuid := 'b1000000-0000-4000-8000-000000000003';
  outsider_id uuid := 'b1000000-0000-4000-8000-000000000004';
  fid uuid := 'b2000000-0000-4000-8000-000000000001';
  cid uuid := 'b3000000-0000-4000-8000-000000000001';
  eid uuid := 'b4000000-0000-4000-8000-000000000001';
  rid uuid := 'b5000000-0000-4000-8000-000000000001';
  contributor uuid := 'b6000000-0000-4000-8000-000000000001';
  actor uuid; actor_label text; table_name text; filter text; seen bigint; before_count bigint;
  read_results jsonb; insert_results jsonb; observations jsonb := '[]'; consent_results jsonb := '{}';
  leave_results jsonb; reason text;
BEGIN
  BEGIN
    INSERT INTO public.users(id,phone,name,preferred_currency)
    VALUES(owner_id,'+26770000101','Membership fixture owner','BWP'),
          (member_id,'+26770000102','Membership fixture member','BWP'),
          (peer_id,'+26770000103','Membership fixture peer','BWP'),
          (outsider_id,'+26770000104','Membership fixture outsider','BWP');
    PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
    INSERT INTO public.funds(id,owner_id,fund_code,share_code,title,fund_type,currency_code,goal_amount,status)
    VALUES(fid,owner_id,'VERIFYMC','VERIFY-MEMBERSHIP-CONSENT','Membership verification fixture','other','BWP',10000,'active');
    INSERT INTO public.fund_members(fund_id,user_id,role,status,invited_by,joined_at)
    VALUES(fid,member_id,'member','joined',owner_id,now()),(fid,peer_id,'member','joined',owner_id,now());
    INSERT INTO public.fund_contributors(id,fund_id,user_id,display_name,contributor_type,created_by)
    VALUES(contributor,fid,owner_id,'Fixture contributor','member',owner_id);
    INSERT INTO public.contributions(id,fund_id,contributor_id,contributor_name,contributor_phone,user_id,tagged_by,amount,currency_code)
    VALUES(cid,fid,contributor,'Fixture contributor','+26770000101',owner_id,owner_id,100,'BWP');
    INSERT INTO public.contribution_edits(contribution_id,edited_by,field_changed) VALUES(cid,owner_id,'notes');
    INSERT INTO public.contribution_reminders(fund_id,fund_member_id,reminder_type,scheduled_at)
    SELECT fid,id,'verification',now() FROM public.fund_members WHERE fund_id=fid AND user_id=peer_id;
    INSERT INTO public.expenses(id,fund_id,added_by,description,amount,currency_code) VALUES(eid,fid,owner_id,'Fixture expense',10,'BWP');
    INSERT INTO public.expense_edits(expense_id,edited_by,field_changed) VALUES(eid,owner_id,'description');
    INSERT INTO public.expense_queries(expense_id,fund_id,asked_by,question) VALUES(eid,fid,owner_id,'Fixture question');
    INSERT INTO public.fund_announcements(fund_id,posted_by,message) VALUES(fid,owner_id,'Fixture announcement');
    INSERT INTO public.fund_exports(fund_id,exported_by) VALUES(fid,owner_id);
    INSERT INTO public.fund_milestones(fund_id,milestone_type) VALUES(fid,'verification');
    INSERT INTO public.fund_ownership_history(fund_id,new_owner_id,transfer_type) VALUES(fid,owner_id,'verification');
    INSERT INTO public.fund_shares(fund_id,shared_by,share_type) VALUES(fid,owner_id,'verification');
    INSERT INTO public.fund_succession_requests(id,fund_id,requester_user_id,reason) VALUES(rid,fid,owner_id,'verification');
    INSERT INTO public.fund_succession_votes(request_id,voter_user_id,vote) VALUES(rid,owner_id,'approve');
    INSERT INTO public.rich_auntie_sponsorships(fund_id,user_id,sponsor_name,item_description,amount,tagged_by)
    VALUES(fid,owner_id,'Fixture sponsor','Fixture item',10,owner_id);
    INSERT INTO public.member_vouches(fund_id,voucher_user_id,vouched_for_user_id,vouch_type)
    VALUES(fid,owner_id,peer_id,'verification'),(fid,peer_id,member_id,'verification');
    SELECT enumlabel INTO reason FROM pg_enum WHERE enumtypid='public.report_reason'::regtype ORDER BY enumsortorder LIMIT 1;

    FOREACH actor_label IN ARRAY ARRAY['joined','pending','left','outsider'] LOOP
      RESET ROLE;
      PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
      IF actor_label <> 'outsider' THEN
        UPDATE public.fund_members SET status=actor_label::public.member_status WHERE fund_id=fid AND user_id=member_id;
      END IF;
      actor := CASE WHEN actor_label='outsider' THEN outsider_id ELSE member_id END;
      PERFORM set_config('request.jwt.claim.sub',actor::text,true);
      PERFORM set_config('request.jwt.claim.role','authenticated',true);
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
      SET LOCAL ROLE authenticated;
      read_results := '{}';
      FOREACH table_name IN ARRAY ARRAY['contribution_edits','contribution_reminders','expense_edits','expense_queries','fund_announcements','fund_exports','fund_milestones','fund_ownership_history','fund_shares','fund_succession_requests','fund_succession_votes','rich_auntie_sponsorships','member_vouches'] LOOP
        filter := CASE table_name
          WHEN 'contribution_edits' THEN format('contribution_id=%L',cid)
          WHEN 'expense_edits' THEN format('expense_id=%L',eid)
          WHEN 'fund_succession_votes' THEN format('request_id=%L',rid)
          WHEN 'member_vouches' THEN format('fund_id=%L AND voucher_user_id=%L',fid,owner_id)
          ELSE format('fund_id=%L',fid) END;
        EXECUTE format('SELECT count(*) FROM public.%I WHERE %s',table_name,filter) INTO seen;
        read_results := read_results || jsonb_build_object(table_name,seen>0);
      END LOOP;
      insert_results := jsonb_build_object(
        'succession_vote',pg_temp.try_verification_write(format('INSERT INTO public.fund_succession_votes(request_id,voter_user_id,vote) VALUES(%L,%L,''approve'')',rid,actor)),
        'vouch',pg_temp.try_verification_write(format('INSERT INTO public.member_vouches(fund_id,voucher_user_id,vouched_for_user_id,vouch_type) VALUES(%L,%L,%L,''test-insert'')',fid,actor,owner_id)),
        'fund_report',pg_temp.try_verification_write(format('INSERT INTO public.fund_reports(fund_id,reported_by,report_reason) VALUES(%L,%L,%L)',fid,actor,reason)));
      observations := observations || jsonb_build_array(jsonb_build_object(
        'actor',actor_label,'is_fund_member',public.is_fund_member(fid),'shared_reads',read_results,'inserts',insert_results,
        'fund_row_readable',EXISTS(SELECT 1 FROM public.funds WHERE id=fid),
        'own_membership_readable',EXISTS(SELECT 1 FROM public.fund_members WHERE fund_id=fid AND user_id=actor),
        'personal_vouch_readable',EXISTS(SELECT 1 FROM public.member_vouches WHERE fund_id=fid AND (voucher_user_id=actor OR vouched_for_user_id=actor))));
    END LOOP;

    -- Exercise the actual leave RPC, in addition to status-based read checks.
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
    UPDATE public.fund_members SET status='joined' WHERE fund_id=fid AND user_id=member_id;
    PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.member_vouches(fund_id,voucher_user_id,vouched_for_user_id,vouch_type)
    VALUES(fid,member_id,owner_id,'verification');
    PERFORM public.leave_fund(fid);
    leave_results := jsonb_build_object(
      'retained_membership_status',(SELECT status FROM public.fund_members WHERE fund_id=fid AND user_id=member_id),
      'is_fund_member',public.is_fund_member(fid),
      'shared_announcements_readable',EXISTS(SELECT 1 FROM public.fund_announcements WHERE fund_id=fid),
      'own_authored_vouch_readable',EXISTS(SELECT 1 FROM public.member_vouches WHERE fund_id=fid AND voucher_user_id=member_id),
      'vouch_about_self_readable',EXISTS(SELECT 1 FROM public.member_vouches WHERE fund_id=fid AND vouched_for_user_id=member_id));

    -- Observe the deployed consent behaviour using the member profile. The
    -- processing default changed from true to false in the consent follow-up.
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub',member_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;
    PERFORM public.record_own_consents('{"terms_version":"verify-1","privacy_version":"verify-1","data_processing_consent":true}');
    consent_results := consent_results || jsonb_build_object(
      'initial_terms_events',(SELECT count(*) FROM public.consent_log WHERE user_id=member_id AND consent_type='terms' AND consent_version='verify-1' AND action='accepted'),
      'initial_privacy_events',(SELECT count(*) FROM public.consent_log WHERE user_id=member_id AND consent_type='privacy' AND consent_version='verify-1' AND action='accepted'),
      'initial_processing_events',(SELECT count(*) FROM public.consent_log WHERE user_id=member_id AND consent_type='data_processing'),
      'server_timestamps_set',EXISTS(SELECT 1 FROM public.users WHERE id=member_id AND terms_accepted_at=now() AND privacy_accepted_at=now()));
    PERFORM public.record_own_consents('{"data_processing_consent":false}');
    PERFORM public.record_own_consents('{"data_processing_consent":true}');
    PERFORM public.record_own_consents('{"marketing_email_enabled":true}');
    SELECT count(*) INTO before_count FROM public.consent_log WHERE user_id=member_id;
    PERFORM public.record_own_consents('{"marketing_email_enabled":false,"marketing_sms_enabled":true}');
    consent_results := consent_results || jsonb_build_object('channel_change_events',(SELECT count(*)-before_count FROM public.consent_log WHERE user_id=member_id));
    PERFORM public.record_own_consents('{"marketing_consent":false}');
    consent_results := consent_results || jsonb_build_object('aggregate_withdrawal_while_sms_enabled',
      (SELECT jsonb_build_object('marketing_consent',marketing_consent,'sms_enabled',marketing_sms_enabled) FROM public.users WHERE id=member_id));
    PERFORM public.record_own_consents('{"marketing_consent":false,"marketing_email_enabled":false,"marketing_sms_enabled":false,"marketing_push_enabled":false}');
    consent_results := consent_results || jsonb_build_object(
      'processing_grants',(SELECT count(*) FROM public.consent_log WHERE user_id=member_id AND consent_type='data_processing' AND action='granted'),
      'processing_withdrawals',(SELECT count(*) FROM public.consent_log WHERE user_id=member_id AND consent_type='data_processing' AND action='withdrawn'),
      'marketing_grants',(SELECT count(*) FROM public.consent_log WHERE user_id=member_id AND consent_type='marketing' AND action='granted'),
      'marketing_withdrawals',(SELECT count(*) FROM public.consent_log WHERE user_id=member_id AND consent_type='marketing' AND action='withdrawn'),
      'forged_audit_insert',pg_temp.try_verification_write(format('INSERT INTO public.consent_log(user_id,consent_type,action) VALUES(%L,''terms'',''accepted'')',member_id)),
      'audit_update',pg_temp.try_verification_write(format('UPDATE public.consent_log SET action=''forged'' WHERE user_id=%L',member_id)),
      'audit_delete',pg_temp.try_verification_write(format('DELETE FROM public.consent_log WHERE user_id=%L',member_id)),
      'direct_timestamp_update',pg_temp.try_verification_write(format('UPDATE public.users SET terms_accepted_at=now()-interval ''1 year'' WHERE id=%L',member_id)),
      'spoofed_timestamp_rpc',pg_temp.try_verification_write('SELECT public.record_own_consents(''{"terms_accepted_at":"2000-01-01"}''::jsonb)'));
    PERFORM set_config('request.jwt.claim.sub',outsider_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'role','authenticated')::text,true);
    consent_results := consent_results || jsonb_build_object('other_user_log_rows_visible',(SELECT count(*) FROM public.consent_log WHERE user_id=member_id),'anonymous_consent_execute',has_function_privilege('anon','public.record_own_consents(jsonb)','EXECUTE'));
    RESET ROLE;
    -- Variables survive the subtransaction rollback; all fixture writes do not.
    RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback all verification fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  RETURN jsonb_build_object('membership',observations,'leave_rpc',leave_results,'consents',consent_results,'fixtures_rolled_back',NOT EXISTS(SELECT 1 FROM public.users WHERE id IN(owner_id,member_id,peer_id,outsider_id)));
END;
$$;
SELECT pg_temp.verify_membership_and_consents() AS evidence;
