-- Strict joined-only vouch-read matrix. Synthetic records and leave operations
-- roll back before PASS is returned; no real user's vouches are read or changed.
CREATE OR REPLACE FUNCTION pg_temp.assert_vouch(ok boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Vouch membership regression: %',message; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION pg_temp.verify_vouch_membership()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  author_id uuid := 'f7000000-0000-4000-8000-000000000001';
  recipient_id uuid := 'f7000000-0000-4000-8000-000000000002';
  observer_id uuid := 'f7000000-0000-4000-8000-000000000003';
  owner_id uuid := 'f7000000-0000-4000-8000-000000000004';
  other_owner_id uuid := 'f7000000-0000-4000-8000-000000000005';
  fid uuid := 'f8000000-0000-4000-8000-000000000001';
  other_fid uuid := 'f8000000-0000-4000-8000-000000000002';
  actor uuid; state text; matrix jsonb := '[]'; leave_checks int := 0;
BEGIN
  BEGIN
    INSERT INTO public.users(id,phone,name,preferred_currency)
    VALUES(author_id,'+26770000501','Vouch fixture author','BWP'),
          (recipient_id,'+26770000502','Vouch fixture recipient','BWP'),
          (observer_id,'+26770000503','Vouch fixture observer','BWP'),
          (owner_id,'+26770000504','Vouch fixture owner','BWP'),
          (other_owner_id,'+26770000505','Vouch fixture other owner','BWP');
    PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
    INSERT INTO public.funds(id,owner_id,fund_code,share_code,title,fund_type,currency_code,goal_amount,status)
    VALUES(fid,owner_id,'VOUCHCHK','VOUCH-READ-CHECK','Vouch access fixture','other','BWP',10000,'active'),
          (other_fid,other_owner_id,'VOUCHXFD','VOUCH-CROSS-CHECK','Vouch cross-fund fixture','other','BWP',10000,'active');
    INSERT INTO public.fund_members(fund_id,user_id,role,status,invited_by,joined_at)
    VALUES(fid,author_id,'member','joined',owner_id,now()),
          (fid,recipient_id,'member','joined',owner_id,now()),
          (fid,observer_id,'member','joined',owner_id,now());
    -- A historical vouch in an unrelated fund must not leak to its named parties.
    INSERT INTO public.member_vouches(fund_id,voucher_user_id,vouched_for_user_id,vouch_type)
    VALUES(fid,author_id,recipient_id,'verification'),(other_fid,author_id,recipient_id,'verification');

    FOREACH actor IN ARRAY ARRAY[author_id,recipient_id,observer_id] LOOP
      FOREACH state IN ARRAY ARRAY['joined','pending','left','removed','declined','none'] LOOP
        RESET ROLE;
        PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
        PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
        IF state='none' THEN
          DELETE FROM public.fund_members WHERE fund_id=fid AND user_id=actor;
        ELSE
          UPDATE public.fund_members SET status=state::public.member_status WHERE fund_id=fid AND user_id=actor;
        END IF;
        PERFORM set_config('request.jwt.claim.sub',actor::text,true);
        PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
        SET LOCAL ROLE authenticated;
        PERFORM pg_temp.assert_vouch((SELECT count(*) FROM public.member_vouches WHERE fund_id=fid)=CASE WHEN state='joined' THEN 1 ELSE 0 END,'read access must require joined membership for every relationship/status');
        PERFORM pg_temp.assert_vouch(NOT EXISTS(SELECT 1 FROM public.member_vouches WHERE fund_id=other_fid),'named party cross-fund isolation');
        matrix := matrix || jsonb_build_array(jsonb_build_object('relationship',CASE actor WHEN author_id THEN 'author' WHEN recipient_id THEN 'recipient' ELSE 'other member' END,'membership',state,'readable',state='joined'));
      END LOOP;
    END LOOP;

    -- Actual leave RPC: row is retained as left and personal-vouch access ends.
    FOREACH actor IN ARRAY ARRAY[author_id,recipient_id] LOOP
      RESET ROLE;
      PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
      INSERT INTO public.fund_members(fund_id,user_id,role,status,invited_by,joined_at)
      VALUES(fid,actor,'member','joined',owner_id,now());
      PERFORM set_config('request.jwt.claim.sub',actor::text,true);
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
      SET LOCAL ROLE authenticated;
      PERFORM pg_temp.assert_vouch(EXISTS(SELECT 1 FROM public.member_vouches WHERE fund_id=fid),'joined party read before leave');
      PERFORM public.leave_fund(fid);
      PERFORM pg_temp.assert_vouch(EXISTS(SELECT 1 FROM public.fund_members WHERE fund_id=fid AND user_id=actor AND status='left'),'leave must retain left membership');
      PERFORM pg_temp.assert_vouch(NOT EXISTS(SELECT 1 FROM public.member_vouches WHERE fund_id IN(fid,other_fid)),'leave must immediately hide authored/received vouches');
      leave_checks := leave_checks+1;
    END LOOP;
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub','',true);
    PERFORM set_config('request.jwt.claim.role','anon',true);
    PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
    SET LOCAL ROLE anon;
    BEGIN
      PERFORM pg_temp.assert_vouch(NOT EXISTS(SELECT 1 FROM public.member_vouches WHERE fund_id IN(fid,other_fid)),'anonymous vouch read');
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
    SET LOCAL ROLE service_role;
    PERFORM pg_temp.assert_vouch((SELECT count(*) FROM public.member_vouches WHERE fund_id IN(fid,other_fid))=2,'trusted backend reads preserved');
    RESET ROLE;
    RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback vouch membership fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  IF EXISTS(SELECT 1 FROM public.users WHERE id IN(author_id,recipient_id,observer_id,owner_id,other_owner_id))
    OR EXISTS(SELECT 1 FROM public.funds WHERE id IN(fid,other_fid))
    OR EXISTS(SELECT 1 FROM public.member_vouches WHERE fund_id IN(fid,other_fid)) THEN
    RAISE EXCEPTION 'Vouch fixtures were not rolled back';
  END IF;
  RETURN jsonb_build_object('result','PASS','relationship_status_cases',jsonb_array_length(matrix),'matrix',matrix,'actual_leave_checks',leave_checks,'cross_fund_isolation',true,'anonymous_denied',true,'trusted_backend_reads',true,'fixtures_rolled_back',true);
END;
$$;
SELECT pg_temp.verify_vouch_membership() AS evidence;
