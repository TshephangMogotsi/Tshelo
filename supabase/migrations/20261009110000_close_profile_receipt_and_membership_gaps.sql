-- Close the remaining findings from the 5 October security review.
-- Profile/payment and consent changes are deliberately routed through narrowly
-- scoped RPCs; clients no longer hold UPDATE privileges for those columns.

REVOKE UPDATE (
  mobile_money_provider, mobile_money_number, mobile_money_name,
  bank_name, bank_account_number, bank_account_name, bank_branch_code,
  terms_accepted_at, terms_version, privacy_accepted_at, privacy_version,
  marketing_consent, marketing_consent_at, marketing_email_enabled,
  marketing_sms_enabled, marketing_push_enabled,
  data_processing_consent, data_processing_consent_at
) ON public.users FROM authenticated;

-- Consent history is an audit trail, not a client-authored activity feed.
REVOKE INSERT, UPDATE, DELETE ON public.consent_log FROM PUBLIC, anon, authenticated;

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
  mobile_changed boolean := false;
  bank_changed boolean := false;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_details IS NULL OR jsonb_typeof(p_details) <> 'object'
    OR p_details - ARRAY['mobile_money_provider', 'mobile_money_number', 'mobile_money_name', 'bank_name', 'bank_account_number', 'bank_account_name', 'bank_branch_code'] <> '{}'::jsonb
  THEN RAISE EXCEPTION 'PAYMENT_DETAILS_INVALID'; END IF;

  SELECT * INTO profile FROM public.users WHERE id = caller_id AND deleted_at IS NULL FOR UPDATE;
  IF profile.id IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

  next_mobile_provider := CASE WHEN p_details ? 'mobile_money_provider' THEN NULLIF(p_details->>'mobile_money_provider', '')::public.payment_method ELSE profile.mobile_money_provider END;
  next_mobile_number := CASE WHEN p_details ? 'mobile_money_number' THEN NULLIF(btrim(p_details->>'mobile_money_number'), '') ELSE profile.mobile_money_number END;
  next_mobile_name := CASE WHEN p_details ? 'mobile_money_name' THEN NULLIF(btrim(p_details->>'mobile_money_name'), '') ELSE profile.mobile_money_name END;
  next_bank_name := CASE WHEN p_details ? 'bank_name' THEN NULLIF(btrim(p_details->>'bank_name'), '') ELSE profile.bank_name END;
  next_bank_account_number := CASE WHEN p_details ? 'bank_account_number' THEN NULLIF(btrim(p_details->>'bank_account_number'), '') ELSE profile.bank_account_number END;
  next_bank_account_name := CASE WHEN p_details ? 'bank_account_name' THEN NULLIF(btrim(p_details->>'bank_account_name'), '') ELSE profile.bank_account_name END;
  next_bank_branch_code := CASE WHEN p_details ? 'bank_branch_code' THEN NULLIF(btrim(p_details->>'bank_branch_code'), '') ELSE profile.bank_branch_code END;

  mobile_changed := (next_mobile_provider, next_mobile_number, next_mobile_name) IS DISTINCT FROM (profile.mobile_money_provider, profile.mobile_money_number, profile.mobile_money_name);
  bank_changed := (next_bank_name, next_bank_account_number, next_bank_account_name, next_bank_branch_code) IS DISTINCT FROM (profile.bank_name, profile.bank_account_number, profile.bank_account_name, profile.bank_branch_code);
  IF NOT mobile_changed AND NOT bank_changed THEN RETURN; END IF;

  UPDATE public.users
  SET mobile_money_provider = next_mobile_provider,
      mobile_money_number = next_mobile_number,
      mobile_money_name = next_mobile_name,
      bank_name = next_bank_name,
      bank_account_number = next_bank_account_number,
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
REVOKE ALL ON FUNCTION public.update_own_payment_details(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_payment_details(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_own_consents(p_consents jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  profile public.users%ROWTYPE;
  next_marketing boolean;
  next_email boolean;
  next_sms boolean;
  next_push boolean;
  next_processing boolean;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_consents IS NULL OR jsonb_typeof(p_consents) <> 'object'
    OR p_consents - ARRAY['terms_version', 'privacy_version', 'marketing_consent', 'marketing_email_enabled', 'marketing_sms_enabled', 'marketing_push_enabled', 'data_processing_consent'] <> '{}'::jsonb
  THEN RAISE EXCEPTION 'CONSENT_INVALID'; END IF;
  SELECT * INTO profile FROM public.users WHERE id = caller_id AND deleted_at IS NULL FOR UPDATE;
  IF profile.id IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

  next_marketing := CASE WHEN p_consents ? 'marketing_consent' THEN (p_consents->>'marketing_consent')::boolean ELSE profile.marketing_consent END;
  next_email := CASE WHEN p_consents ? 'marketing_email_enabled' THEN (p_consents->>'marketing_email_enabled')::boolean ELSE profile.marketing_email_enabled END;
  next_sms := CASE WHEN p_consents ? 'marketing_sms_enabled' THEN (p_consents->>'marketing_sms_enabled')::boolean ELSE profile.marketing_sms_enabled END;
  next_push := CASE WHEN p_consents ? 'marketing_push_enabled' THEN (p_consents->>'marketing_push_enabled')::boolean ELSE profile.marketing_push_enabled END;
  next_processing := CASE WHEN p_consents ? 'data_processing_consent' THEN (p_consents->>'data_processing_consent')::boolean ELSE profile.data_processing_consent END;
  next_marketing := next_marketing OR next_email OR next_sms OR next_push;

  UPDATE public.users SET
    terms_version = CASE WHEN p_consents ? 'terms_version' THEN NULLIF(btrim(p_consents->>'terms_version'), '') ELSE terms_version END,
    terms_accepted_at = CASE WHEN p_consents ? 'terms_version' THEN now() ELSE terms_accepted_at END,
    privacy_version = CASE WHEN p_consents ? 'privacy_version' THEN NULLIF(btrim(p_consents->>'privacy_version'), '') ELSE privacy_version END,
    privacy_accepted_at = CASE WHEN p_consents ? 'privacy_version' THEN now() ELSE privacy_accepted_at END,
    marketing_consent = next_marketing,
    marketing_consent_at = CASE WHEN next_marketing AND NOT profile.marketing_consent THEN now() WHEN NOT next_marketing THEN NULL ELSE marketing_consent_at END,
    marketing_email_enabled = next_email, marketing_sms_enabled = next_sms, marketing_push_enabled = next_push,
    data_processing_consent = next_processing,
    data_processing_consent_at = CASE WHEN next_processing IS DISTINCT FROM profile.data_processing_consent THEN now() ELSE data_processing_consent_at END,
    updated_at = now()
  WHERE id = caller_id;

  IF p_consents ? 'terms_version' THEN INSERT INTO public.consent_log (user_id, consent_type, consent_version, action) VALUES (caller_id, 'terms', p_consents->>'terms_version', 'accepted'); END IF;
  IF p_consents ? 'privacy_version' THEN INSERT INTO public.consent_log (user_id, consent_type, consent_version, action) VALUES (caller_id, 'privacy', p_consents->>'privacy_version', 'accepted'); END IF;
  IF p_consents ? 'data_processing_consent' AND next_processing IS DISTINCT FROM profile.data_processing_consent THEN INSERT INTO public.consent_log (user_id, consent_type, action) VALUES (caller_id, 'data_processing', CASE WHEN next_processing THEN 'granted' ELSE 'withdrawn' END); END IF;
  IF (p_consents ?| ARRAY['marketing_consent', 'marketing_email_enabled', 'marketing_sms_enabled', 'marketing_push_enabled']) AND next_marketing IS DISTINCT FROM profile.marketing_consent THEN INSERT INTO public.consent_log (user_id, consent_type, action) VALUES (caller_id, 'marketing', CASE WHEN next_marketing THEN 'granted' ELSE 'withdrawn' END); END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.record_own_consents(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_own_consents(jsonb) TO authenticated, service_role;

CREATE TABLE public.receipt_scan_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id), fund_id uuid NOT NULL REFERENCES public.funds(id),
  receipt_path text, model text NOT NULL, model_version text, result jsonb, failure_code text,
  user_edits jsonb, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
ALTER TABLE public.receipt_scan_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.receipt_scan_audit_log FROM PUBLIC, anon, authenticated;
CREATE INDEX receipt_scan_audit_log_user_created_idx ON public.receipt_scan_audit_log (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_receipt_scan(p_user_id uuid, p_fund_id uuid, p_receipt_path text, p_model text, p_model_version text, p_result jsonb DEFAULT NULL, p_failure_code text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE audit_id uuid; BEGIN
  IF auth.role() <> 'service_role' OR p_user_id IS NULL THEN RAISE EXCEPTION 'RECEIPT_SCAN_FORBIDDEN'; END IF;
  INSERT INTO public.receipt_scan_audit_log (user_id, fund_id, receipt_path, model, model_version, result, failure_code)
  VALUES (p_user_id, p_fund_id, NULLIF(p_receipt_path, ''), p_model, NULLIF(p_model_version, ''), p_result, NULLIF(p_failure_code, '')) RETURNING id INTO audit_id;
  RETURN audit_id;
END; $$;
CREATE OR REPLACE FUNCTION public.complete_receipt_scan(p_audit_id uuid, p_user_edits jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_edits IS NULL OR jsonb_typeof(p_user_edits) <> 'object' THEN RAISE EXCEPTION 'RECEIPT_SCAN_INVALID'; END IF;
  UPDATE public.receipt_scan_audit_log SET user_edits = p_user_edits, completed_at = now() WHERE id = p_audit_id AND user_id = auth.uid() AND completed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECEIPT_SCAN_NOT_FOUND'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.log_receipt_scan(uuid, uuid, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_receipt_scan(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_receipt_scan(uuid, uuid, text, text, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_receipt_scan(uuid, jsonb) TO authenticated, service_role;

-- A retained pending/left membership is not authorization. Use the joined-only
-- helper in every remaining legacy policy named in the assessment.
DROP POLICY IF EXISTS contribution_edits_select ON public.contribution_edits;
CREATE POLICY contribution_edits_select ON public.contribution_edits FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.contributions c WHERE c.id = contribution_id AND public.is_fund_member(c.fund_id)));
DROP POLICY IF EXISTS contribution_reminders_select ON public.contribution_reminders;
CREATE POLICY contribution_reminders_select ON public.contribution_reminders FOR SELECT TO authenticated USING (public.is_fund_member(fund_id));
DROP POLICY IF EXISTS expense_edits_select ON public.expense_edits;
CREATE POLICY expense_edits_select ON public.expense_edits FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_id AND public.is_fund_member(e.fund_id)));
DROP POLICY IF EXISTS expense_queries_insert ON public.expense_queries;
CREATE POLICY expense_queries_insert ON public.expense_queries FOR INSERT TO authenticated WITH CHECK (asked_by = auth.uid() AND public.is_fund_member(fund_id));
DROP POLICY IF EXISTS expense_queries_select ON public.expense_queries;
CREATE POLICY expense_queries_select ON public.expense_queries FOR SELECT TO authenticated USING (public.is_fund_member(fund_id));
DROP POLICY IF EXISTS fund_announcements_select ON public.fund_announcements;
CREATE POLICY fund_announcements_select ON public.fund_announcements FOR SELECT TO authenticated USING (public.is_fund_member(fund_id));
DROP POLICY IF EXISTS fund_exports_select ON public.fund_exports;
CREATE POLICY fund_exports_select ON public.fund_exports FOR SELECT TO authenticated USING (public.is_fund_member(fund_id));
DROP POLICY IF EXISTS fund_milestones_select ON public.fund_milestones;
CREATE POLICY fund_milestones_select ON public.fund_milestones FOR SELECT TO authenticated USING (public.is_fund_member(fund_id));
DROP POLICY IF EXISTS ownership_history_select ON public.fund_ownership_history;
CREATE POLICY ownership_history_select ON public.fund_ownership_history FOR SELECT TO authenticated USING (public.is_fund_member(fund_id));
DROP POLICY IF EXISTS fund_shares_select ON public.fund_shares;
CREATE POLICY fund_shares_select ON public.fund_shares FOR SELECT TO authenticated USING (public.is_fund_member(fund_id));
DROP POLICY IF EXISTS fund_shares_insert ON public.fund_shares;
CREATE POLICY fund_shares_insert ON public.fund_shares FOR INSERT TO authenticated WITH CHECK (shared_by = auth.uid() AND public.is_fund_member(fund_id));
DROP POLICY IF EXISTS succession_requests_insert ON public.fund_succession_requests;
CREATE POLICY succession_requests_insert ON public.fund_succession_requests FOR INSERT TO authenticated WITH CHECK (requester_user_id = auth.uid() AND public.is_fund_owner(fund_id));
DROP POLICY IF EXISTS succession_requests_select ON public.fund_succession_requests;
CREATE POLICY succession_requests_select ON public.fund_succession_requests FOR SELECT TO authenticated USING (public.is_fund_member(fund_id));
DROP POLICY IF EXISTS succession_votes_insert ON public.fund_succession_votes;
CREATE POLICY succession_votes_insert ON public.fund_succession_votes FOR INSERT TO authenticated WITH CHECK (voter_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.fund_succession_requests r WHERE r.id = request_id AND public.is_fund_member(r.fund_id)));
DROP POLICY IF EXISTS succession_votes_select ON public.fund_succession_votes;
CREATE POLICY succession_votes_select ON public.fund_succession_votes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.fund_succession_requests r WHERE r.id = request_id AND public.is_fund_member(r.fund_id)));
DROP POLICY IF EXISTS fund_reports_insert ON public.fund_reports;
CREATE POLICY fund_reports_insert ON public.fund_reports FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid() AND public.is_fund_member(fund_id));
DROP POLICY IF EXISTS rich_auntie_insert ON public.rich_auntie_sponsorships;
CREATE POLICY rich_auntie_insert ON public.rich_auntie_sponsorships FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_fund_member(fund_id));
DROP POLICY IF EXISTS rich_auntie_select ON public.rich_auntie_sponsorships;
CREATE POLICY rich_auntie_select ON public.rich_auntie_sponsorships FOR SELECT TO authenticated USING (public.is_fund_member(fund_id));
DROP POLICY IF EXISTS vouches_insert ON public.member_vouches;
CREATE POLICY vouches_insert ON public.member_vouches FOR INSERT TO authenticated WITH CHECK (voucher_user_id = auth.uid() AND public.is_fund_member(fund_id));
DROP POLICY IF EXISTS vouches_select ON public.member_vouches;
CREATE POLICY vouches_select ON public.member_vouches FOR SELECT TO authenticated USING (voucher_user_id = auth.uid() OR vouched_for_user_id = auth.uid() OR public.is_fund_member(fund_id));
