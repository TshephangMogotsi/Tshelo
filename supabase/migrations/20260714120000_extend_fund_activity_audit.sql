-- Extend the immutable fund activity trail beyond expenses. Trigger-owned
-- writes ensure clients cannot omit or forge activity entries.

CREATE OR REPLACE FUNCTION public.log_contribution_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_old jsonb := '{}'::jsonb;
  changed_new jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (fund_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.fund_id, auth.uid(), 'created', 'contribution', NEW.id,
      jsonb_build_object(
        'contributor_name', NEW.contributor_name,
        'amount', NEW.amount,
        'currency_code', NEW.currency_code,
        'payment_method', NEW.payment_method,
        'reference_number', NEW.reference_number,
        'status', NEW.status
      ));
    RETURN NEW;
  END IF;

  IF NEW.contributor_name IS DISTINCT FROM OLD.contributor_name THEN
    changed_old := changed_old || jsonb_build_object('contributor_name', OLD.contributor_name);
    changed_new := changed_new || jsonb_build_object('contributor_name', NEW.contributor_name);
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    changed_old := changed_old || jsonb_build_object('amount', OLD.amount);
    changed_new := changed_new || jsonb_build_object('amount', NEW.amount);
  END IF;
  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    changed_old := changed_old || jsonb_build_object('payment_method', OLD.payment_method);
    changed_new := changed_new || jsonb_build_object('payment_method', NEW.payment_method);
  END IF;
  IF NEW.reference_number IS DISTINCT FROM OLD.reference_number THEN
    changed_old := changed_old || jsonb_build_object('reference_number', OLD.reference_number);
    changed_new := changed_new || jsonb_build_object('reference_number', NEW.reference_number);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    changed_old := changed_old || jsonb_build_object('status', OLD.status);
    changed_new := changed_new || jsonb_build_object('status', NEW.status);
  END IF;
  IF NEW.is_refunded IS DISTINCT FROM OLD.is_refunded THEN
    changed_old := changed_old || jsonb_build_object('is_refunded', OLD.is_refunded);
    changed_new := changed_new || jsonb_build_object('is_refunded', NEW.is_refunded);
  END IF;
  IF changed_old = '{}'::jsonb THEN RETURN NEW; END IF;

  INSERT INTO audit_log (fund_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (NEW.fund_id, auth.uid(), 'updated', 'contribution', NEW.id, changed_old, changed_new);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contributions_audit ON public.contributions;
CREATE TRIGGER contributions_audit
  AFTER INSERT OR UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.log_contribution_changes();

CREATE POLICY contributions_update_manager ON public.contributions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM funds f
    WHERE f.id = contributions.fund_id
      AND (f.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM fund_members fm
        WHERE fm.fund_id = f.id
          AND fm.user_id = auth.uid()
          AND fm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role])
          AND fm.status = 'joined'::member_status
      ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM funds f
    WHERE f.id = contributions.fund_id
      AND (f.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM fund_members fm
        WHERE fm.fund_id = f.id
          AND fm.user_id = auth.uid()
          AND fm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role])
          AND fm.status = 'joined'::member_status
      ))
  ));

CREATE OR REPLACE FUNCTION public.log_fund_member_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_old jsonb := '{}'::jsonb;
  changed_new jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (fund_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.fund_id, auth.uid(), 'created', 'member', NEW.id,
      jsonb_build_object('member_user_id', NEW.user_id, 'name', NEW.invited_name, 'role', NEW.role, 'status', NEW.status));
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    changed_old := changed_old || jsonb_build_object('role', OLD.role);
    changed_new := changed_new || jsonb_build_object('role', NEW.role);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    changed_old := changed_old || jsonb_build_object('status', OLD.status);
    changed_new := changed_new || jsonb_build_object('status', NEW.status);
  END IF;
  IF changed_old = '{}'::jsonb THEN RETURN NEW; END IF;
  INSERT INTO audit_log (fund_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (NEW.fund_id, auth.uid(), 'updated', 'member', NEW.id, changed_old, changed_new);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fund_members_audit ON public.fund_members;
CREATE TRIGGER fund_members_audit
  AFTER INSERT OR UPDATE ON public.fund_members
  FOR EACH ROW EXECUTE FUNCTION public.log_fund_member_changes();

CREATE OR REPLACE FUNCTION public.log_fund_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_old jsonb := '{}'::jsonb;
  changed_new jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (fund_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.id, auth.uid(), 'created', 'fund', NEW.id,
      jsonb_build_object(
        'title', NEW.title,
        'goal_amount', NEW.goal_amount,
        'contribution_deadline', NEW.contribution_deadline,
        'status', NEW.status,
        'is_private', NEW.is_private
      ));
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN
    changed_old := changed_old || jsonb_build_object('title', OLD.title);
    changed_new := changed_new || jsonb_build_object('title', NEW.title);
  END IF;
  IF NEW.goal_amount IS DISTINCT FROM OLD.goal_amount THEN
    changed_old := changed_old || jsonb_build_object('goal_amount', OLD.goal_amount);
    changed_new := changed_new || jsonb_build_object('goal_amount', NEW.goal_amount);
  END IF;
  IF NEW.contribution_deadline IS DISTINCT FROM OLD.contribution_deadline THEN
    changed_old := changed_old || jsonb_build_object('contribution_deadline', OLD.contribution_deadline);
    changed_new := changed_new || jsonb_build_object('contribution_deadline', NEW.contribution_deadline);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    changed_old := changed_old || jsonb_build_object('status', OLD.status);
    changed_new := changed_new || jsonb_build_object('status', NEW.status);
  END IF;
  IF NEW.is_private IS DISTINCT FROM OLD.is_private THEN
    changed_old := changed_old || jsonb_build_object('is_private', OLD.is_private);
    changed_new := changed_new || jsonb_build_object('is_private', NEW.is_private);
  END IF;
  IF changed_old = '{}'::jsonb THEN RETURN NEW; END IF;
  INSERT INTO audit_log (fund_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (NEW.id, auth.uid(), 'updated', 'fund', NEW.id, changed_old, changed_new);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS funds_audit ON public.funds;
CREATE TRIGGER funds_audit
  AFTER INSERT OR UPDATE ON public.funds
  FOR EACH ROW EXECUTE FUNCTION public.log_fund_changes();

-- The earlier expense trigger records soft deletes (deleted_at updates), while
-- this covers the existing owner-only hard-delete policy as well.
CREATE OR REPLACE FUNCTION public.log_expense_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (fund_id, user_id, action, entity_type, entity_id, old_values)
  VALUES (OLD.fund_id, auth.uid(), 'deleted', 'expense', OLD.id,
    jsonb_build_object(
      'description', OLD.description,
      'vendor_name', OLD.vendor_name,
      'amount', OLD.amount,
      'category', OLD.category
    ));
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS expenses_delete_audit ON public.expenses;
CREATE TRIGGER expenses_delete_audit
  BEFORE DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_expense_delete();
