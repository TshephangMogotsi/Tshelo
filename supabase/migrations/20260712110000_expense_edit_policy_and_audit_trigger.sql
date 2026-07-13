-- Expense editing: only fund organisers (fund owner, or members with role
-- owner/admin) may update expense rows. Mirrors the expenses_insert policy.
CREATE POLICY expenses_update ON public.expenses
  AS PERMISSIVE FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM funds f
    WHERE f.id = expenses.fund_id
      AND (f.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM fund_members fm
        WHERE fm.fund_id = f.id
          AND fm.user_id = auth.uid()
          AND fm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role])
      ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM funds f
    WHERE f.id = expenses.fund_id
      AND (f.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM fund_members fm
        WHERE fm.fund_id = f.id
          AND fm.user_id = auth.uid()
          AND fm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role])
      ))
  ));

-- Audit trail: every expense create/edit/soft-delete is written to audit_log
-- by trigger, so entries cannot be forged or skipped by the client.
-- SECURITY DEFINER lets the trigger insert despite audit_log having no
-- INSERT policy (reads stay governed by audit_log_select: joined members).
CREATE OR REPLACE FUNCTION public.log_expense_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_old jsonb := '{}'::jsonb;
  changed_new jsonb := '{}'::jsonb;
  act varchar(50);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (fund_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.fund_id, auth.uid(), 'created', 'expense', NEW.id,
            jsonb_build_object(
              'description', NEW.description,
              'vendor_name', NEW.vendor_name,
              'amount',      NEW.amount,
              'category',    NEW.category
            ));
    RETURN NEW;
  END IF;

  act := CASE
    WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN 'deleted'
    ELSE 'updated'
  END;

  IF NEW.description IS DISTINCT FROM OLD.description THEN
    changed_old := changed_old || jsonb_build_object('description', OLD.description);
    changed_new := changed_new || jsonb_build_object('description', NEW.description);
  END IF;
  IF NEW.item_name IS DISTINCT FROM OLD.item_name THEN
    changed_old := changed_old || jsonb_build_object('item_name', OLD.item_name);
    changed_new := changed_new || jsonb_build_object('item_name', NEW.item_name);
  END IF;
  IF NEW.vendor_name IS DISTINCT FROM OLD.vendor_name THEN
    changed_old := changed_old || jsonb_build_object('vendor_name', OLD.vendor_name);
    changed_new := changed_new || jsonb_build_object('vendor_name', NEW.vendor_name);
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    changed_old := changed_old || jsonb_build_object('amount', OLD.amount);
    changed_new := changed_new || jsonb_build_object('amount', NEW.amount);
  END IF;
  IF NEW.category IS DISTINCT FROM OLD.category THEN
    changed_old := changed_old || jsonb_build_object('category', OLD.category);
    changed_new := changed_new || jsonb_build_object('category', NEW.category);
  END IF;

  -- Skip no-op updates (e.g. updated_at-only touches)
  IF act = 'updated' AND changed_old = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  INSERT INTO audit_log (fund_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (NEW.fund_id, auth.uid(), act, 'expense', NEW.id,
          NULLIF(changed_old, '{}'::jsonb), NULLIF(changed_new, '{}'::jsonb));
  RETURN NEW;
END $$;

CREATE TRIGGER expenses_audit
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_expense_changes();
