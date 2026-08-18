-- Reports are assembled inside one SQL statement so financial records and
-- their complete audit/edit history share the same PostgreSQL snapshot.

CREATE INDEX IF NOT EXISTS audit_log_fund_created_id_idx
  ON public.audit_log (fund_id, created_at, id);

CREATE INDEX IF NOT EXISTS fund_exports_fund_created_id_idx
  ON public.fund_exports (fund_id, created_at, id);

CREATE OR REPLACE FUNCTION public.get_fund_report_bundle(p_fund_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH visible_fund AS (
    SELECT
      f.id,
      f.title,
      f.description,
      f.fund_type,
      f.fund_code,
      f.currency_code,
      f.goal_amount::text AS goal_amount,
      f.status,
      f.created_at,
      f.contribution_deadline,
      f.is_private
    FROM public.funds AS f
    WHERE f.id = p_fund_id
      AND f.deleted_at IS NULL
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM visible_fund) THEN NULL ELSE
    jsonb_build_object(
      'history_snapshot_at', statement_timestamp(),
      'fund', (SELECT to_jsonb(f) FROM visible_fund AS f),
      'contributions', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at, row_data.id)
        FROM (
          SELECT
            c.id,
            c.contributor_id,
            c.contributor_name,
            c.amount::text AS amount,
            c.pledged_amount::text AS pledged_amount,
            c.payment_method,
            c.reference_number,
            c.status,
            c.is_refunded,
            c.confirmed_at,
            c.created_at,
            c.notes
          FROM public.contributions AS c
          WHERE c.fund_id = p_fund_id
        ) AS row_data
      ), '[]'::jsonb),
      'expenses', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at, row_data.id)
        FROM (
          SELECT
            e.id,
            e.description,
            e.item_name,
            e.category,
            e.amount::text AS amount,
            e.vendor_name,
            e.receipt_url,
            e.is_sponsored,
            e.sponsored_by_user_id,
            e.sponsored_by_name,
            e.has_open_query,
            e.created_at,
            e.updated_at,
            e.deleted_at
          FROM public.expenses AS e
          WHERE e.fund_id = p_fund_id
        ) AS row_data
      ), '[]'::jsonb),
      'members', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at, row_data.id)
        FROM (
          SELECT
            fm.id,
            fm.user_id,
            fm.invited_name,
            fm.invited_phone,
            fm.role,
            fm.status,
            fm.invited_at,
            fm.joined_at,
            fm.created_at
          FROM public.fund_members AS fm
          WHERE fm.fund_id = p_fund_id
        ) AS row_data
      ), '[]'::jsonb),
      'contributors', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data) ORDER BY lower(row_data.display_name), row_data.id)
        FROM (
          SELECT fc.id, fc.user_id, fc.display_name, fc.phone, fc.contributor_type
          FROM public.fund_contributors AS fc
          WHERE fc.fund_id = p_fund_id
        ) AS row_data
      ), '[]'::jsonb),
      'pledge_balances', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at, row_data.pledge_id)
        FROM (
          SELECT
            pb.pledge_id,
            pb.contributor_id,
            pb.contributor_name,
            pb.pledged_amount::text AS pledged_amount,
            pb.allocated_amount::text AS allocated_amount,
            pb.outstanding_amount::text AS outstanding_amount,
            pb.pledge_state,
            pb.created_at
          FROM public.contributor_pledge_balances AS pb
          WHERE pb.fund_id = p_fund_id
        ) AS row_data
      ), '[]'::jsonb),
      'linked_event', (
        SELECT to_jsonb(row_data)
        FROM (
          SELECT e.name, e.event_date, e.venue_name
          FROM public.events AS e
          WHERE e.linked_fund_id = p_fund_id
            AND e.deleted_at IS NULL
          ORDER BY e.created_at, e.id
          LIMIT 1
        ) AS row_data
      ),
      'sponsorship_items', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at, row_data.id)
        FROM (
          SELECT
            item.id,
            item.title,
            item.target_amount::text AS target_amount,
            item.allocated_amount::text AS allocated_amount,
            item.outstanding_amount::text AS outstanding_amount,
            item.status,
            item.claimed_by_user_id,
            item.funded_at,
            item.fulfilled_at,
            item.created_at
          FROM public.fund_sponsorship_item_progress AS item
          WHERE item.fund_id = p_fund_id
        ) AS row_data
      ), '[]'::jsonb),
      'rich_auntie_awards', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at, row_data.id)
        FROM (
          SELECT award.id, award.recipient_user_id, award.sponsorship_item_id,
            award.reason_label, award.created_at
          FROM public.rich_auntie_awards AS award
          WHERE award.fund_id = p_fund_id
        ) AS row_data
      ), '[]'::jsonb),
      'member_profiles', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('user_id', profile.user_id, 'name', profile.name)
          ORDER BY profile.name, profile.user_id)
        FROM public.get_fund_member_profiles(p_fund_id) AS profile
      ), '[]'::jsonb),
      'audit_history', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at, row_data.id)
        FROM (
          SELECT audit.id, audit.user_id, audit.action, audit.entity_type,
            audit.entity_id, audit.old_values, audit.new_values, audit.created_at
          FROM public.audit_log AS audit
          WHERE audit.fund_id = p_fund_id
        ) AS row_data
      ), '[]'::jsonb),
      'contribution_edits', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at, row_data.id)
        FROM (
          SELECT edit.id, edit.contribution_id, edit.edited_by, edit.field_changed,
            edit.old_value, edit.new_value, edit.reason, edit.created_at
          FROM public.contribution_edits AS edit
          JOIN public.contributions AS contribution ON contribution.id = edit.contribution_id
          WHERE contribution.fund_id = p_fund_id
        ) AS row_data
      ), '[]'::jsonb),
      'expense_edits', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at, row_data.id)
        FROM (
          SELECT edit.id, edit.expense_id, edit.edited_by, edit.field_changed,
            edit.old_value, edit.new_value, edit.reason, edit.created_at
          FROM public.expense_edits AS edit
          JOIN public.expenses AS expense ON expense.id = edit.expense_id
          WHERE expense.fund_id = p_fund_id
        ) AS row_data
      ), '[]'::jsonb),
      'export_history', COALESCE((
        SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at, row_data.id)
        FROM (
          SELECT export_row.id, export_row.fund_id, export_row.exported_by, export_row.export_type,
            export_row.was_free, export_row.tokens_spent, export_row.created_at
          FROM public.fund_exports AS export_row
          WHERE export_row.fund_id = p_fund_id
        ) AS row_data
      ), '[]'::jsonb)
    )
  END
  FROM (SELECT 1) AS singleton;
$$;

REVOKE ALL ON FUNCTION public.get_fund_report_bundle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fund_report_bundle(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_fund_report_bundle(uuid) IS
  'Returns a caller-visible fund report and complete history from one database statement snapshot.';

CREATE OR REPLACE FUNCTION public.log_fund_export(
  p_fund_id uuid,
  p_export_type text
)
RETURNS public.fund_exports
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  created_export public.fund_exports;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '28000';
  END IF;

  IF p_export_type NOT IN ('pdf', 'csv', 'share') THEN
    RAISE EXCEPTION 'Unsupported export type.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_fund_permission(p_fund_id, 'export_reports') THEN
    RAISE EXCEPTION 'Report export permission is required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.fund_exports (
    fund_id, exported_by, export_type, was_free, tokens_spent
  ) VALUES (
    p_fund_id, auth.uid(), p_export_type, true, 0
  )
  RETURNING * INTO created_export;

  RETURN created_export;
END;
$$;

REVOKE ALL ON FUNCTION public.log_fund_export(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_fund_export(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.log_fund_export(uuid, text) IS
  'Records a permitted report export while deriving the exporter from auth.uid().';
