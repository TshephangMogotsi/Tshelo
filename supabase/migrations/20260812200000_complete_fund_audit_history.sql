-- Capture complete fund-facing record changes so the full PDF history can
-- show every stored field before and after an edit. Timestamp-only touches are
-- ignored, but no user-editable field is allow-listed or silently omitted.

CREATE OR REPLACE FUNCTION public.audit_changed_values(
  p_before jsonb,
  p_after jsonb,
  p_ignored_keys text[] DEFAULT ARRAY['updated_at']::text[]
)
RETURNS TABLE(old_values jsonb, new_values jsonb)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(jsonb_object_agg(key, p_before -> key) FILTER (
      WHERE (p_before -> key) IS DISTINCT FROM (p_after -> key)
    ), '{}'::jsonb),
    COALESCE(jsonb_object_agg(key, p_after -> key) FILTER (
      WHERE (p_before -> key) IS DISTINCT FROM (p_after -> key)
    ), '{}'::jsonb)
  FROM (
    SELECT key FROM jsonb_object_keys(p_before || p_after) AS key
    WHERE NOT (key = ANY (p_ignored_keys))
  ) AS changed_keys;
$$;

CREATE OR REPLACE FUNCTION public.log_contribution_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_old jsonb;
  changed_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.fund_id, auth.uid(), 'created', 'contribution', NEW.id, to_jsonb(NEW) - 'updated_at');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, old_values)
    VALUES (OLD.fund_id, auth.uid(), 'deleted', 'contribution', OLD.id, to_jsonb(OLD) - 'updated_at');
    RETURN OLD;
  END IF;

  SELECT diff.old_values, diff.new_values INTO changed_old, changed_new
  FROM public.audit_changed_values(to_jsonb(OLD), to_jsonb(NEW)) AS diff;
  IF changed_old = '{}'::jsonb THEN RETURN NEW; END IF;

  INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (NEW.fund_id, auth.uid(), 'updated', 'contribution', NEW.id, changed_old, changed_new);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contributions_audit ON public.contributions;
CREATE TRIGGER contributions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.log_contribution_changes();

CREATE OR REPLACE FUNCTION public.log_expense_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_old jsonb;
  changed_new jsonb;
  audit_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.fund_id, auth.uid(), 'created', 'expense', NEW.id, to_jsonb(NEW) - 'updated_at');
    RETURN NEW;
  END IF;

  SELECT diff.old_values, diff.new_values INTO changed_old, changed_new
  FROM public.audit_changed_values(to_jsonb(OLD), to_jsonb(NEW)) AS diff;
  IF changed_old = '{}'::jsonb THEN RETURN NEW; END IF;

  audit_action := CASE
    WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN 'deleted'
    WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN 'restored'
    ELSE 'updated'
  END;
  INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (NEW.fund_id, auth.uid(), audit_action, 'expense', NEW.id, changed_old, changed_new);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS expenses_audit ON public.expenses;
CREATE TRIGGER expenses_audit
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_expense_changes();

CREATE OR REPLACE FUNCTION public.log_expense_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, old_values)
  VALUES (OLD.fund_id, auth.uid(), 'deleted', 'expense', OLD.id, to_jsonb(OLD) - 'updated_at');
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.log_fund_member_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_old jsonb;
  changed_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.fund_id, auth.uid(), 'created', 'member', NEW.id, to_jsonb(NEW) - 'updated_at');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, old_values)
    VALUES (OLD.fund_id, auth.uid(), 'deleted', 'member', OLD.id, to_jsonb(OLD) - 'updated_at');
    RETURN OLD;
  END IF;

  SELECT diff.old_values, diff.new_values INTO changed_old, changed_new
  FROM public.audit_changed_values(to_jsonb(OLD), to_jsonb(NEW)) AS diff;
  IF changed_old = '{}'::jsonb THEN RETURN NEW; END IF;
  INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (NEW.fund_id, auth.uid(), 'updated', 'member', NEW.id, changed_old, changed_new);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fund_members_audit ON public.fund_members;
CREATE TRIGGER fund_members_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.fund_members
  FOR EACH ROW EXECUTE FUNCTION public.log_fund_member_changes();

CREATE OR REPLACE FUNCTION public.log_fund_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_old jsonb;
  changed_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.id, auth.uid(), 'created', 'fund', NEW.id, to_jsonb(NEW) - 'updated_at');
    RETURN NEW;
  END IF;

  SELECT diff.old_values, diff.new_values INTO changed_old, changed_new
  FROM public.audit_changed_values(to_jsonb(OLD), to_jsonb(NEW)) AS diff;
  IF changed_old = '{}'::jsonb THEN RETURN NEW; END IF;
  INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (NEW.id, auth.uid(), 'updated', 'fund', NEW.id, changed_old, changed_new);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.log_sponsorship_item_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_old jsonb;
  changed_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.fund_id, auth.uid(), 'created', 'sponsorship_item', NEW.id, to_jsonb(NEW) - 'updated_at');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, old_values)
    VALUES (OLD.fund_id, auth.uid(), 'deleted', 'sponsorship_item', OLD.id, to_jsonb(OLD) - 'updated_at');
    RETURN OLD;
  END IF;

  SELECT diff.old_values, diff.new_values INTO changed_old, changed_new
  FROM public.audit_changed_values(to_jsonb(OLD), to_jsonb(NEW)) AS diff;
  IF changed_old = '{}'::jsonb THEN RETURN NEW; END IF;
  INSERT INTO public.audit_log (fund_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (NEW.fund_id, auth.uid(), 'updated', 'sponsorship_item', NEW.id, changed_old, changed_new);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fund_sponsorship_items_audit ON public.fund_sponsorship_items;
CREATE TRIGGER fund_sponsorship_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.fund_sponsorship_items
  FOR EACH ROW EXECUTE FUNCTION public.log_sponsorship_item_changes();

REVOKE ALL ON FUNCTION public.audit_changed_values(jsonb, jsonb, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_changed_values(jsonb, jsonb, text[]) TO service_role;
