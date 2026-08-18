-- Transactional API boundaries for standalone event/fund creation and
-- privileged platform-admin mutations. These functions deliberately derive
-- the actor from auth.uid(); API clients must never supply an actor user ID.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.users(id);

COMMENT ON COLUMN public.support_tickets.resolution_note IS
  'Internal resolution summary written through the audited platform-admin RPC.';
COMMENT ON COLUMN public.support_tickets.resolved_by IS
  'Authenticated platform administrator who most recently resolved or closed the ticket.';

CREATE OR REPLACE FUNCTION public.require_platform_admin_operation(p_operation text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT admin.role
  INTO caller_role
  FROM public.platform_admins AS admin
  WHERE admin.user_id = caller_id
    AND admin.is_active;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE = '42501';
  END IF;

  IF NOT (CASE p_operation
    WHEN 'support.update' THEN caller_role IN ('support', 'operations', 'super_admin')
    WHEN 'users.moderate' THEN caller_role IN ('operations', 'super_admin')
    WHEN 'funds.moderate' THEN caller_role IN ('operations', 'super_admin')
    WHEN 'platform_admins.manage' THEN caller_role = 'super_admin'
    ELSE false
  END) THEN
    RAISE EXCEPTION 'Platform administrator role is not authorized for this operation'
      USING ERRCODE = '42501';
  END IF;

  RETURN caller_role;
END;
$$;

REVOKE ALL ON FUNCTION public.require_platform_admin_operation(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_standalone_event(
  p_name text,
  p_event_type text,
  p_event_date date,
  p_currency_code text,
  p_description text DEFAULT NULL,
  p_event_emoji text DEFAULT NULL,
  p_event_time time DEFAULT NULL,
  p_event_end_date date DEFAULT NULL,
  p_event_end_time time DEFAULT NULL,
  p_venue_name text DEFAULT NULL,
  p_venue_address text DEFAULT NULL,
  p_organisers jsonb DEFAULT '[]'::jsonb
)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_phone text;
  created_event public.events%ROWTYPE;
  organiser jsonb;
  organiser_name text;
  organiser_phone text;
  organiser_user_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT public.normalized_phone(profile.phone)
  INTO caller_phone
  FROM public.users AS profile
  WHERE profile.id = caller_id
    AND profile.deleted_at IS NULL
    AND NOT COALESCE(profile.is_banned, false);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active user profile required' USING ERRCODE = '42501';
  END IF;

  IF length(trim(COALESCE(p_name, ''))) < 3 OR length(trim(p_name)) > 200 THEN
    RAISE EXCEPTION 'Event name must contain between 3 and 200 characters'
      USING ERRCODE = '22023';
  END IF;
  IF length(trim(COALESCE(p_event_type, ''))) < 2 OR length(trim(p_event_type)) > 50
     OR p_event_type ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Event type must contain between 2 and 50 printable characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 4000 THEN
    RAISE EXCEPTION 'Event description cannot exceed 4000 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_event_emoji IS NOT NULL AND length(p_event_emoji) > 16 THEN
    RAISE EXCEPTION 'Event emoji cannot exceed 16 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_event_date IS NULL OR p_event_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Event date cannot be in the past' USING ERRCODE = '22023';
  END IF;
  IF p_event_end_date IS NOT NULL AND p_event_end_date < p_event_date THEN
    RAISE EXCEPTION 'Event end date cannot precede the event date' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_event_end_date, p_event_date) = p_event_date
     AND p_event_time IS NOT NULL
     AND p_event_end_time IS NOT NULL
     AND p_event_end_time < p_event_time THEN
    RAISE EXCEPTION 'Event end time cannot precede the start time' USING ERRCODE = '22023';
  END IF;
  IF p_venue_name IS NOT NULL AND length(trim(p_venue_name)) > 200 THEN
    RAISE EXCEPTION 'Venue name cannot exceed 200 characters' USING ERRCODE = '22023';
  END IF;
  IF p_venue_address IS NOT NULL AND length(p_venue_address) > 2000 THEN
    RAISE EXCEPTION 'Venue address cannot exceed 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF upper(trim(COALESCE(p_currency_code, ''))) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Currency code must be a three-letter ISO code' USING ERRCODE = '22023';
  END IF;
  IF p_organisers IS NULL OR jsonb_typeof(p_organisers) <> 'array' THEN
    RAISE EXCEPTION 'Organisers must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_organisers) > 20 THEN
    RAISE EXCEPTION 'A maximum of 20 organisers can be invited at creation time'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.events (
    creator_id,
    name,
    description,
    event_type,
    event_emoji,
    event_date,
    event_time,
    event_end_date,
    event_end_time,
    venue_name,
    venue_address,
    currency_code
  )
  VALUES (
    caller_id,
    trim(p_name),
    NULLIF(trim(p_description), ''),
    trim(p_event_type),
    NULLIF(trim(p_event_emoji), ''),
    p_event_date,
    p_event_time,
    COALESCE(p_event_end_date, CASE WHEN p_event_end_time IS NOT NULL THEN p_event_date END),
    p_event_end_time,
    NULLIF(trim(p_venue_name), ''),
    NULLIF(trim(p_venue_address), ''),
    upper(trim(p_currency_code))
  )
  RETURNING * INTO created_event;

  FOR organiser IN SELECT value FROM jsonb_array_elements(p_organisers)
  LOOP
    IF jsonb_typeof(organiser) <> 'object' THEN
      RAISE EXCEPTION 'Each organiser must be an object' USING ERRCODE = '22023';
    END IF;

    organiser_name := trim(COALESCE(organiser ->> 'name', ''));
    organiser_phone := public.normalized_phone(organiser ->> 'phone');

    IF length(organiser_name) < 1 OR length(organiser_name) > 100 THEN
      RAISE EXCEPTION 'Organiser name must contain between 1 and 100 characters'
        USING ERRCODE = '22023';
    END IF;
    IF length(organiser_phone) < 7 THEN
      RAISE EXCEPTION 'Organiser phone number is invalid' USING ERRCODE = '22023';
    END IF;

    -- The event creator is already the owner; silently ignore a self-invite.
    IF organiser_phone = caller_phone THEN
      CONTINUE;
    END IF;

    SELECT profile.id
    INTO organiser_user_id
    FROM public.users AS profile
    WHERE profile.deleted_at IS NULL
      AND public.normalized_phone(profile.phone) = organiser_phone
    ORDER BY profile.created_at
    LIMIT 1;

    INSERT INTO public.event_organisers (
      event_id,
      user_id,
      invited_phone,
      invited_name,
      role,
      invited_by,
      status,
      joined_at
    )
    VALUES (
      created_event.id,
      organiser_user_id,
      organiser_phone,
      organiser_name,
      'organiser'::public.organiser_role,
      caller_id,
      'pending',
      NULL
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN created_event;
END;
$$;

REVOKE ALL ON FUNCTION public.create_standalone_event(
  text, text, date, text, text, text, time, date, time, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_standalone_event(
  text, text, date, text, text, text, time, date, time, text, text, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.create_standalone_event(
  text, text, date, text, text, text, time, date, time, text, text, jsonb
) IS 'Creates a standalone event and its organiser invitations atomically for auth.uid().';

CREATE OR REPLACE FUNCTION public.create_fund_for_existing_event(
  p_event_id uuid,
  p_title text,
  p_currency_code text,
  p_description text DEFAULT NULL,
  p_fund_emoji text DEFAULT NULL,
  p_goal_amount numeric DEFAULT NULL,
  p_type_specific_data jsonb DEFAULT '{}'::jsonb,
  p_contribution_deadline date DEFAULT NULL,
  p_is_private boolean DEFAULT false
)
RETURNS public.funds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_event public.events%ROWTYPE;
  created_fund public.funds%ROWTYPE;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS profile
    WHERE profile.id = caller_id
      AND profile.deleted_at IS NULL
      AND NOT COALESCE(profile.is_banned, false)
  ) THEN
    RAISE EXCEPTION 'Active user profile required' USING ERRCODE = '42501';
  END IF;

  IF length(trim(COALESCE(p_title, ''))) < 3 OR length(trim(p_title)) > 200 THEN
    RAISE EXCEPTION 'Fund title must contain between 3 and 200 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 4000 THEN
    RAISE EXCEPTION 'Fund description cannot exceed 4000 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_fund_emoji IS NOT NULL AND length(p_fund_emoji) > 16 THEN
    RAISE EXCEPTION 'Fund emoji cannot exceed 16 characters' USING ERRCODE = '22023';
  END IF;
  IF p_goal_amount IS NOT NULL AND p_goal_amount < 0 THEN
    RAISE EXCEPTION 'Fund goal cannot be negative' USING ERRCODE = '22023';
  END IF;
  IF p_type_specific_data IS NULL OR jsonb_typeof(p_type_specific_data) <> 'object' THEN
    RAISE EXCEPTION 'Fund type-specific data must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF p_contribution_deadline IS NOT NULL AND p_contribution_deadline < CURRENT_DATE THEN
    RAISE EXCEPTION 'Contribution deadline cannot be in the past' USING ERRCODE = '22023';
  END IF;
  IF upper(trim(COALESCE(p_currency_code, ''))) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Currency code must be a three-letter ISO code' USING ERRCODE = '22023';
  END IF;

  SELECT event_row.*
  INTO target_event
  FROM public.events AS event_row
  WHERE event_row.id = p_event_id
  FOR UPDATE;

  IF NOT FOUND OR target_event.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'P0002';
  END IF;
  IF target_event.creator_id <> caller_id THEN
    RAISE EXCEPTION 'Only the event creator can create its contribution fund'
      USING ERRCODE = '42501';
  END IF;
  IF target_event.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'A contribution fund can only be linked to an active event'
      USING ERRCODE = '23514';
  END IF;
  IF target_event.linked_fund_id IS NOT NULL OR EXISTS (
    SELECT 1
    FROM public.event_fund_links AS link
    WHERE link.event_id = target_event.id
  ) THEN
    RAISE EXCEPTION 'This event already has a linked fund' USING ERRCODE = '23505';
  END IF;
  IF upper(trim(p_currency_code)) <> upper(target_event.currency_code::text) THEN
    RAISE EXCEPTION 'Fund currency must match the event currency' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.funds AS new_fund (
    owner_id,
    title,
    description,
    fund_type,
    fund_emoji,
    currency_code,
    goal_amount,
    type_specific_data,
    event_date,
    event_time,
    event_location,
    contribution_deadline,
    linked_event_id,
    is_private
  )
  VALUES (
    caller_id,
    trim(p_title),
    NULLIF(trim(p_description), ''),
    'eventFund',
    NULLIF(trim(p_fund_emoji), ''),
    upper(trim(p_currency_code)),
    p_goal_amount,
    p_type_specific_data,
    target_event.event_date,
    target_event.event_time,
    COALESCE(NULLIF(trim(target_event.venue_name::text), ''), NULLIF(trim(target_event.venue_address), '')),
    p_contribution_deadline,
    target_event.id,
    COALESCE(p_is_private, false)
  )
  RETURNING new_fund.* INTO created_fund;

  UPDATE public.events AS event_row
  SET linked_fund_id = created_fund.id,
      updated_at = now()
  WHERE event_row.id = target_event.id;

  INSERT INTO public.event_fund_links (
    event_id,
    fund_id,
    linked_by,
    link_type,
    tokens_spent,
    is_active
  )
  VALUES (
    target_event.id,
    created_fund.id,
    caller_id,
    'eventFund',
    0,
    true
  );

  RETURN created_fund;
END;
$$;

REVOKE ALL ON FUNCTION public.create_fund_for_existing_event(
  uuid, text, text, text, text, numeric, jsonb, date, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_fund_for_existing_event(
  uuid, text, text, text, text, numeric, jsonb, date, boolean
) TO authenticated;

COMMENT ON FUNCTION public.create_fund_for_existing_event(
  uuid, text, text, text, text, numeric, jsonb, date, boolean
) IS 'Creates and links one eventFund to an existing event owned by auth.uid(), atomically.';

CREATE OR REPLACE FUNCTION public.platform_admin_update_support_ticket(
  p_ticket_id uuid,
  p_patch jsonb
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target public.support_tickets%ROWTYPE;
  old_state jsonb;
  next_status text;
  next_priority text;
  next_assigned_to text;
  next_resolution_note text;
BEGIN
  PERFORM public.require_platform_admin_operation('support.update');

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'Ticket patch must be a non-empty JSON object' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_patch) AS patch_keys(key_name)
    WHERE key_name NOT IN ('status', 'priority', 'assigned_to', 'resolution_note')
  ) THEN
    RAISE EXCEPTION 'Ticket patch contains an unsupported field' USING ERRCODE = '22023';
  END IF;
  IF p_patch ? 'assigned_to'
     AND jsonb_typeof(p_patch -> 'assigned_to') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'Ticket assignee must be a string or null' USING ERRCODE = '22023';
  END IF;
  IF p_patch ? 'resolution_note'
     AND jsonb_typeof(p_patch -> 'resolution_note') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'Resolution note must be a string or null' USING ERRCODE = '22023';
  END IF;

  SELECT ticket.* INTO target
  FROM public.support_tickets AS ticket
  WHERE ticket.id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found' USING ERRCODE = 'P0002';
  END IF;

  next_status := CASE WHEN p_patch ? 'status' THEN p_patch ->> 'status' ELSE target.status::text END;
  next_priority := CASE WHEN p_patch ? 'priority' THEN p_patch ->> 'priority' ELSE target.priority::text END;
  next_assigned_to := CASE WHEN p_patch ? 'assigned_to' THEN NULLIF(trim(p_patch ->> 'assigned_to'), '') ELSE target.assigned_to::text END;
  next_resolution_note := CASE WHEN p_patch ? 'resolution_note' THEN NULLIF(trim(p_patch ->> 'resolution_note'), '') ELSE target.resolution_note END;

  IF next_status IS NULL
     OR next_status NOT IN ('open', 'pending', 'in_progress', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Unsupported support ticket status' USING ERRCODE = '22023';
  END IF;
  IF next_priority IS NULL OR next_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Unsupported support ticket priority' USING ERRCODE = '22023';
  END IF;
  IF next_assigned_to IS NOT NULL AND length(next_assigned_to) > 100 THEN
    RAISE EXCEPTION 'Ticket assignee cannot exceed 100 characters' USING ERRCODE = '22023';
  END IF;
  IF next_resolution_note IS NOT NULL AND length(next_resolution_note) > 4000 THEN
    RAISE EXCEPTION 'Resolution note cannot exceed 4000 characters' USING ERRCODE = '22023';
  END IF;

  old_state := jsonb_build_object(
    'status', target.status,
    'priority', target.priority,
    'assigned_to', target.assigned_to,
    'resolution_note', target.resolution_note,
    'resolved_at', target.resolved_at,
    'resolved_by', target.resolved_by
  );

  UPDATE public.support_tickets AS ticket
  SET status = next_status,
      priority = next_priority,
      assigned_to = next_assigned_to,
      resolution_note = next_resolution_note,
      resolved_at = CASE
        WHEN next_status IN ('resolved', 'closed') THEN COALESCE(ticket.resolved_at, now())
        ELSE NULL
      END,
      resolved_by = CASE
        WHEN next_status IN ('resolved', 'closed') THEN caller_id
        ELSE NULL
      END,
      updated_at = now()
  WHERE ticket.id = p_ticket_id
  RETURNING ticket.* INTO target;

  INSERT INTO public.platform_admin_audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    caller_id,
    'support_ticket.updated',
    'support_ticket',
    p_ticket_id,
    jsonb_build_object(
      'old', old_state,
      'new', jsonb_build_object(
        'status', target.status,
        'priority', target.priority,
        'assigned_to', target.assigned_to,
        'resolution_note', target.resolution_note,
        'resolved_at', target.resolved_at,
        'resolved_by', target.resolved_by
      )
    )
  );

  RETURN target;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_admin_update_support_ticket(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_update_support_ticket(uuid, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_admin_moderate_user(
  p_user_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  target public.users%ROWTYPE;
  old_state jsonb;
  clean_reason text := NULLIF(trim(p_reason), '');
BEGIN
  caller_role := public.require_platform_admin_operation('users.moderate');

  IF p_action IS NULL OR p_action NOT IN ('flag', 'unflag', 'ban', 'unban') THEN
    RAISE EXCEPTION 'Unsupported user moderation action' USING ERRCODE = '22023';
  END IF;
  IF p_action IN ('flag', 'ban') AND clean_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required for this moderation action' USING ERRCODE = '22023';
  END IF;
  IF clean_reason IS NOT NULL AND length(clean_reason) > 1000 THEN
    RAISE EXCEPTION 'Moderation reason cannot exceed 1000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_user_id = caller_id THEN
    RAISE EXCEPTION 'Administrators cannot moderate their own user account'
      USING ERRCODE = '42501';
  END IF;

  SELECT profile.* INTO target
  FROM public.users AS profile
  WHERE profile.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR target.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;
  IF caller_role <> 'super_admin' AND EXISTS (
    SELECT 1 FROM public.platform_admins AS admin
    WHERE admin.user_id = p_user_id AND admin.is_active
  ) THEN
    RAISE EXCEPTION 'Only a super administrator can moderate an active platform administrator'
      USING ERRCODE = '42501';
  END IF;
  IF p_action = 'unflag' AND COALESCE(target.is_banned, false) THEN
    RAISE EXCEPTION 'A banned user must be unbanned before their flag can be removed'
      USING ERRCODE = '23514';
  END IF;

  old_state := jsonb_build_object(
    'is_flagged', target.is_flagged,
    'is_banned', target.is_banned,
    'banned_at', target.banned_at,
    'banned_reason', target.banned_reason
  );

  UPDATE public.users AS profile
  SET is_flagged = CASE p_action
        WHEN 'flag' THEN true
        WHEN 'unflag' THEN false
        WHEN 'ban' THEN true
        ELSE profile.is_flagged
      END,
      is_banned = CASE p_action
        WHEN 'ban' THEN true
        WHEN 'unban' THEN false
        ELSE profile.is_banned
      END,
      banned_at = CASE p_action
        WHEN 'ban' THEN COALESCE(profile.banned_at, now())
        WHEN 'unban' THEN NULL
        ELSE profile.banned_at
      END,
      banned_reason = CASE p_action
        WHEN 'ban' THEN clean_reason
        WHEN 'unban' THEN NULL
        ELSE profile.banned_reason
      END,
      updated_at = now()
  WHERE profile.id = p_user_id
  RETURNING profile.* INTO target;

  INSERT INTO public.platform_admin_audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    caller_id,
    'user.' || p_action,
    'user',
    p_user_id,
    jsonb_build_object(
      'reason', clean_reason,
      'old', old_state,
      'new', jsonb_build_object(
        'is_flagged', target.is_flagged,
        'is_banned', target.is_banned,
        'banned_at', target.banned_at,
        'banned_reason', target.banned_reason
      )
    )
  );

  RETURN target;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_admin_moderate_user(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_moderate_user(uuid, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_admin_moderate_fund(
  p_fund_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS public.funds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target public.funds%ROWTYPE;
  old_status text;
  clean_reason text := NULLIF(trim(p_reason), '');
BEGIN
  PERFORM public.require_platform_admin_operation('funds.moderate');

  IF p_action IS NULL OR p_action NOT IN ('activate', 'close') THEN
    RAISE EXCEPTION 'Unsupported fund moderation action' USING ERRCODE = '22023';
  END IF;
  IF clean_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required for fund moderation' USING ERRCODE = '22023';
  END IF;
  IF length(clean_reason) > 1000 THEN
    RAISE EXCEPTION 'Moderation reason cannot exceed 1000 characters' USING ERRCODE = '22023';
  END IF;

  SELECT fund.* INTO target
  FROM public.funds AS fund
  WHERE fund.id = p_fund_id
  FOR UPDATE;

  IF NOT FOUND OR target.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Fund not found' USING ERRCODE = 'P0002';
  END IF;
  IF target.status = 'completed' THEN
    RAISE EXCEPTION 'A completed fund cannot be moderated back into operation'
      USING ERRCODE = '23514';
  END IF;
  IF p_action = 'close' AND target.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Only an active fund can be closed' USING ERRCODE = '23514';
  END IF;
  IF p_action = 'activate'
     AND (target.status IS NULL OR target.status NOT IN ('closed', 'cancelled')) THEN
    RAISE EXCEPTION 'Only a closed or cancelled fund can be activated'
      USING ERRCODE = '23514';
  END IF;

  old_status := target.status::text;

  UPDATE public.funds AS fund
  SET status = CASE p_action WHEN 'close' THEN 'closed' ELSE 'active' END,
      closed_at = CASE p_action WHEN 'close' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE fund.id = p_fund_id
  RETURNING fund.* INTO target;

  INSERT INTO public.platform_admin_audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    caller_id,
    'fund.' || p_action,
    'fund',
    p_fund_id,
    jsonb_build_object('reason', clean_reason, 'old_status', old_status, 'new_status', target.status)
  );

  RETURN target;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_admin_moderate_fund(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_moderate_fund(uuid, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_admin_upsert(
  p_user_id uuid,
  p_role text,
  p_status text
)
RETURNS TABLE(user_id uuid, role text, name text, phone text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_profile public.users%ROWTYPE;
  prior_admin public.platform_admins%ROWTYPE;
  had_prior_admin boolean := false;
  next_active boolean;
BEGIN
  PERFORM public.require_platform_admin_operation('platform_admins.manage');

  IF p_role IS NULL OR p_role NOT IN ('support', 'operations', 'finance', 'super_admin') THEN
    RAISE EXCEPTION 'Unsupported platform administrator role' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Unsupported platform administrator status' USING ERRCODE = '22023';
  END IF;
  next_active := p_status = 'active';

  -- Serialize changes that could remove the final active super administrator.
  LOCK TABLE public.platform_admins IN SHARE ROW EXCLUSIVE MODE;

  SELECT profile.* INTO target_profile
  FROM public.users AS profile
  WHERE profile.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR target_profile.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;
  IF next_active AND COALESCE(target_profile.is_banned, false) THEN
    RAISE EXCEPTION 'A banned user cannot be an active platform administrator'
      USING ERRCODE = '23514';
  END IF;

  SELECT admin.* INTO prior_admin
  FROM public.platform_admins AS admin
  WHERE admin.user_id = p_user_id;
  had_prior_admin := FOUND;

  IF p_user_id = caller_id AND (NOT next_active OR p_role <> 'super_admin') THEN
    RAISE EXCEPTION 'A super administrator cannot deactivate or demote their own access'
      USING ERRCODE = '42501';
  END IF;

  IF had_prior_admin
     AND prior_admin.is_active
     AND prior_admin.role = 'super_admin'
     AND (NOT next_active OR p_role <> 'super_admin')
     AND NOT EXISTS (
       SELECT 1
       FROM public.platform_admins AS other_admin
       WHERE other_admin.user_id <> p_user_id
         AND other_admin.is_active
         AND other_admin.role = 'super_admin'
     ) THEN
    RAISE EXCEPTION 'At least one active super administrator must remain'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.platform_admins AS admin (
    user_id, role, is_active, created_by, updated_at
  )
  VALUES (
    p_user_id, p_role, next_active, caller_id, now()
  )
  -- The function returns an output column named user_id, so name the
  -- constraint explicitly to avoid PL/pgSQL variable/column ambiguity.
  ON CONFLICT ON CONSTRAINT platform_admins_pkey DO UPDATE
  SET role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      updated_at = now();

  INSERT INTO public.platform_admin_audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    caller_id,
    CASE WHEN had_prior_admin THEN 'platform_admin.updated' ELSE 'platform_admin.created' END,
    'platform_admin',
    p_user_id,
    jsonb_build_object(
      'old', CASE
        WHEN had_prior_admin THEN jsonb_build_object(
          'role', prior_admin.role,
          'status', CASE WHEN prior_admin.is_active THEN 'active' ELSE 'inactive' END
        )
        ELSE NULL
      END,
      'new', jsonb_build_object('role', p_role, 'status', p_status)
    )
  );

  RETURN QUERY
  SELECT
    target_profile.id,
    p_role,
    target_profile.name::text,
    target_profile.phone::text,
    p_status;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_admin_upsert(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_upsert(uuid, text, text)
  TO authenticated;

COMMENT ON FUNCTION public.platform_admin_update_support_ticket(uuid, jsonb) IS
  'Role-checked support ticket patch and platform audit, committed atomically.';
COMMENT ON FUNCTION public.platform_admin_moderate_user(uuid, text, text) IS
  'Role-checked user flag/ban transition and platform audit, committed atomically.';
COMMENT ON FUNCTION public.platform_admin_moderate_fund(uuid, text, text) IS
  'Role-checked fund activation/closure and platform audit, committed atomically.';
COMMENT ON FUNCTION public.platform_admin_upsert(uuid, text, text) IS
  'Super-admin-only allowlist upsert with self-lockout protection and atomic audit.';
