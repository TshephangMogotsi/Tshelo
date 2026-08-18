-- Read-side support for the version-one API.
--
-- Platform administrators already have caller-scoped SELECT policies for the
-- primary resources. Detail and relationship-filtered API reads also touch
-- these relationship tables, so grant the same read-only visibility here.
-- App users retain their existing row-level policies; no write access is added.

CREATE POLICY platform_admin_read_fund_members
  ON public.fund_members
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE POLICY platform_admin_read_event_organisers
  ON public.event_organisers
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE POLICY platform_admin_read_event_guests
  ON public.event_guests
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_platform_admin()));

-- Default list ordering is created_at plus id as a deterministic tie-breaker.
-- These partial/composite indexes serve the API's bounded pages without
-- replacing the existing single-column indexes used elsewhere in the app.

CREATE INDEX api_users_created_page_idx
  ON public.users (created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX api_funds_created_page_idx
  ON public.funds (created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX api_events_created_page_idx
  ON public.events (created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX api_contributions_created_page_idx
  ON public.contributions (created_at DESC, id DESC);

CREATE INDEX api_support_tickets_created_page_idx
  ON public.support_tickets (created_at DESC, id DESC);

CREATE INDEX api_platform_admin_audit_created_page_idx
  ON public.platform_admin_audit_log (created_at DESC, id DESC);

-- Relationship filters are used by `member_user_id` and
-- `participant_user_id`. Include the resource ID so those lookups do not need
-- a second heap pass simply to obtain the IDs used by the primary query.

CREATE INDEX api_fund_members_user_fund_idx
  ON public.fund_members (user_id, fund_id)
  WHERE status NOT IN ('left', 'removed', 'declined', 'pending');

CREATE INDEX api_event_organisers_user_event_idx
  ON public.event_organisers (user_id, event_id)
  WHERE status NOT IN ('left', 'removed');

CREATE INDEX api_event_guests_user_event_idx
  ON public.event_guests (user_id, event_id);

COMMENT ON POLICY platform_admin_read_fund_members ON public.fund_members IS
  'Allows active platform administrators to calculate and filter fund membership through caller-scoped API reads.';

COMMENT ON POLICY platform_admin_read_event_organisers ON public.event_organisers IS
  'Allows active platform administrators to filter event participation through caller-scoped API reads.';

COMMENT ON POLICY platform_admin_read_event_guests ON public.event_guests IS
  'Allows active platform administrators to inspect event guests through caller-scoped API reads.';
