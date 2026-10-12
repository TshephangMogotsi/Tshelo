CREATE OR REPLACE FUNCTION public.is_organization_member(p_organization_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members m JOIN public.organizations o ON o.id=m.organization_id
    WHERE m.organization_id=p_organization_id AND m.user_id=auth.uid()
      AND m.is_active IS TRUE AND o.is_active IS TRUE
  );
$$;
CREATE OR REPLACE FUNCTION public.is_recurring_group_owner(p_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.recurring_groups g WHERE g.id=p_group_id AND g.owner_id=auth.uid()
  );
$$;
CREATE OR REPLACE FUNCTION public.is_recurring_group_member(p_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_recurring_group_owner(p_group_id) OR EXISTS (
    SELECT 1 FROM public.recurring_group_members m
    WHERE m.group_id=p_group_id AND m.user_id=auth.uid() AND m.status='joined'
  ));
$$;
REVOKE ALL ON FUNCTION public.is_organization_member(uuid),
  public.is_recurring_group_owner(uuid), public.is_recurring_group_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid),
  public.is_recurring_group_owner(uuid), public.is_recurring_group_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select ON public.organization_members FOR SELECT TO authenticated USING (public.is_organization_member(organization_id));
DROP POLICY IF EXISTS org_payouts_select ON public.organization_payouts;
CREATE POLICY org_payouts_select ON public.organization_payouts FOR SELECT TO authenticated USING (public.is_organization_member(organization_id));
DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated USING (public.is_organization_member(id));
DROP POLICY IF EXISTS recurring_group_members_select ON public.recurring_group_members;
CREATE POLICY recurring_group_members_select ON public.recurring_group_members FOR SELECT TO authenticated USING (public.is_recurring_group_member(group_id));
DROP POLICY IF EXISTS recurring_groups_select ON public.recurring_groups;
CREATE POLICY recurring_groups_select ON public.recurring_groups FOR SELECT TO authenticated USING (public.is_recurring_group_member(id));
DROP POLICY IF EXISTS recurring_rounds_select ON public.recurring_rounds;
CREATE POLICY recurring_rounds_select ON public.recurring_rounds FOR SELECT TO authenticated USING (public.is_recurring_group_member(group_id));
DROP POLICY IF EXISTS recurring_group_members_insert ON public.recurring_group_members;
CREATE POLICY recurring_group_members_insert ON public.recurring_group_members FOR INSERT TO authenticated WITH CHECK (public.is_recurring_group_owner(group_id));
