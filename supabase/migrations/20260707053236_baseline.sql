-- Baseline migration: captures the full public schema of the Tshelo
-- production database as of 2026-07-07, generated from pg_catalog
-- introspection (the project previously had no tracked migrations).
--
-- Notes:
-- * Extensions used: uuid-ossp, pgcrypto, pg_net (pre-installed on
--   Supabase; created here for local/CI rebuilds).
-- * Grants are not included: Supabase default privileges for
--   anon/authenticated/service_role apply automatically.
SET check_function_bodies = off;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── enum types ──────────────────────────────────────────────
CREATE TYPE public.contribution_status AS ENUM ('pledged', 'pending', 'confirmed', 'refunded', 'disputed');
CREATE TYPE public.dispute_type AS ENUM ('contribution_not_received', 'wrong_amount', 'refund_not_received', 'unauthorized_expense', 'expense_inflated', 'rich_auntie_dispute', 'fund_mismanagement', 'other');
CREATE TYPE public.event_type AS ENUM ('wedding', 'funeral', 'graduation', 'birthday', 'baby_shower', 'kitchen_party', 'tombstone', 'other');
CREATE TYPE public.expense_category AS ENUM ('casket_coffin', 'burial_site', 'hearse_transport', 'mortuary_fees', 'death_certificate', 'grave_preparation', 'tombstone', 'flowers_wreaths', 'church_fees', 'venue_hire', 'tent_marquee', 'chairs_tables', 'sound_system', 'generator', 'catering_full', 'catering_tea', 'meat_livestock', 'groceries', 'drinks_beverages', 'cooking_equipment', 'transport_family', 'transport_general', 'accommodation', 'fuel', 'photography', 'videography', 'programs_printing', 'decorations', 'lobola_cattle', 'lobola_cash', 'lobola_gifts', 'baby_gifts', 'baby_essentials', 'kitchen_items', 'graduation_gown', 'graduation_photos', 'miscellaneous', 'other');
CREATE TYPE public.fund_type AS ENUM ('funeral', 'tombstone', 'lobola', 'graduation', 'baby_shower', 'kitchen_party', 'stokvel', 'other');
CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.member_status AS ENUM ('pending', 'joined', 'declined', 'removed', 'left');
CREATE TYPE public.notification_type AS ENUM ('welcome', 'fund_created', 'fund_joined', 'member_joined', 'contribution_received', 'contribution_confirmed', 'expense_added', 'rich_auntie_tagged', 'milestone_25', 'milestone_50', 'milestone_75', 'milestone_100', 'fund_closing_11', 'fund_closing_7', 'fund_closing_3', 'fund_closed', 'deadline_reminder', 'pledge_reminder', 'refund_sent', 'refund_confirmed', 'referral_signup', 'referral_fund_created', 'succession_request', 'succession_approved', 'dispute_opened', 'dispute_resolved', 'expense_query', 'expense_query_response', 'trust_badge_earned', 'verification_complete', 'system_announcement', 'join_request', 'join_approved', 'join_declined', 'member_removed', 'contribution_added');
CREATE TYPE public.organiser_role AS ENUM ('creator', 'organiser');
CREATE TYPE public.payment_method AS ENUM ('orange_money', 'myzaka', 'smega', 'mpesa', 'mtn_momo', 'airtel_money', 'ecocash', 'bank_transfer', 'cash', 'other');
CREATE TYPE public.report_reason AS ENUM ('fake_fund', 'wrong_organizer', 'suspected_fraud', 'misuse_of_funds', 'unknown_organizer', 'harassment', 'other');
CREATE TYPE public.rsvp_status AS ENUM ('pending', 'yes', 'no', 'maybe');
CREATE TYPE public.trust_level AS ENUM ('new', 'basic', 'trusted', 'verified');

-- ── functions ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_fund_goal()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.fund_goal_amount := ROUND((NEW.total_budget * NEW.fund_goal_percentage / 100), 2);
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_user_create_fund(p_user_id uuid, p_country_code character varying, p_goal_amount numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    user_trust   trust_level;
    max_goal     DECIMAL(15,2);
    max_funds    INTEGER;
    active_funds INTEGER;
BEGIN
    SELECT trust_level INTO user_trust FROM users WHERE id = p_user_id;
    SELECT fl.max_fund_goal, fl.max_active_funds INTO max_goal, max_funds
    FROM fund_limits fl
    WHERE fl.country_code = p_country_code AND fl.trust_level = user_trust;
    IF max_goal IS NULL THEN RETURN TRUE; END IF;
    IF p_goal_amount IS NOT NULL AND p_goal_amount > max_goal THEN RETURN FALSE; END IF;
    SELECT COUNT(*) INTO active_funds
    FROM funds WHERE owner_id = p_user_id AND status = 'active' AND deleted_at IS NULL;
    IF active_funds >= max_funds THEN RETURN FALSE; END IF;
    RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_fund_id uuid, p_type text, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
      insert into public.notifications (user_id, fund_id, type, title, body, data)
      values (p_user_id, p_fund_id, p_type::notification_type, p_title, p_body, p_data);
    $function$
;

CREATE OR REPLACE FUNCTION public.find_fund_by_code(p_code text)
 RETURNS TABLE(id uuid, title text, goal_amount numeric, currency_code text, status text, organiser_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.title::text,
    f.goal_amount,
    f.currency_code::text,
    f.status::text,
    u.name::text AS organiser_name
  FROM funds f
  LEFT JOIN users u ON u.id = f.owner_id
  WHERE f.fund_code = upper(trim(p_code))
    AND f.deleted_at IS NULL
  LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fund_manager_ids(p_fund_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select owner_id from public.funds where id = p_fund_id
  union
  select user_id from public.fund_members
  where fund_id = p_fund_id
    and status = 'joined'
    and role in ('owner', 'admin')
    and user_id is not null
$function$
;

CREATE OR REPLACE FUNCTION public.fund_member_user_ids(p_fund_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select owner_id from public.funds where id = p_fund_id
  union
  select user_id from public.fund_members
  where fund_id = p_fund_id
    and status = 'joined'
    and user_id is not null
$function$
;

CREATE OR REPLACE FUNCTION public.generate_event_code()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
  candidate character varying;
BEGIN
  LOOP
    candidate := 'EVT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.events
      WHERE event_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_fund_code()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
  candidate character varying;
BEGIN
  LOOP
    candidate := 'FND-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.funds
      WHERE fund_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_fund_share_code()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
  candidate character varying;
BEGIN
  LOOP
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.funds
      WHERE share_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
 RETURNS character varying
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    year_part TEXT := to_char(CURRENT_DATE, 'YYYY');
    seq_num   INTEGER;
    result    VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CAST(NULLIF(regexp_replace(receipt_number, '.*-', ''), '') AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM contributions
    WHERE receipt_number LIKE 'TSH-CON-' || year_part || '-%';
    result := 'TSH-CON-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');
    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_referral_code(user_name text)
 RETURNS character varying
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    name_part TEXT;
    num_part  TEXT;
    result    VARCHAR(10);
BEGIN
    name_part := UPPER(LEFT(regexp_replace(user_name, '[^A-Za-z]', '', 'g'), 4));
    WHILE length(name_part) < 4 LOOP
        name_part := name_part || 'X';
    END LOOP;
    num_part := LPAD(floor(random() * 10000)::TEXT, 4, '0');
    result := name_part || num_part;
    WHILE EXISTS (SELECT 1 FROM users WHERE referral_code = result) LOOP
        num_part := LPAD(floor(random() * 10000)::TEXT, 4, '0');
        result := name_part || num_part;
    END LOOP;
    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_share_code()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
  candidate character varying;
BEGIN
  LOOP
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.events
      WHERE share_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
 RETURNS character varying
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    year_part TEXT := to_char(CURRENT_DATE, 'YYYY');
    seq_num   INTEGER;
    result    VARCHAR(20);
BEGIN
    SELECT COALESCE(MAX(
        CAST(NULLIF(regexp_replace(ticket_number, '.*-', ''), '') AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM support_tickets
    WHERE ticket_number LIKE 'TSH-' || year_part || '-%';
    result := 'TSH-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');
    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fund_balance(p_fund_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    total_contributions DECIMAL(15,2);
    total_expenses      DECIMAL(15,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_contributions
    FROM contributions
    WHERE fund_id = p_fund_id AND status = 'confirmed' AND is_refunded = FALSE;

    SELECT COALESCE(SUM(amount), 0) INTO total_expenses
    FROM expenses
    WHERE fund_id = p_fund_id AND is_sponsored = FALSE AND deleted_at IS NULL;

    RETURN total_contributions - total_expenses;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fund_member_profiles(p_fund_id uuid)
 RETURNS TABLE(member_row_id uuid, user_id uuid, name text, phone text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT fm.id, u.id, u.name, u.phone
  FROM fund_members fm
  JOIN users u ON u.id = fm.user_id
  WHERE fm.fund_id = p_fund_id
    AND EXISTS (
      SELECT 1 FROM fund_members caller
      WHERE caller.fund_id = p_fund_id AND caller.user_id = auth.uid()
    );
$function$
;

CREATE OR REPLACE FUNCTION public.get_fund_privacy(p_fund_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT is_private FROM public.funds WHERE id = p_fund_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fund_progress(p_fund_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    total_raised DECIMAL(15,2);
    goal         DECIMAL(15,2);
BEGIN
    SELECT goal_amount INTO goal FROM funds WHERE id = p_fund_id;
    IF goal IS NULL OR goal = 0 THEN RETURN 0; END IF;
    SELECT COALESCE(SUM(amount), 0) INTO total_raised
    FROM contributions
    WHERE fund_id = p_fund_id AND status = 'confirmed' AND is_refunded = FALSE;
    RETURN LEAST(ROUND((total_raised / goal) * 100), 200)::INTEGER;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_fund_trust_badge(p_fund_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    total_expenses         INTEGER;
    expenses_with_receipts INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE receipt_url IS NOT NULL)
    INTO total_expenses, expenses_with_receipts
    FROM expenses
    WHERE fund_id = p_fund_id AND deleted_at IS NULL AND is_sponsored = FALSE;
    IF total_expenses < 3 THEN RETURN FALSE; END IF;
    RETURN (expenses_with_receipts::DECIMAL / total_expenses) >= 0.8;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_trust_score(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    score       INTEGER := 0;
    u           RECORD;
    receipt_rate DECIMAL;
    vouch_count  INTEGER;
BEGIN
    SELECT * INTO u FROM users WHERE id = p_user_id;
    score := score + 10;
    IF u.mobile_money_verified THEN score := score + 20; END IF;
    IF u.profile_completed THEN score := score + 5; END IF;
    IF u.funds_completed >= 1 THEN score := score + 15; END IF;
    IF u.funds_completed >= 3 THEN score := score + 10; END IF;
    IF u.funds_completed >= 5 THEN score := score + 5; END IF;
    SELECT COALESCE(
        (COUNT(*) FILTER (WHERE receipt_url IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 0
    ) INTO receipt_rate
    FROM expenses e JOIN funds f ON e.fund_id = f.id
    WHERE f.owner_id = p_user_id AND e.deleted_at IS NULL;
    IF receipt_rate >= 80 THEN score := score + 10;
    ELSIF receipt_rate >= 50 THEN score := score + 5; END IF;
    SELECT COUNT(*) INTO vouch_count FROM member_vouches WHERE vouched_for_user_id = p_user_id;
    IF vouch_count >= 5 THEN score := score + 10;
    ELSIF vouch_count >= 2 THEN score := score + 5; END IF;
    IF u.funds_reported > 0 THEN score := score - (u.funds_reported * 10); END IF;
    IF u.is_flagged THEN score := score - 20; END IF;
    RETURN GREATEST(0, LEAST(100, score));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$BEGIN
  INSERT INTO public.users (
    id,
    phone,
    name,
    trust_score,
    trust_level,
    token_balance,
    notifications_enabled,
    profile_completed,
    onboarding_completed,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.phone,
    '',
    0,
    'new',
    0,
    true,
    false,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, phone, name)
  VALUES (
    new.id,
    COALESCE(LTRIM(new.phone, '+'), ''),
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_account_locked(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    lock_time TIMESTAMPTZ;
BEGIN
    SELECT locked_until INTO lock_time FROM users WHERE id = p_user_id;
    IF lock_time IS NULL THEN RETURN FALSE; END IF;
    RETURN lock_time > NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_event_creator(target_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = target_event_id
      AND creator_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_event_guest(target_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_guests
    WHERE event_id = target_event_id
      AND user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_event_organiser(target_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_organisers
    WHERE event_id = target_event_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_fund_admin(target_fund_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.fund_members
    WHERE fund_id = target_fund_id
      AND user_id = auth.uid()
      AND status = 'joined'
      AND role IN ('owner', 'admin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_fund_member(target_fund_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.fund_members
    WHERE fund_id = target_fund_id
      AND user_id = auth.uid()
      AND status = 'joined'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_fund_owner(target_fund_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.funds
    WHERE id = target_fund_id
      AND owner_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.notify_contribution_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_fund_title text;
  v_currency   text;
  v_symbol     text;
  v_actor      uuid;
  v_recipient  uuid;
begin
  select title, currency_code into v_fund_title, v_currency
  from public.funds where id = new.fund_id;
  if v_fund_title is null then return new; end if;

  v_symbol := case when v_currency = 'BWP' then 'P' else v_currency end;
  v_actor  := coalesce(new.confirmed_by, new.tagged_by);

  for v_recipient in select * from public.fund_member_user_ids(new.fund_id) loop
    if v_recipient is distinct from v_actor then
      perform public.create_notification(
        v_recipient, new.fund_id, 'contribution_added',
        'Contribution recorded',
        v_symbol || ' ' || to_char(new.amount, 'FM999,999,990.00')
          || ' from ' || new.contributor_name || ' · ' || v_fund_title,
        jsonb_build_object('fundId', new.fund_id, 'contributionId', new.id)
      );
    end if;
  end loop;

  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_expense_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_group      record;
  v_fund_title text;
  v_currency   text;
  v_symbol     text;
  v_body       text;
  v_recipient  uuid;
begin
  for v_group in
    select fund_id,
           count(*)                as cnt,
           sum(amount)             as total,
           max(vendor_name)        as vendor,
           max(added_by::text)::uuid as actor
    from new_rows
    group by fund_id
  loop
    select title, currency_code into v_fund_title, v_currency
    from public.funds where id = v_group.fund_id;
    if v_fund_title is null then continue; end if;

    v_symbol := case when v_currency = 'BWP' then 'P' else v_currency end;
    v_body := v_symbol || ' ' || to_char(v_group.total, 'FM999,999,990.00')
      || case when v_group.cnt > 1 then ' (' || v_group.cnt || ' items)' else '' end
      || coalesce(' at ' || nullif(trim(v_group.vendor), ''), '')
      || ' · ' || v_fund_title;

    for v_recipient in select * from public.fund_member_user_ids(v_group.fund_id) loop
      if v_recipient is distinct from v_group.actor then
        perform public.create_notification(
          v_recipient, v_group.fund_id, 'expense_added',
          'Expense recorded',
          v_body,
          jsonb_build_object('fundId', v_group.fund_id)
        );
      end if;
    end loop;
  end loop;

  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_fund_member_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_fund_title text;
  v_owner_id   uuid;
  v_name       text;
  v_recipient  uuid;
begin
  select title, owner_id into v_fund_title, v_owner_id
  from public.funds where id = new.fund_id;
  if v_fund_title is null then return new; end if;

  select name into v_name from public.users where id = new.user_id;
  v_name := coalesce(nullif(trim(v_name), ''), 'Someone');

  if new.status = 'pending' then
    for v_recipient in select * from public.fund_manager_ids(new.fund_id) loop
      if v_recipient is distinct from new.user_id then
        perform public.create_notification(
          v_recipient, new.fund_id, 'join_request',
          'New join request',
          v_name || ' requested to join ' || v_fund_title,
          jsonb_build_object('fundId', new.fund_id, 'memberRowId', new.id)
        );
      end if;
    end loop;

  elsif new.status = 'joined' and new.user_id is distinct from v_owner_id then
    for v_recipient in select * from public.fund_manager_ids(new.fund_id) loop
      if v_recipient is distinct from new.user_id then
        perform public.create_notification(
          v_recipient, new.fund_id, 'member_joined',
          'New member',
          v_name || ' joined ' || v_fund_title,
          jsonb_build_object('fundId', new.fund_id)
        );
      end if;
    end loop;
  end if;

  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_fund_member_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_fund_title text;
  v_name       text;
  v_recipient  uuid;
begin
  if new.user_id is null or new.status = old.status then return new; end if;

  select title into v_fund_title from public.funds where id = new.fund_id;
  if v_fund_title is null then return new; end if;

  if old.status = 'pending' and new.status = 'joined' then
    perform public.create_notification(
      new.user_id, new.fund_id, 'join_approved',
      'Request approved',
      'You''re in! Your request to join ' || v_fund_title || ' was approved.',
      jsonb_build_object('fundId', new.fund_id)
    );

    -- also tell the fund's managers (including the approver) that a
    -- member was added — the approver seeing their own action confirmed
    -- is intentional (single-device demos and multi-admin funds alike)
    select name into v_name from public.users where id = new.user_id;
    v_name := coalesce(nullif(trim(v_name), ''), 'Someone');
    for v_recipient in select * from public.fund_manager_ids(new.fund_id) loop
      if v_recipient is distinct from new.user_id then
        perform public.create_notification(
          v_recipient, new.fund_id, 'member_joined',
          'New member',
          v_name || ' was added to ' || v_fund_title || '.',
          jsonb_build_object('fundId', new.fund_id)
        );
      end if;
    end loop;

  elsif old.status = 'pending' and new.status = 'declined' then
    perform public.create_notification(
      new.user_id, new.fund_id, 'join_declined',
      'Request declined',
      'Your request to join ' || v_fund_title || ' was declined.',
      jsonb_build_object('fundId', new.fund_id)
    );
  elsif old.status = 'joined' and new.status = 'removed' then
    perform public.create_notification(
      new.user_id, new.fund_id, 'member_removed',
      'Removed from fund',
      'You were removed from ' || v_fund_title || '.',
      jsonb_build_object('fundId', new.fund_id)
    );
  end if;

  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.record_failed_login(p_phone character varying, p_ip inet, p_reason character varying)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id    UUID;
    v_recent_fails INTEGER;
    v_should_lock  BOOLEAN := FALSE;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE phone = p_phone;
    INSERT INTO failed_login_attempts (phone, user_id, ip_address, failure_reason)
    VALUES (p_phone, v_user_id, p_ip, p_reason);
    SELECT COUNT(*) INTO v_recent_fails
    FROM failed_login_attempts
    WHERE phone = p_phone AND attempted_at > NOW() - INTERVAL '15 minutes';
    IF v_recent_fails >= 5 AND v_user_id IS NOT NULL THEN
        UPDATE users SET
            failed_login_count = failed_login_count + 1,
            locked_until = NOW() + INTERVAL '30 minutes',
            lock_reason = 'Too many failed login attempts'
        WHERE id = v_user_id;
        v_should_lock := TRUE;
        INSERT INTO security_events (user_id, ip_address, event_type, severity, description)
        VALUES (v_user_id, p_ip, 'account_locked', 'medium',
                'Locked due to ' || v_recent_fails || ' failed login attempts');
    END IF;
    RETURN jsonb_build_object('recent_failures', v_recent_fails, 'account_locked', v_should_lock);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_event_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.event_code IS NULL THEN
        NEW.event_code := generate_event_code();
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_create_fund_allowances()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO fund_allowances (fund_id) VALUES (NEW.id);
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_create_user_free_tier()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO user_free_tier (user_id, ai_tokens_reset_date)
    VALUES (NEW.id, (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::DATE);
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_generate_fund_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.fund_code IS NULL THEN
        NEW.fund_code := generate_fund_code();
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_generate_receipt_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' AND NEW.receipt_number IS NULL THEN
        NEW.receipt_number := generate_receipt_number();
        NEW.receipt_generated_at := NOW();
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_generate_referral_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code(NEW.name);
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_generate_ticket_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := generate_ticket_number();
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_update_expense_query_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE expenses SET
        query_count = (SELECT COUNT(*) FROM expense_queries WHERE expense_id = NEW.expense_id),
        has_open_query = EXISTS (
            SELECT 1 FROM expense_queries
            WHERE expense_id = NEW.expense_id AND status IN ('pending', 'responded')
        )
    WHERE id = NEW.expense_id;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_update_token_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE users SET token_balance = NEW.balance_after WHERE id = NEW.user_id;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_update_trust_level()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.trust_score != OLD.trust_score THEN
        IF NEW.trust_score >= 80 AND NEW.mobile_money_verified THEN
            NEW.trust_level := 'verified';
        ELSIF NEW.trust_score >= 60 OR NEW.funds_completed >= 3 THEN
            NEW.trust_level := 'trusted';
        ELSIF NEW.trust_score >= 30 OR NEW.funds_completed >= 1 THEN
            NEW.trust_level := 'basic';
        ELSE
            NEW.trust_level := 'new';
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

-- ── tables ──────────────────────────────────────────────
CREATE TABLE public.account_recovery_attempts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  claimed_user_id uuid,
  claimed_phone character varying(20) NOT NULL,
  device_id character varying(100),
  device_info jsonb,
  ip_address inet,
  recovery_method character varying(50) NOT NULL,
  otp_sent boolean DEFAULT false,
  otp_verified boolean DEFAULT false,
  security_questions_passed boolean,
  selfie_verified boolean,
  member_vouches integer DEFAULT 0,
  status character varying(20) DEFAULT 'pending'::character varying,
  failure_reason character varying(100),
  new_phone_number character varying(20),
  recovered_at timestamp with time zone,
  is_suspicious boolean DEFAULT false,
  suspicious_reason text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.api_keys (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid,
  organization_name character varying(200),
  key_hash character varying(255) NOT NULL,
  key_prefix character varying(10),
  permissions jsonb,
  rate_limit_per_minute integer DEFAULT 60,
  rate_limit_per_day integer DEFAULT 10000,
  is_active boolean DEFAULT true,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone
);

CREATE TABLE public.api_usage_logs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  api_key_id uuid,
  endpoint character varying(200),
  method character varying(10),
  response_status integer,
  response_time_ms integer,
  request_ip inet,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.app_config (
  key character varying(100) NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by character varying(100)
);

CREATE TABLE public.audit_log (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid,
  user_id uuid,
  action character varying(50) NOT NULL,
  entity_type character varying(50) NOT NULL,
  entity_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.blocked_users (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  blocker_user_id uuid NOT NULL,
  blocked_user_id uuid NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.campaigns (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  campaign_code character varying(50) NOT NULL,
  campaign_name character varying(200) NOT NULL,
  campaign_type character varying(50),
  target_countries character varying(3)[],
  target_fund_types character varying(50)[],
  start_date date,
  end_date date,
  budget_amount numeric(15,2),
  spent_amount numeric(15,2) DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  signups integer DEFAULT 0,
  funds_created integer DEFAULT 0,
  revenue_generated numeric(15,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.consent_log (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  consent_type character varying(50) NOT NULL,
  consent_version character varying(20),
  action character varying(20) NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.contribution_edits (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  contribution_id uuid NOT NULL,
  edited_by uuid NOT NULL,
  field_changed character varying(50) NOT NULL,
  old_value text,
  new_value text,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.contribution_reminders (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  fund_member_id uuid NOT NULL,
  reminder_type character varying(50) NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  response character varying(50),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.contributions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  user_id uuid,
  contributor_name character varying(100) NOT NULL,
  contributor_phone character varying(20) NOT NULL,
  tagged_by uuid,
  amount numeric(15,2) NOT NULL,
  currency_code character varying(3) NOT NULL,
  original_amount numeric(15,2),
  original_currency character varying(3),
  conversion_rate numeric(10,6),
  payment_method payment_method,
  reference_number character varying(100),
  status contribution_status DEFAULT 'pending'::contribution_status,
  confirmed_by uuid,
  confirmed_at timestamp with time zone,
  detected_via character varying(20) DEFAULT 'manual'::character varying,
  sms_log_id uuid,
  is_rich_auntie boolean DEFAULT false,
  rich_auntie_item character varying(200),
  possible_duplicate_of uuid,
  duplicate_status character varying(20),
  is_refunded boolean DEFAULT false,
  refunded_at timestamp with time zone,
  refund_confirmed_by uuid,
  refund_confirmed_at timestamp with time zone,
  receipt_number character varying(50),
  receipt_generated_at timestamp with time zone,
  disclaimer_accepted boolean DEFAULT false,
  disclaimer_accepted_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.countries (
  code character varying(3) NOT NULL,
  name character varying(100) NOT NULL,
  currency_code character varying(3) NOT NULL,
  currency_symbol character varying(5) NOT NULL,
  currency_name character varying(50) NOT NULL,
  mobile_money_options jsonb DEFAULT '[]'::jsonb NOT NULL,
  phone_prefix character varying(5) NOT NULL,
  phone_length integer DEFAULT 8 NOT NULL,
  is_active boolean DEFAULT false,
  is_launch_country boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.country_waitlist (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  email character varying(255),
  phone character varying(20),
  country_code character varying(3) NOT NULL,
  referral_source character varying(50),
  notified boolean DEFAULT false,
  signed_up boolean DEFAULT false,
  signed_up_user_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.data_export_requests (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  request_type character varying(50) NOT NULL,
  status character varying(20) DEFAULT 'pending'::character varying,
  processed_at timestamp with time zone,
  download_url text,
  download_expires_at timestamp with time zone,
  deletion_scheduled_at timestamp with time zone,
  deletion_completed_at timestamp with time zone,
  admin_notes text,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.disputes (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  raised_by uuid NOT NULL,
  against_user uuid,
  dispute_type dispute_type NOT NULL,
  description text NOT NULL,
  evidence_urls text[],
  related_contribution_id uuid,
  related_expense_id uuid,
  status character varying(20) DEFAULT 'open'::character varying,
  resolution text,
  resolved_by character varying(100),
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE TABLE public.event_budgets (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  event_id uuid NOT NULL,
  total_budget numeric(15,2) NOT NULL,
  currency_code character varying(3) DEFAULT 'BWP'::character varying NOT NULL,
  fund_goal_percentage integer DEFAULT 100,
  fund_goal_amount numeric(15,2),
  breakdown jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.event_fund_links (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  event_id uuid NOT NULL,
  fund_id uuid NOT NULL,
  linked_by uuid NOT NULL,
  link_type character varying(20) NOT NULL,
  tokens_spent integer DEFAULT 0,
  token_transaction_id uuid,
  is_active boolean DEFAULT true,
  unlinked_at timestamp with time zone,
  unlinked_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.event_guests (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid,
  guest_phone character varying(20),
  guest_name character varying(100),
  guest_email character varying(255),
  rsvp_status rsvp_status DEFAULT 'pending'::rsvp_status,
  rsvp_responded_at timestamp with time zone,
  rsvp_note text,
  plus_ones integer DEFAULT 0,
  plus_ones_names text[],
  dietary_requirements text,
  accessibility_needs text,
  invited_by uuid,
  invited_at timestamp with time zone DEFAULT now(),
  invitation_sent_at timestamp with time zone,
  invitation_channel character varying(20),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.event_organisers (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid,
  invited_phone character varying(20),
  invited_name character varying(100),
  role organiser_role DEFAULT 'organiser'::organiser_role,
  invited_by uuid,
  invited_at timestamp with time zone DEFAULT now(),
  joined_at timestamp with time zone,
  status character varying(20) DEFAULT 'pending'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.event_type_config (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  event_type character varying(50) NOT NULL,
  display_name character varying(50) NOT NULL,
  display_name_local character varying(50),
  icon character varying(10),
  default_has_fund boolean DEFAULT true,
  default_guest_list boolean DEFAULT true,
  suggested_budget_categories jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.events (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  creator_id uuid NOT NULL,
  event_code character varying DEFAULT generate_event_code() NOT NULL,
  name character varying(200) NOT NULL,
  description text,
  event_type character varying NOT NULL,
  event_date date NOT NULL,
  event_time time without time zone,
  event_end_date date,
  event_end_time time without time zone,
  venue_name character varying(200),
  venue_address text,
  venue_lat numeric(10,8),
  venue_lng numeric(11,8),
  venue_google_place_id character varying(100),
  cover_photo_url text,
  currency_code character varying(3) DEFAULT 'BWP'::character varying NOT NULL,
  linked_fund_id uuid,
  share_code character varying DEFAULT generate_share_code(),
  status character varying(20) DEFAULT 'active'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  cancelled_at timestamp with time zone,
  completed_at timestamp with time zone,
  deleted_at timestamp with time zone,
  event_emoji character varying
);

CREATE TABLE public.exchange_rates (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  from_currency character varying(3) NOT NULL,
  to_currency character varying(3) NOT NULL,
  rate numeric(15,6) NOT NULL,
  source character varying(50),
  fetched_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.expense_edits (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  expense_id uuid NOT NULL,
  edited_by uuid NOT NULL,
  field_changed character varying(50) NOT NULL,
  old_value text,
  new_value text,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.expense_queries (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  expense_id uuid NOT NULL,
  fund_id uuid NOT NULL,
  asked_by uuid NOT NULL,
  question text NOT NULL,
  response text,
  response_attachment_url text,
  responded_at timestamp with time zone,
  responded_by uuid,
  status character varying(20) DEFAULT 'pending'::character varying,
  satisfied boolean,
  satisfied_at timestamp with time zone,
  dispute_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.expenses (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  added_by uuid NOT NULL,
  description character varying(500) NOT NULL,
  category expense_category,
  amount numeric(15,2) NOT NULL,
  currency_code character varying(3) NOT NULL,
  item_name character varying(200),
  quantity numeric(10,2),
  unit_price numeric(15,2),
  vendor_name character varying(200),
  receipt_url text,
  is_sponsored boolean DEFAULT false,
  sponsored_by_user_id uuid,
  sponsored_by_name character varying(100),
  query_count integer DEFAULT 0,
  has_open_query boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  vendor_id uuid
);

CREATE TABLE public.failed_login_attempts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  phone character varying(20) NOT NULL,
  user_id uuid,
  ip_address inet NOT NULL,
  user_agent text,
  device_fingerprint character varying(255),
  failure_reason character varying(50) NOT NULL,
  attempted_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fraud_signals (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid,
  fund_id uuid,
  signal_type character varying(50) NOT NULL,
  signal_score integer,
  details jsonb,
  reviewed boolean DEFAULT false,
  reviewed_by character varying(100),
  action_taken character varying(50),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_allowances (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  free_scans_total integer DEFAULT 20,
  free_scans_used integer DEFAULT 0,
  free_exports_total integer DEFAULT 1,
  free_exports_used integer DEFAULT 0,
  member_limit_base integer DEFAULT 50,
  member_limit_purchased integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_announcements (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  posted_by uuid NOT NULL,
  message text NOT NULL,
  attachment_url text,
  attachment_type character varying(20),
  is_pinned boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_benchmarks (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_type character varying(50) NOT NULL,
  country_code character varying(3),
  region character varying(100),
  attendee_range character varying(50),
  avg_total_raised numeric(15,2),
  avg_total_expenses numeric(15,2),
  avg_members integer,
  avg_contribution numeric(15,2),
  avg_days_to_goal integer,
  expense_breakdown jsonb,
  sample_size integer,
  calculated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_exports (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  exported_by uuid NOT NULL,
  export_type character varying(20) DEFAULT 'pdf'::character varying,
  was_free boolean DEFAULT false,
  tokens_spent integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_limits (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  country_code character varying(3),
  trust_level trust_level NOT NULL,
  max_fund_goal numeric(15,2) NOT NULL,
  max_active_funds integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_members (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  user_id uuid,
  invited_phone character varying(20),
  invited_name character varying(100),
  role member_role DEFAULT 'member'::member_role,
  status member_status DEFAULT 'pending'::member_status,
  pledge_amount numeric(15,2),
  pledge_deadline date,
  pledge_reminder_sent boolean DEFAULT false,
  suggested_contribution numeric(15,2),
  contribution_goal numeric(15,2),
  invited_by uuid,
  invited_at timestamp with time zone DEFAULT now(),
  joined_at timestamp with time zone,
  promoted_to_admin_at timestamp with time zone,
  promoted_by uuid,
  is_pinned boolean DEFAULT false,
  pinned_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_milestones (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  milestone_type character varying(50) NOT NULL,
  reached_at timestamp with time zone DEFAULT now(),
  notification_sent boolean DEFAULT false
);

CREATE TABLE public.fund_ownership_history (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  previous_owner_id uuid,
  new_owner_id uuid NOT NULL,
  transfer_type character varying(50) NOT NULL,
  succession_request_id uuid,
  transferred_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_reports (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  reported_by uuid NOT NULL,
  report_reason report_reason NOT NULL,
  description text,
  evidence_urls text[],
  status character varying(20) DEFAULT 'pending'::character varying,
  reviewed_by character varying(100),
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE TABLE public.fund_shares (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  shared_by uuid NOT NULL,
  share_type character varying(20) NOT NULL,
  share_channel character varying(20),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_succession_requests (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  requester_user_id uuid,
  requester_phone character varying(20),
  requester_name character varying(100),
  reason character varying(50) NOT NULL,
  reason_details text,
  supporting_documents text[],
  is_designated_successor boolean DEFAULT false,
  is_fund_admin boolean DEFAULT false,
  owner_notified_at timestamp with time zone,
  owner_notified_via text[],
  owner_responded boolean DEFAULT false,
  owner_response character varying(50),
  owner_response_at timestamp with time zone,
  voting_required boolean DEFAULT false,
  voting_started_at timestamp with time zone,
  voting_ends_at timestamp with time zone,
  votes_approve integer DEFAULT 0,
  votes_reject integer DEFAULT 0,
  votes_unknown integer DEFAULT 0,
  status character varying(20) DEFAULT 'pending'::character varying,
  waiting_period_ends_at timestamp with time zone,
  resolved_by character varying(100),
  resolution_notes text,
  executed_at timestamp with time zone,
  previous_owner_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_succession_votes (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  request_id uuid NOT NULL,
  voter_user_id uuid NOT NULL,
  vote character varying(20) NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_templates (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_type character varying(50) NOT NULL,
  template_name character varying(100) NOT NULL,
  suggested_goal numeric(15,2),
  suggested_expenses jsonb,
  attendee_range character varying(50),
  country_code character varying(3),
  region character varying(100),
  times_used integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fund_type_config (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_type character varying(50) NOT NULL,
  display_name character varying(50) NOT NULL,
  display_name_local character varying(50),
  icon character varying(10),
  standard_fields jsonb DEFAULT '["event_date", "event_time", "event_location"]'::jsonb NOT NULL,
  type_specific_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
  default_categories expense_category[] DEFAULT ARRAY[]::expense_category[],
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  country_codes character varying(3)[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.funds (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  owner_id uuid NOT NULL,
  successor_user_id uuid,
  successor_phone character varying(20),
  successor_name character varying(100),
  successor_relationship character varying(50),
  transferred_from uuid,
  transferred_at timestamp with time zone,
  fund_code character varying DEFAULT generate_fund_code() NOT NULL,
  title character varying(200) NOT NULL,
  description text,
  fund_type character varying NOT NULL,
  type_specific_data jsonb DEFAULT '{}'::jsonb,
  currency_code character varying(3) NOT NULL,
  goal_amount numeric(15,2),
  event_date date,
  event_time time without time zone,
  event_location text,
  event_location_lat numeric(10,8),
  event_location_lng numeric(11,8),
  attendees integer,
  attendees_locked boolean DEFAULT false,
  contribution_deadline date,
  auto_close_days integer DEFAULT 14,
  auto_close_date date,
  close_warning_sent_11 boolean DEFAULT false,
  close_warning_sent_7 boolean DEFAULT false,
  close_warning_sent_3 boolean DEFAULT false,
  minimum_duration_days integer DEFAULT 7,
  cooling_off_required boolean DEFAULT false,
  cover_photo_url text,
  share_code character varying DEFAULT generate_fund_share_code(),
  show_leaderboard boolean DEFAULT false,
  reminder_frequency character varying(20) DEFAULT 'weekly'::character varying,
  last_reminder_sent_at timestamp with time zone,
  next_reminder_at timestamp with time zone,
  referral_source character varying(50) DEFAULT 'organic'::character varying,
  referral_organization_id uuid,
  campaign_code character varying(50),
  status character varying(20) DEFAULT 'active'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  closed_at timestamp with time zone,
  deleted_at timestamp with time zone,
  linked_event_id uuid,
  fund_emoji character varying,
  is_private boolean DEFAULT false NOT NULL
);

CREATE TABLE public.high_value_fund_requests (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  requested_goal numeric(15,2) NOT NULL,
  fund_type character varying(50) NOT NULL,
  justification text NOT NULL,
  document_urls text[],
  id_verified boolean DEFAULT false,
  address_verified boolean DEFAULT false,
  reference_checked boolean DEFAULT false,
  status character varying(20) DEFAULT 'pending'::character varying,
  reviewed_by character varying(100),
  decision_notes text,
  approved_limit numeric(15,2),
  created_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone
);

CREATE TABLE public.ip_blocklist (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  ip_address inet NOT NULL,
  ip_range cidr,
  reason character varying(100) NOT NULL,
  blocked_by character varying(100),
  is_permanent boolean DEFAULT false,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.lead_qualification_data (
  user_id uuid NOT NULL,
  estimated_income_bracket character varying(20),
  average_contribution_amount numeric(15,2),
  is_frequent_organizer boolean DEFAULT false,
  is_rich_auntie_frequent boolean DEFAULT false,
  has_funeral_cover boolean,
  funeral_cover_interest_score integer,
  life_insurance_interest_score integer,
  savings_interest_score integer,
  preferred_contact_method character varying(20),
  preferred_contact_time character varying(50),
  language_preference character varying(10),
  insurance_lead_status character varying(50),
  funeral_home_lead_status character varying(50),
  bank_lead_status character varying(50),
  contact_attempts integer DEFAULT 0,
  last_contacted_at timestamp with time zone,
  last_contact_outcome character varying(50),
  consent_to_contact boolean DEFAULT false,
  consent_to_share_with_partners boolean DEFAULT false,
  consent_given_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.login_notifications (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid,
  device_name character varying(100),
  location character varying(200),
  ip_address inet,
  is_suspicious boolean DEFAULT false,
  suspicion_reason text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.member_vouches (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  voucher_user_id uuid NOT NULL,
  vouched_for_user_id uuid NOT NULL,
  vouch_type character varying(50) NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.mobile_money_verifications (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  country_code character varying(3) NOT NULL,
  provider payment_method NOT NULL,
  phone_number character varying(20) NOT NULL,
  verification_method character varying(20) DEFAULT 'reverse_payment'::character varying,
  expected_reference character varying(50) NOT NULL,
  expected_amount numeric(10,2) DEFAULT 1.00,
  expected_currency character varying(3) NOT NULL,
  aggregator character varying(50),
  aggregator_reference character varying(100),
  received boolean DEFAULT false,
  received_amount numeric(10,2),
  received_reference character varying(50),
  received_from_phone character varying(20),
  received_at timestamp with time zone,
  phone_matches boolean,
  status character varying(20) DEFAULT 'pending'::character varying,
  failure_reason character varying(100),
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  created_at timestamp with time zone DEFAULT now(),
  verified_at timestamp with time zone,
  expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval)
);

CREATE TABLE public.notification_templates (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  template_code character varying(50) NOT NULL,
  title character varying(200) NOT NULL,
  body text NOT NULL,
  language character varying(10) DEFAULT 'en'::character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  fund_id uuid,
  type notification_type NOT NULL,
  title character varying(200) NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  read_at timestamp with time zone,
  delivered_at timestamp with time zone,
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone,
  response_action character varying(50),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.offline_queue (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  device_id character varying(100),
  action_type character varying(50) NOT NULL,
  entity_type character varying(50) NOT NULL,
  entity_data jsonb NOT NULL,
  is_synced boolean DEFAULT false,
  synced_at timestamp with time zone,
  sync_error text,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role character varying(50) NOT NULL,
  permissions jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  joined_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.organization_payouts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  organization_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_amount numeric(15,2) NOT NULL,
  commission_rate numeric(5,2) NOT NULL,
  commission_amount numeric(15,2) NOT NULL,
  funds_referred integer,
  users_referred integer,
  revenue_generated numeric(15,2),
  status character varying(20) DEFAULT 'pending'::character varying,
  paid_at timestamp with time zone,
  payment_reference character varying(100),
  payment_method character varying(50),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.organizations (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name character varying(200) NOT NULL,
  type character varying(50) NOT NULL,
  primary_contact_name character varying(100),
  primary_contact_phone character varying(20),
  primary_contact_email character varying(255),
  country_code character varying(3),
  region character varying(100),
  city character varying(100),
  address text,
  partnership_tier character varying(20) DEFAULT 'basic'::character varying,
  partnership_start_date date,
  partnership_end_date date,
  commission_rate numeric(5,2) DEFAULT 0,
  commission_type character varying(20) DEFAULT 'revenue'::character varying,
  is_verified boolean DEFAULT false,
  verified_at timestamp with time zone,
  business_registration_number character varying(100),
  referral_code character varying(20),
  total_referrals integer DEFAULT 0,
  total_commission_earned numeric(15,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.partner_leads (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  partner_type character varying(50) NOT NULL,
  partner_id uuid,
  user_id uuid,
  fund_id uuid,
  lead_type character varying(50),
  lead_data jsonb,
  status character varying(20) DEFAULT 'new'::character varying,
  commission_amount numeric(15,2),
  commission_paid boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.payment_aggregators (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name character varying(100) NOT NULL,
  countries_supported character varying(3)[] NOT NULL,
  payment_methods_supported payment_method[],
  api_base_url text,
  webhook_endpoint text,
  api_key_encrypted text,
  api_secret_encrypted text,
  webhook_secret_encrypted text,
  transaction_fee_percentage numeric(5,3),
  transaction_fee_fixed numeric(10,2),
  monthly_fee numeric(10,2),
  is_active boolean DEFAULT true,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.payments (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  amount numeric(15,2) NOT NULL,
  currency character varying(3) NOT NULL,
  bundle_code character varying(20),
  tokens_purchased integer NOT NULL,
  payment_method character varying(50) NOT NULL,
  payment_provider character varying(50),
  provider_reference character varying(100),
  provider_response jsonb,
  promo_code_id uuid,
  discount_amount numeric(15,2),
  fund_type character varying(50),
  country_code character varying(3),
  acquisition_channel character varying(50),
  status character varying(20) DEFAULT 'pending'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE public.payouts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid,
  amount numeric(15,2) NOT NULL,
  currency character varying(3) NOT NULL,
  payout_type character varying(50) NOT NULL,
  payout_method character varying(50),
  payout_details jsonb,
  status character varying(20) DEFAULT 'pending'::character varying,
  reference character varying(100),
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.promo_code_uses (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  promo_code_id uuid NOT NULL,
  user_id uuid NOT NULL,
  payment_id uuid,
  discount_applied numeric(10,2),
  used_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.promo_codes (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  code character varying(20) NOT NULL,
  discount_type character varying(20) NOT NULL,
  discount_value numeric(10,2),
  free_item_code character varying(50),
  bonus_tokens integer,
  max_uses integer,
  uses_count integer DEFAULT 0,
  max_uses_per_user integer DEFAULT 1,
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  country_codes character varying(3)[],
  new_users_only boolean DEFAULT false,
  min_purchase_amount numeric(10,2),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.push_tokens (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  expo_push_token text NOT NULL,
  device_id character varying,
  platform character varying,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.recurring_group_members (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  user_id uuid,
  member_phone character varying(20),
  member_name character varying(100),
  payout_position integer,
  status member_status DEFAULT 'joined'::member_status,
  joined_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.recurring_groups (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  owner_id uuid NOT NULL,
  group_code character varying(10) NOT NULL,
  name character varying(200) NOT NULL,
  description text,
  contribution_amount numeric(15,2) NOT NULL,
  currency_code character varying(3) NOT NULL,
  frequency character varying(20) NOT NULL,
  day_of_week integer,
  day_of_month integer,
  payout_order character varying(20) NOT NULL,
  members_per_round integer DEFAULT 1,
  status character varying(20) DEFAULT 'active'::character varying,
  current_round integer DEFAULT 1,
  start_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.recurring_rounds (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  round_number integer NOT NULL,
  recipient_member_id uuid,
  expected_amount numeric(15,2),
  collected_amount numeric(15,2) DEFAULT 0,
  status character varying(20) DEFAULT 'pending'::character varying,
  due_date date NOT NULL,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.referral_rewards (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  reward_type character varying(50) NOT NULL,
  referrer_tokens integer,
  referred_tokens integer,
  status character varying(20) DEFAULT 'pending'::character varying,
  awarded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.rich_auntie_sponsorships (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  fund_id uuid NOT NULL,
  user_id uuid,
  sponsor_name character varying(100) NOT NULL,
  sponsor_phone character varying(20),
  item_description character varying(500) NOT NULL,
  amount numeric(15,2) NOT NULL,
  category expense_category,
  contribution_id uuid,
  expense_id uuid,
  tagged_by uuid NOT NULL,
  thank_you_sent boolean DEFAULT false,
  thank_you_sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.scheduled_contributions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  fund_id uuid,
  recurring_group_id uuid,
  amount numeric(15,2) NOT NULL,
  frequency character varying(20) NOT NULL,
  day_of_week integer,
  day_of_month integer,
  next_due_date date,
  auto_remind boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.security_events (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid,
  ip_address inet,
  event_type character varying(50) NOT NULL,
  severity character varying(20) NOT NULL,
  description text,
  event_data jsonb,
  auto_action_taken character varying(100),
  requires_review boolean DEFAULT false,
  reviewed_by character varying(100),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.sms_logs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  raw_message text NOT NULL,
  sender_address character varying(50),
  received_at timestamp with time zone,
  parsed_amount numeric(15,2),
  parsed_currency character varying(3),
  parsed_sender_phone character varying(20),
  parsed_sender_name character varying(100),
  parsed_reference character varying(100),
  parsed_transaction_id character varying(100),
  parsed_provider payment_method,
  matched_fund_id uuid,
  matched_fund_code character varying(10),
  matched_contribution_id uuid,
  confidence_score numeric(5,2),
  status character varying(20) DEFAULT 'pending'::character varying,
  parse_error text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.support_tickets (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  ticket_number character varying(20) NOT NULL,
  user_id uuid,
  category character varying(50) NOT NULL,
  subject character varying(200) NOT NULL,
  description text NOT NULL,
  related_fund_id uuid,
  related_contribution_id uuid,
  priority character varying(20) DEFAULT 'normal'::character varying,
  status character varying(20) DEFAULT 'open'::character varying,
  assigned_to character varying(100),
  attachments text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE TABLE public.system_announcements (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  title character varying(200) NOT NULL,
  message text NOT NULL,
  announcement_type character varying(50),
  target_countries character varying(3)[],
  target_user_levels character varying(20)[],
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone,
  is_dismissible boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.token_bundles (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  bundle_code character varying(20) NOT NULL,
  bundle_name character varying(50) NOT NULL,
  tokens integer NOT NULL,
  price_bwp numeric(10,2),
  price_zar numeric(10,2),
  price_usd numeric(10,2),
  price_kes numeric(10,2),
  price_ngn numeric(10,2),
  price_ghs numeric(10,2),
  price_zmw numeric(10,2),
  bonus_percentage integer DEFAULT 0,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.token_products (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  product_code character varying(50) NOT NULL,
  product_name character varying(100) NOT NULL,
  description text,
  token_cost integer NOT NULL,
  entitlement_type character varying(50),
  entitlement_quantity integer DEFAULT 1,
  is_reward boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.token_transactions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  transaction_type character varying(50) NOT NULL,
  product_code character varying(50),
  bundle_code character varying(20),
  payment_id uuid,
  referral_id uuid,
  description text,
  fund_id uuid,
  balance_after integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_dismissed_announcements (
  user_id uuid NOT NULL,
  announcement_id uuid NOT NULL,
  dismissed_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_engagement_events (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid,
  session_id uuid,
  event_type character varying(50) NOT NULL,
  event_name character varying(100),
  screen_name character varying(100),
  fund_id uuid,
  event_data jsonb DEFAULT '{}'::jsonb,
  device_type character varying(20),
  app_version character varying(20),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_entitlements (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  entitlement_type character varying(50) NOT NULL,
  fund_id uuid,
  quantity_total integer DEFAULT 1,
  quantity_used integer DEFAULT 0,
  source character varying(50) NOT NULL,
  source_reference uuid,
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_feature_flags (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  feature_code character varying(50) NOT NULL,
  is_enabled boolean DEFAULT false,
  enabled_at timestamp with time zone
);

CREATE TABLE public.user_free_tier (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  free_fund_used boolean DEFAULT false,
  free_funds_from_referral integer DEFAULT 0,
  ai_tokens_earned_this_month integer DEFAULT 0,
  ai_tokens_monthly_cap integer DEFAULT 200,
  ai_tokens_reset_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  free_event_used boolean DEFAULT false,
  free_event_fund_combo_used boolean DEFAULT false
);

CREATE TABLE public.user_lifecycle_metrics (
  user_id uuid NOT NULL,
  first_fund_created_at timestamp with time zone,
  first_fund_joined_at timestamp with time zone,
  first_contribution_made_at timestamp with time zone,
  first_contribution_received_at timestamp with time zone,
  first_expense_added_at timestamp with time zone,
  first_payment_at timestamp with time zone,
  last_active_at timestamp with time zone,
  last_fund_created_at timestamp with time zone,
  last_contribution_at timestamp with time zone,
  total_funds_created integer DEFAULT 0,
  total_funds_joined integer DEFAULT 0,
  total_contributions_made integer DEFAULT 0,
  total_contributions_received integer DEFAULT 0,
  total_spent_tokens integer DEFAULT 0,
  total_earned_tokens integer DEFAULT 0,
  total_amount_contributed numeric(15,2) DEFAULT 0,
  total_amount_received numeric(15,2) DEFAULT 0,
  total_revenue_generated numeric(15,2) DEFAULT 0,
  lifecycle_stage character varying(50) DEFAULT 'new'::character varying,
  days_since_signup integer,
  days_since_last_active integer,
  engagement_score integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_referrals (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  referral_code_used character varying(10),
  referral_channel character varying(50),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_sessions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  device_id character varying(100),
  device_name character varying(100),
  device_os character varying(50),
  app_version character varying(20),
  app_build_number integer,
  os_version character varying(20),
  push_token text,
  push_enabled boolean DEFAULT true,
  last_ip inet,
  last_location_country character varying(3),
  last_location_city character varying(100),
  last_active_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_trusted_devices (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  device_id character varying(100) NOT NULL,
  device_fingerprint character varying(255),
  first_seen_at timestamp with time zone DEFAULT now(),
  last_seen_at timestamp with time zone DEFAULT now(),
  is_trusted boolean DEFAULT false,
  trusted_at timestamp with time zone,
  location_country character varying(3),
  location_city character varying(100)
);

CREATE TABLE public.user_wealth_signals (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  signal_type character varying(50) NOT NULL,
  signal_value numeric(15,2),
  calculated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.users (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  phone character varying(20) NOT NULL,
  name character varying(100) NOT NULL,
  email character varying(255),
  avatar_url text,
  country_code character varying(3),
  preferred_currency character varying(3),
  language character varying(10) DEFAULT 'en'::character varying,
  mobile_money_provider payment_method,
  mobile_money_number character varying(20),
  mobile_money_name character varying(100),
  mobile_money_verified boolean DEFAULT false,
  mobile_money_verified_at timestamp with time zone,
  bank_name character varying(100),
  bank_account_number character varying(50),
  bank_account_name character varying(100),
  bank_branch_code character varying(20),
  bank_account_verified boolean DEFAULT false,
  bank_account_verified_at timestamp with time zone,
  token_balance integer DEFAULT 0,
  trust_score integer DEFAULT 0,
  trust_level trust_level DEFAULT 'new'::trust_level,
  funds_completed integer DEFAULT 0,
  funds_reported integer DEFAULT 0,
  referral_code character varying(10),
  referred_by uuid,
  notifications_enabled boolean DEFAULT true,
  profile_completed boolean DEFAULT false,
  onboarding_completed boolean DEFAULT false,
  terms_accepted_at timestamp with time zone,
  terms_version character varying(20),
  privacy_accepted_at timestamp with time zone,
  privacy_version character varying(20),
  marketing_consent boolean DEFAULT false,
  marketing_consent_at timestamp with time zone,
  marketing_email_enabled boolean DEFAULT false,
  marketing_sms_enabled boolean DEFAULT false,
  marketing_push_enabled boolean DEFAULT false,
  data_processing_consent boolean DEFAULT true,
  data_processing_consent_at timestamp with time zone,
  is_flagged boolean DEFAULT false,
  is_banned boolean DEFAULT false,
  banned_at timestamp with time zone,
  banned_reason text,
  recovery_email character varying(255),
  recovery_phone character varying(20),
  security_question_1 character varying(200),
  security_answer_1_hash character varying(255),
  security_question_2 character varying(200),
  security_answer_2_hash character varying(255),
  security_question_3 character varying(200),
  security_answer_3_hash character varying(255),
  failed_login_count integer DEFAULT 0,
  locked_until timestamp with time zone,
  lock_reason character varying(100),
  last_active_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

CREATE TABLE public.vendor_bookings (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  vendor_id uuid NOT NULL,
  fund_id uuid,
  user_id uuid NOT NULL,
  service_description text,
  quoted_amount numeric(15,2),
  final_amount numeric(15,2),
  status character varying(20) DEFAULT 'pending'::character varying,
  commission_amount numeric(15,2),
  commission_paid boolean DEFAULT false,
  rating integer,
  review text,
  would_recommend boolean,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE public.vendors (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name character varying(200) NOT NULL,
  category expense_category,
  country_code character varying(3),
  region character varying(100),
  city character varying(100),
  address text,
  phone character varying(20),
  email character varying(255),
  website text,
  whatsapp character varying(20),
  average_rating numeric(3,2),
  total_reviews integer DEFAULT 0,
  is_verified boolean DEFAULT false,
  commission_rate numeric(5,2),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.verification_codes (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid,
  phone character varying(20) NOT NULL,
  code character varying(10) NOT NULL,
  code_hash character varying(255),
  purpose character varying(50) NOT NULL,
  related_entity_type character varying(50),
  related_entity_id uuid,
  is_used boolean DEFAULT false,
  used_at timestamp with time zone,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ── constraints (pk, unique, check, fk) ──────────────────────────────────────────────
ALTER TABLE public.account_recovery_attempts ADD CONSTRAINT account_recovery_attempts_pkey PRIMARY KEY (id);
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);
ALTER TABLE public.api_usage_logs ADD CONSTRAINT api_usage_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.app_config ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.blocked_users ADD CONSTRAINT blocked_users_pkey PRIMARY KEY (id);
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);
ALTER TABLE public.consent_log ADD CONSTRAINT consent_log_pkey PRIMARY KEY (id);
ALTER TABLE public.contribution_edits ADD CONSTRAINT contribution_edits_pkey PRIMARY KEY (id);
ALTER TABLE public.contribution_reminders ADD CONSTRAINT contribution_reminders_pkey PRIMARY KEY (id);
ALTER TABLE public.contributions ADD CONSTRAINT contributions_pkey PRIMARY KEY (id);
ALTER TABLE public.countries ADD CONSTRAINT countries_pkey PRIMARY KEY (code);
ALTER TABLE public.country_waitlist ADD CONSTRAINT country_waitlist_pkey PRIMARY KEY (id);
ALTER TABLE public.data_export_requests ADD CONSTRAINT data_export_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.disputes ADD CONSTRAINT disputes_pkey PRIMARY KEY (id);
ALTER TABLE public.event_budgets ADD CONSTRAINT event_budgets_pkey PRIMARY KEY (id);
ALTER TABLE public.event_fund_links ADD CONSTRAINT event_fund_links_pkey PRIMARY KEY (id);
ALTER TABLE public.event_guests ADD CONSTRAINT event_guests_pkey PRIMARY KEY (id);
ALTER TABLE public.event_organisers ADD CONSTRAINT event_organisers_pkey PRIMARY KEY (id);
ALTER TABLE public.event_type_config ADD CONSTRAINT event_type_config_pkey PRIMARY KEY (id);
ALTER TABLE public.events ADD CONSTRAINT events_pkey PRIMARY KEY (id);
ALTER TABLE public.exchange_rates ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_edits ADD CONSTRAINT expense_edits_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_queries ADD CONSTRAINT expense_queries_pkey PRIMARY KEY (id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);
ALTER TABLE public.failed_login_attempts ADD CONSTRAINT failed_login_attempts_pkey PRIMARY KEY (id);
ALTER TABLE public.fraud_signals ADD CONSTRAINT fraud_signals_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_allowances ADD CONSTRAINT fund_allowances_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_announcements ADD CONSTRAINT fund_announcements_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_benchmarks ADD CONSTRAINT fund_benchmarks_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_exports ADD CONSTRAINT fund_exports_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_limits ADD CONSTRAINT fund_limits_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_members ADD CONSTRAINT fund_members_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_milestones ADD CONSTRAINT fund_milestones_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_ownership_history ADD CONSTRAINT fund_ownership_history_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_reports ADD CONSTRAINT fund_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_shares ADD CONSTRAINT fund_shares_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_succession_requests ADD CONSTRAINT fund_succession_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_succession_votes ADD CONSTRAINT fund_succession_votes_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_templates ADD CONSTRAINT fund_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.fund_type_config ADD CONSTRAINT fund_type_config_pkey PRIMARY KEY (id);
ALTER TABLE public.funds ADD CONSTRAINT funds_pkey PRIMARY KEY (id);
ALTER TABLE public.high_value_fund_requests ADD CONSTRAINT high_value_fund_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.ip_blocklist ADD CONSTRAINT ip_blocklist_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_qualification_data ADD CONSTRAINT lead_qualification_data_pkey PRIMARY KEY (user_id);
ALTER TABLE public.login_notifications ADD CONSTRAINT login_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.member_vouches ADD CONSTRAINT member_vouches_pkey PRIMARY KEY (id);
ALTER TABLE public.mobile_money_verifications ADD CONSTRAINT mobile_money_verifications_pkey PRIMARY KEY (id);
ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.offline_queue ADD CONSTRAINT offline_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);
ALTER TABLE public.organization_payouts ADD CONSTRAINT organization_payouts_pkey PRIMARY KEY (id);
ALTER TABLE public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
ALTER TABLE public.partner_leads ADD CONSTRAINT partner_leads_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_aggregators ADD CONSTRAINT payment_aggregators_pkey PRIMARY KEY (id);
ALTER TABLE public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE public.payouts ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);
ALTER TABLE public.promo_code_uses ADD CONSTRAINT promo_code_uses_pkey PRIMARY KEY (id);
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.recurring_group_members ADD CONSTRAINT recurring_group_members_pkey PRIMARY KEY (id);
ALTER TABLE public.recurring_groups ADD CONSTRAINT recurring_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.recurring_rounds ADD CONSTRAINT recurring_rounds_pkey PRIMARY KEY (id);
ALTER TABLE public.referral_rewards ADD CONSTRAINT referral_rewards_pkey PRIMARY KEY (id);
ALTER TABLE public.rich_auntie_sponsorships ADD CONSTRAINT rich_auntie_sponsorships_pkey PRIMARY KEY (id);
ALTER TABLE public.scheduled_contributions ADD CONSTRAINT scheduled_contributions_pkey PRIMARY KEY (id);
ALTER TABLE public.security_events ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);
ALTER TABLE public.system_announcements ADD CONSTRAINT system_announcements_pkey PRIMARY KEY (id);
ALTER TABLE public.token_bundles ADD CONSTRAINT token_bundles_pkey PRIMARY KEY (id);
ALTER TABLE public.token_products ADD CONSTRAINT token_products_pkey PRIMARY KEY (id);
ALTER TABLE public.token_transactions ADD CONSTRAINT token_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.user_dismissed_announcements ADD CONSTRAINT user_dismissed_announcements_pkey PRIMARY KEY (user_id, announcement_id);
ALTER TABLE public.user_engagement_events ADD CONSTRAINT user_engagement_events_pkey PRIMARY KEY (id);
ALTER TABLE public.user_entitlements ADD CONSTRAINT user_entitlements_pkey PRIMARY KEY (id);
ALTER TABLE public.user_feature_flags ADD CONSTRAINT user_feature_flags_pkey PRIMARY KEY (id);
ALTER TABLE public.user_free_tier ADD CONSTRAINT user_free_tier_pkey PRIMARY KEY (id);
ALTER TABLE public.user_lifecycle_metrics ADD CONSTRAINT user_lifecycle_metrics_pkey PRIMARY KEY (user_id);
ALTER TABLE public.user_referrals ADD CONSTRAINT user_referrals_pkey PRIMARY KEY (id);
ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.user_trusted_devices ADD CONSTRAINT user_trusted_devices_pkey PRIMARY KEY (id);
ALTER TABLE public.user_wealth_signals ADD CONSTRAINT user_wealth_signals_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.vendor_bookings ADD CONSTRAINT vendor_bookings_pkey PRIMARY KEY (id);
ALTER TABLE public.vendors ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);
ALTER TABLE public.verification_codes ADD CONSTRAINT verification_codes_pkey PRIMARY KEY (id);
ALTER TABLE public.blocked_users ADD CONSTRAINT blocked_users_blocker_user_id_blocked_user_id_key UNIQUE (blocker_user_id, blocked_user_id);
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_campaign_code_key UNIQUE (campaign_code);
ALTER TABLE public.contributions ADD CONSTRAINT contributions_receipt_number_key UNIQUE (receipt_number);
ALTER TABLE public.event_budgets ADD CONSTRAINT event_budgets_event_id_key UNIQUE (event_id);
ALTER TABLE public.event_fund_links ADD CONSTRAINT event_fund_links_event_id_key UNIQUE (event_id);
ALTER TABLE public.event_fund_links ADD CONSTRAINT event_fund_links_fund_id_key UNIQUE (fund_id);
ALTER TABLE public.event_guests ADD CONSTRAINT event_guests_event_id_guest_phone_key UNIQUE (event_id, guest_phone);
ALTER TABLE public.event_guests ADD CONSTRAINT event_guests_event_id_user_id_key UNIQUE (event_id, user_id);
ALTER TABLE public.event_organisers ADD CONSTRAINT event_organisers_event_id_invited_phone_key UNIQUE (event_id, invited_phone);
ALTER TABLE public.event_organisers ADD CONSTRAINT event_organisers_event_id_user_id_key UNIQUE (event_id, user_id);
ALTER TABLE public.event_type_config ADD CONSTRAINT event_type_config_event_type_key UNIQUE (event_type);
ALTER TABLE public.events ADD CONSTRAINT events_event_code_key UNIQUE (event_code);
ALTER TABLE public.events ADD CONSTRAINT events_share_code_key UNIQUE (share_code);
ALTER TABLE public.fund_allowances ADD CONSTRAINT fund_allowances_fund_id_key UNIQUE (fund_id);
ALTER TABLE public.fund_limits ADD CONSTRAINT fund_limits_country_code_trust_level_key UNIQUE (country_code, trust_level);
ALTER TABLE public.fund_members ADD CONSTRAINT fund_members_fund_id_invited_phone_key UNIQUE (fund_id, invited_phone);
ALTER TABLE public.fund_members ADD CONSTRAINT fund_members_fund_id_user_id_key UNIQUE (fund_id, user_id);
ALTER TABLE public.fund_succession_votes ADD CONSTRAINT fund_succession_votes_request_id_voter_user_id_key UNIQUE (request_id, voter_user_id);
ALTER TABLE public.fund_type_config ADD CONSTRAINT fund_type_config_fund_type_key UNIQUE (fund_type);
ALTER TABLE public.funds ADD CONSTRAINT funds_fund_code_key UNIQUE (fund_code);
ALTER TABLE public.ip_blocklist ADD CONSTRAINT ip_blocklist_ip_address_key UNIQUE (ip_address);
ALTER TABLE public.member_vouches ADD CONSTRAINT member_vouches_fund_id_voucher_user_id_key UNIQUE (fund_id, voucher_user_id);
ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_template_code_key UNIQUE (template_code);
ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_template_code_language_key UNIQUE (template_code, language);
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);
ALTER TABLE public.organizations ADD CONSTRAINT organizations_referral_code_key UNIQUE (referral_code);
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_code_key UNIQUE (code);
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_token_unique UNIQUE (expo_push_token);
ALTER TABLE public.recurring_group_members ADD CONSTRAINT recurring_group_members_group_id_member_phone_key UNIQUE (group_id, member_phone);
ALTER TABLE public.recurring_group_members ADD CONSTRAINT recurring_group_members_group_id_user_id_key UNIQUE (group_id, user_id);
ALTER TABLE public.recurring_groups ADD CONSTRAINT recurring_groups_group_code_key UNIQUE (group_code);
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_ticket_number_key UNIQUE (ticket_number);
ALTER TABLE public.token_bundles ADD CONSTRAINT token_bundles_bundle_code_key UNIQUE (bundle_code);
ALTER TABLE public.token_products ADD CONSTRAINT token_products_product_code_key UNIQUE (product_code);
ALTER TABLE public.user_feature_flags ADD CONSTRAINT user_feature_flags_user_id_feature_code_key UNIQUE (user_id, feature_code);
ALTER TABLE public.user_free_tier ADD CONSTRAINT user_free_tier_user_id_key UNIQUE (user_id);
ALTER TABLE public.user_referrals ADD CONSTRAINT user_referrals_referred_id_key UNIQUE (referred_id);
ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_user_id_device_id_key UNIQUE (user_id, device_id);
ALTER TABLE public.user_trusted_devices ADD CONSTRAINT user_trusted_devices_user_id_device_id_key UNIQUE (user_id, device_id);
ALTER TABLE public.users ADD CONSTRAINT users_phone_key UNIQUE (phone);
ALTER TABLE public.users ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);
ALTER TABLE public.account_recovery_attempts ADD CONSTRAINT account_recovery_attempts_claimed_user_id_fkey FOREIGN KEY (claimed_user_id) REFERENCES users(id);
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.api_usage_logs ADD CONSTRAINT api_usage_logs_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES api_keys(id);
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.blocked_users ADD CONSTRAINT blocked_users_blocked_user_id_fkey FOREIGN KEY (blocked_user_id) REFERENCES users(id);
ALTER TABLE public.blocked_users ADD CONSTRAINT blocked_users_blocker_user_id_fkey FOREIGN KEY (blocker_user_id) REFERENCES users(id);
ALTER TABLE public.consent_log ADD CONSTRAINT consent_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.contribution_edits ADD CONSTRAINT contribution_edits_contribution_id_fkey FOREIGN KEY (contribution_id) REFERENCES contributions(id);
ALTER TABLE public.contribution_edits ADD CONSTRAINT contribution_edits_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES users(id);
ALTER TABLE public.contribution_reminders ADD CONSTRAINT contribution_reminders_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.contribution_reminders ADD CONSTRAINT contribution_reminders_fund_member_id_fkey FOREIGN KEY (fund_member_id) REFERENCES fund_members(id);
ALTER TABLE public.contributions ADD CONSTRAINT contributions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES users(id);
ALTER TABLE public.contributions ADD CONSTRAINT contributions_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE CASCADE;
ALTER TABLE public.contributions ADD CONSTRAINT contributions_possible_duplicate_of_fkey FOREIGN KEY (possible_duplicate_of) REFERENCES contributions(id);
ALTER TABLE public.contributions ADD CONSTRAINT contributions_refund_confirmed_by_fkey FOREIGN KEY (refund_confirmed_by) REFERENCES users(id);
ALTER TABLE public.contributions ADD CONSTRAINT contributions_tagged_by_fkey FOREIGN KEY (tagged_by) REFERENCES users(id);
ALTER TABLE public.contributions ADD CONSTRAINT contributions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.country_waitlist ADD CONSTRAINT country_waitlist_signed_up_user_id_fkey FOREIGN KEY (signed_up_user_id) REFERENCES users(id);
ALTER TABLE public.data_export_requests ADD CONSTRAINT data_export_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.disputes ADD CONSTRAINT disputes_against_user_fkey FOREIGN KEY (against_user) REFERENCES users(id);
ALTER TABLE public.disputes ADD CONSTRAINT disputes_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.disputes ADD CONSTRAINT disputes_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES users(id);
ALTER TABLE public.disputes ADD CONSTRAINT disputes_related_contribution_id_fkey FOREIGN KEY (related_contribution_id) REFERENCES contributions(id);
ALTER TABLE public.disputes ADD CONSTRAINT disputes_related_expense_id_fkey FOREIGN KEY (related_expense_id) REFERENCES expenses(id);
ALTER TABLE public.event_budgets ADD CONSTRAINT event_budgets_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public.event_fund_links ADD CONSTRAINT event_fund_links_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id);
ALTER TABLE public.event_fund_links ADD CONSTRAINT event_fund_links_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.event_fund_links ADD CONSTRAINT event_fund_links_linked_by_fkey FOREIGN KEY (linked_by) REFERENCES users(id);
ALTER TABLE public.event_fund_links ADD CONSTRAINT event_fund_links_token_transaction_id_fkey FOREIGN KEY (token_transaction_id) REFERENCES token_transactions(id);
ALTER TABLE public.event_fund_links ADD CONSTRAINT event_fund_links_unlinked_by_fkey FOREIGN KEY (unlinked_by) REFERENCES users(id);
ALTER TABLE public.event_guests ADD CONSTRAINT event_guests_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public.event_guests ADD CONSTRAINT event_guests_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id);
ALTER TABLE public.event_guests ADD CONSTRAINT event_guests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.event_organisers ADD CONSTRAINT event_organisers_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public.event_organisers ADD CONSTRAINT event_organisers_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id);
ALTER TABLE public.event_organisers ADD CONSTRAINT event_organisers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.events ADD CONSTRAINT events_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id);
ALTER TABLE public.events ADD CONSTRAINT events_linked_fund_id_fkey FOREIGN KEY (linked_fund_id) REFERENCES funds(id);
ALTER TABLE public.expense_edits ADD CONSTRAINT expense_edits_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES users(id);
ALTER TABLE public.expense_edits ADD CONSTRAINT expense_edits_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES expenses(id);
ALTER TABLE public.expense_queries ADD CONSTRAINT expense_queries_asked_by_fkey FOREIGN KEY (asked_by) REFERENCES users(id);
ALTER TABLE public.expense_queries ADD CONSTRAINT expense_queries_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES expenses(id);
ALTER TABLE public.expense_queries ADD CONSTRAINT expense_queries_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.expense_queries ADD CONSTRAINT expense_queries_responded_by_fkey FOREIGN KEY (responded_by) REFERENCES users(id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_added_by_fkey FOREIGN KEY (added_by) REFERENCES users(id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_sponsored_by_user_id_fkey FOREIGN KEY (sponsored_by_user_id) REFERENCES users(id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id);
ALTER TABLE public.failed_login_attempts ADD CONSTRAINT failed_login_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.fraud_signals ADD CONSTRAINT fraud_signals_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.fraud_signals ADD CONSTRAINT fraud_signals_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.fund_allowances ADD CONSTRAINT fund_allowances_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE CASCADE;
ALTER TABLE public.fund_announcements ADD CONSTRAINT fund_announcements_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE CASCADE;
ALTER TABLE public.fund_announcements ADD CONSTRAINT fund_announcements_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES users(id);
ALTER TABLE public.fund_exports ADD CONSTRAINT fund_exports_exported_by_fkey FOREIGN KEY (exported_by) REFERENCES users(id);
ALTER TABLE public.fund_exports ADD CONSTRAINT fund_exports_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.fund_limits ADD CONSTRAINT fund_limits_country_code_fkey FOREIGN KEY (country_code) REFERENCES countries(code);
ALTER TABLE public.fund_members ADD CONSTRAINT fund_members_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE CASCADE;
ALTER TABLE public.fund_members ADD CONSTRAINT fund_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id);
ALTER TABLE public.fund_members ADD CONSTRAINT fund_members_promoted_by_fkey FOREIGN KEY (promoted_by) REFERENCES users(id);
ALTER TABLE public.fund_members ADD CONSTRAINT fund_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.fund_milestones ADD CONSTRAINT fund_milestones_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.fund_ownership_history ADD CONSTRAINT fund_ownership_history_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.fund_ownership_history ADD CONSTRAINT fund_ownership_history_new_owner_id_fkey FOREIGN KEY (new_owner_id) REFERENCES users(id);
ALTER TABLE public.fund_ownership_history ADD CONSTRAINT fund_ownership_history_previous_owner_id_fkey FOREIGN KEY (previous_owner_id) REFERENCES users(id);
ALTER TABLE public.fund_ownership_history ADD CONSTRAINT fund_ownership_history_succession_request_id_fkey FOREIGN KEY (succession_request_id) REFERENCES fund_succession_requests(id);
ALTER TABLE public.fund_reports ADD CONSTRAINT fund_reports_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.fund_reports ADD CONSTRAINT fund_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES users(id);
ALTER TABLE public.fund_shares ADD CONSTRAINT fund_shares_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.fund_shares ADD CONSTRAINT fund_shares_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES users(id);
ALTER TABLE public.fund_succession_requests ADD CONSTRAINT fund_succession_requests_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.fund_succession_requests ADD CONSTRAINT fund_succession_requests_previous_owner_id_fkey FOREIGN KEY (previous_owner_id) REFERENCES users(id);
ALTER TABLE public.fund_succession_requests ADD CONSTRAINT fund_succession_requests_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES users(id);
ALTER TABLE public.fund_succession_votes ADD CONSTRAINT fund_succession_votes_request_id_fkey FOREIGN KEY (request_id) REFERENCES fund_succession_requests(id);
ALTER TABLE public.fund_succession_votes ADD CONSTRAINT fund_succession_votes_voter_user_id_fkey FOREIGN KEY (voter_user_id) REFERENCES users(id);
ALTER TABLE public.funds ADD CONSTRAINT fk_funds_org FOREIGN KEY (referral_organization_id) REFERENCES organizations(id);
ALTER TABLE public.funds ADD CONSTRAINT funds_linked_event_id_fkey FOREIGN KEY (linked_event_id) REFERENCES events(id);
ALTER TABLE public.funds ADD CONSTRAINT funds_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id);
ALTER TABLE public.funds ADD CONSTRAINT funds_successor_user_id_fkey FOREIGN KEY (successor_user_id) REFERENCES users(id);
ALTER TABLE public.funds ADD CONSTRAINT funds_transferred_from_fkey FOREIGN KEY (transferred_from) REFERENCES users(id);
ALTER TABLE public.high_value_fund_requests ADD CONSTRAINT high_value_fund_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.lead_qualification_data ADD CONSTRAINT lead_qualification_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.login_notifications ADD CONSTRAINT login_notifications_session_id_fkey FOREIGN KEY (session_id) REFERENCES user_sessions(id);
ALTER TABLE public.login_notifications ADD CONSTRAINT login_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.member_vouches ADD CONSTRAINT member_vouches_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.member_vouches ADD CONSTRAINT member_vouches_vouched_for_user_id_fkey FOREIGN KEY (vouched_for_user_id) REFERENCES users(id);
ALTER TABLE public.member_vouches ADD CONSTRAINT member_vouches_voucher_user_id_fkey FOREIGN KEY (voucher_user_id) REFERENCES users(id);
ALTER TABLE public.mobile_money_verifications ADD CONSTRAINT mobile_money_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.offline_queue ADD CONSTRAINT offline_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.organization_payouts ADD CONSTRAINT organization_payouts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE public.organizations ADD CONSTRAINT organizations_country_code_fkey FOREIGN KEY (country_code) REFERENCES countries(code);
ALTER TABLE public.partner_leads ADD CONSTRAINT partner_leads_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.partner_leads ADD CONSTRAINT partner_leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.payments ADD CONSTRAINT payments_bundle_code_fkey FOREIGN KEY (bundle_code) REFERENCES token_bundles(bundle_code);
ALTER TABLE public.payments ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.payouts ADD CONSTRAINT payouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.promo_code_uses ADD CONSTRAINT promo_code_uses_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id);
ALTER TABLE public.promo_code_uses ADD CONSTRAINT promo_code_uses_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id);
ALTER TABLE public.promo_code_uses ADD CONSTRAINT promo_code_uses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.recurring_group_members ADD CONSTRAINT recurring_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES recurring_groups(id);
ALTER TABLE public.recurring_group_members ADD CONSTRAINT recurring_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.recurring_groups ADD CONSTRAINT recurring_groups_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id);
ALTER TABLE public.recurring_rounds ADD CONSTRAINT recurring_rounds_group_id_fkey FOREIGN KEY (group_id) REFERENCES recurring_groups(id);
ALTER TABLE public.recurring_rounds ADD CONSTRAINT recurring_rounds_recipient_member_id_fkey FOREIGN KEY (recipient_member_id) REFERENCES recurring_group_members(id);
ALTER TABLE public.referral_rewards ADD CONSTRAINT referral_rewards_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES users(id);
ALTER TABLE public.referral_rewards ADD CONSTRAINT referral_rewards_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES users(id);
ALTER TABLE public.rich_auntie_sponsorships ADD CONSTRAINT rich_auntie_sponsorships_contribution_id_fkey FOREIGN KEY (contribution_id) REFERENCES contributions(id);
ALTER TABLE public.rich_auntie_sponsorships ADD CONSTRAINT rich_auntie_sponsorships_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES expenses(id);
ALTER TABLE public.rich_auntie_sponsorships ADD CONSTRAINT rich_auntie_sponsorships_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE CASCADE;
ALTER TABLE public.rich_auntie_sponsorships ADD CONSTRAINT rich_auntie_sponsorships_tagged_by_fkey FOREIGN KEY (tagged_by) REFERENCES users(id);
ALTER TABLE public.rich_auntie_sponsorships ADD CONSTRAINT rich_auntie_sponsorships_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.scheduled_contributions ADD CONSTRAINT scheduled_contributions_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.scheduled_contributions ADD CONSTRAINT scheduled_contributions_recurring_group_id_fkey FOREIGN KEY (recurring_group_id) REFERENCES recurring_groups(id);
ALTER TABLE public.scheduled_contributions ADD CONSTRAINT scheduled_contributions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.security_events ADD CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_matched_contribution_id_fkey FOREIGN KEY (matched_contribution_id) REFERENCES contributions(id);
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_matched_fund_id_fkey FOREIGN KEY (matched_fund_id) REFERENCES funds(id);
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_related_contribution_id_fkey FOREIGN KEY (related_contribution_id) REFERENCES contributions(id);
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_related_fund_id_fkey FOREIGN KEY (related_fund_id) REFERENCES funds(id);
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.token_transactions ADD CONSTRAINT token_transactions_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.token_transactions ADD CONSTRAINT token_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.user_dismissed_announcements ADD CONSTRAINT user_dismissed_announcements_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES system_announcements(id);
ALTER TABLE public.user_dismissed_announcements ADD CONSTRAINT user_dismissed_announcements_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.user_engagement_events ADD CONSTRAINT user_engagement_events_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.user_engagement_events ADD CONSTRAINT user_engagement_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.user_entitlements ADD CONSTRAINT user_entitlements_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.user_entitlements ADD CONSTRAINT user_entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.user_feature_flags ADD CONSTRAINT user_feature_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.user_free_tier ADD CONSTRAINT user_free_tier_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.user_lifecycle_metrics ADD CONSTRAINT user_lifecycle_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.user_referrals ADD CONSTRAINT user_referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES users(id);
ALTER TABLE public.user_referrals ADD CONSTRAINT user_referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES users(id);
ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.user_trusted_devices ADD CONSTRAINT user_trusted_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.user_wealth_signals ADD CONSTRAINT user_wealth_signals_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.users ADD CONSTRAINT users_country_code_fkey FOREIGN KEY (country_code) REFERENCES countries(code);
ALTER TABLE public.users ADD CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES users(id);
ALTER TABLE public.vendor_bookings ADD CONSTRAINT vendor_bookings_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id);
ALTER TABLE public.vendor_bookings ADD CONSTRAINT vendor_bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.vendor_bookings ADD CONSTRAINT vendor_bookings_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id);
ALTER TABLE public.verification_codes ADD CONSTRAINT verification_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- ── indexes ──────────────────────────────────────────────
CREATE INDEX idx_account_recovery_claimed ON public.account_recovery_attempts USING btree (claimed_phone);
CREATE INDEX idx_account_recovery_status ON public.account_recovery_attempts USING btree (status);
CREATE INDEX idx_api_keys_prefix ON public.api_keys USING btree (key_prefix);
CREATE INDEX idx_api_usage_created ON public.api_usage_logs USING btree (created_at DESC);
CREATE INDEX idx_api_usage_key ON public.api_usage_logs USING btree (api_key_id);
CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (created_at DESC);
CREATE INDEX idx_audit_log_entity ON public.audit_log USING btree (entity_type, entity_id);
CREATE INDEX idx_audit_log_fund ON public.audit_log USING btree (fund_id);
CREATE INDEX idx_audit_log_user ON public.audit_log USING btree (user_id);
CREATE INDEX idx_blocked_users_blocker ON public.blocked_users USING btree (blocker_user_id);
CREATE INDEX idx_campaigns_active ON public.campaigns USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_campaigns_code ON public.campaigns USING btree (campaign_code);
CREATE INDEX idx_consent_log_type ON public.consent_log USING btree (consent_type);
CREATE INDEX idx_consent_log_user ON public.consent_log USING btree (user_id);
CREATE INDEX idx_contribution_edits_contribution ON public.contribution_edits USING btree (contribution_id);
CREATE INDEX idx_contribution_reminders_fund ON public.contribution_reminders USING btree (fund_id);
CREATE INDEX idx_contribution_reminders_scheduled ON public.contribution_reminders USING btree (scheduled_at) WHERE (sent_at IS NULL);
CREATE INDEX idx_contributions_created ON public.contributions USING btree (created_at DESC);
CREATE INDEX idx_contributions_fund ON public.contributions USING btree (fund_id);
CREATE INDEX idx_contributions_phone ON public.contributions USING btree (contributor_phone);
CREATE INDEX idx_contributions_receipt ON public.contributions USING btree (receipt_number);
CREATE INDEX idx_contributions_status ON public.contributions USING btree (status);
CREATE INDEX idx_contributions_user ON public.contributions USING btree (user_id);
CREATE INDEX idx_countries_active ON public.countries USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_country_waitlist_country ON public.country_waitlist USING btree (country_code);
CREATE INDEX idx_data_export_status ON public.data_export_requests USING btree (status);
CREATE INDEX idx_data_export_user ON public.data_export_requests USING btree (user_id);
CREATE INDEX idx_disputes_fund ON public.disputes USING btree (fund_id);
CREATE INDEX idx_disputes_raised_by ON public.disputes USING btree (raised_by);
CREATE INDEX idx_disputes_status ON public.disputes USING btree (status);
CREATE INDEX idx_engagement_events_created ON public.user_engagement_events USING btree (created_at DESC);
CREATE INDEX idx_engagement_events_type ON public.user_engagement_events USING btree (event_type);
CREATE INDEX idx_engagement_events_user ON public.user_engagement_events USING btree (user_id);
CREATE INDEX idx_event_fund_links_event ON public.event_fund_links USING btree (event_id);
CREATE INDEX idx_event_fund_links_fund ON public.event_fund_links USING btree (fund_id);
CREATE INDEX idx_event_guests_event ON public.event_guests USING btree (event_id);
CREATE INDEX idx_event_guests_rsvp ON public.event_guests USING btree (rsvp_status);
CREATE INDEX idx_event_guests_user ON public.event_guests USING btree (user_id);
CREATE INDEX idx_event_organisers_event ON public.event_organisers USING btree (event_id);
CREATE INDEX idx_event_organisers_user ON public.event_organisers USING btree (user_id);
CREATE INDEX idx_events_code ON public.events USING btree (event_code);
CREATE INDEX idx_events_creator ON public.events USING btree (creator_id);
CREATE INDEX idx_events_date ON public.events USING btree (event_date);
CREATE INDEX idx_events_linked_fund ON public.events USING btree (linked_fund_id);
CREATE INDEX idx_events_share_code ON public.events USING btree (share_code);
CREATE INDEX idx_events_status ON public.events USING btree (status);
CREATE INDEX idx_exchange_rates_currencies ON public.exchange_rates USING btree (from_currency, to_currency);
CREATE INDEX idx_expense_edits_expense ON public.expense_edits USING btree (expense_id);
CREATE INDEX idx_expense_queries_expense ON public.expense_queries USING btree (expense_id);
CREATE INDEX idx_expense_queries_fund ON public.expense_queries USING btree (fund_id);
CREATE INDEX idx_expense_queries_status ON public.expense_queries USING btree (status);
CREATE INDEX idx_expenses_category ON public.expenses USING btree (category);
CREATE INDEX idx_expenses_created ON public.expenses USING btree (created_at DESC);
CREATE INDEX idx_expenses_fund ON public.expenses USING btree (fund_id);
CREATE INDEX idx_expenses_sponsored ON public.expenses USING btree (is_sponsored) WHERE (is_sponsored = true);
CREATE INDEX idx_failed_logins_ip ON public.failed_login_attempts USING btree (ip_address);
CREATE INDEX idx_failed_logins_phone ON public.failed_login_attempts USING btree (phone);
CREATE INDEX idx_feature_flags_feature ON public.user_feature_flags USING btree (feature_code);
CREATE INDEX idx_feature_flags_user ON public.user_feature_flags USING btree (user_id);
CREATE INDEX idx_fraud_signals_fund ON public.fraud_signals USING btree (fund_id);
CREATE INDEX idx_fraud_signals_unreviewed ON public.fraud_signals USING btree (reviewed) WHERE (reviewed = false);
CREATE INDEX idx_fraud_signals_user ON public.fraud_signals USING btree (user_id);
CREATE INDEX idx_fund_announcements_fund ON public.fund_announcements USING btree (fund_id);
CREATE INDEX idx_fund_benchmarks_country ON public.fund_benchmarks USING btree (country_code);
CREATE INDEX idx_fund_benchmarks_type ON public.fund_benchmarks USING btree (fund_type);
CREATE INDEX idx_fund_exports_fund ON public.fund_exports USING btree (fund_id);
CREATE INDEX idx_fund_members_fund ON public.fund_members USING btree (fund_id);
CREATE INDEX idx_fund_members_phone ON public.fund_members USING btree (invited_phone);
CREATE INDEX idx_fund_members_status ON public.fund_members USING btree (status);
CREATE INDEX idx_fund_members_user ON public.fund_members USING btree (user_id);
CREATE INDEX idx_fund_milestones_fund ON public.fund_milestones USING btree (fund_id);
CREATE INDEX idx_fund_reports_fund ON public.fund_reports USING btree (fund_id);
CREATE INDEX idx_fund_reports_status ON public.fund_reports USING btree (status);
CREATE INDEX idx_fund_shares_fund ON public.fund_shares USING btree (fund_id);
CREATE INDEX idx_fund_templates_country ON public.fund_templates USING btree (country_code);
CREATE INDEX idx_fund_templates_type ON public.fund_templates USING btree (fund_type);
CREATE INDEX idx_funds_code ON public.funds USING btree (fund_code);
CREATE INDEX idx_funds_created ON public.funds USING btree (created_at DESC);
CREATE INDEX idx_funds_linked_event ON public.funds USING btree (linked_event_id);
CREATE INDEX idx_funds_owner ON public.funds USING btree (owner_id);
CREATE INDEX idx_funds_status ON public.funds USING btree (status);
CREATE INDEX idx_funds_type ON public.funds USING btree (fund_type);
CREATE INDEX idx_high_value_requests_status ON public.high_value_fund_requests USING btree (status);
CREATE INDEX idx_high_value_requests_user ON public.high_value_fund_requests USING btree (user_id);
CREATE INDEX idx_lifecycle_engagement ON public.user_lifecycle_metrics USING btree (engagement_score DESC);
CREATE INDEX idx_lifecycle_stage ON public.user_lifecycle_metrics USING btree (lifecycle_stage);
CREATE INDEX idx_login_notifications_user ON public.login_notifications USING btree (user_id);
CREATE INDEX idx_member_vouches_fund ON public.member_vouches USING btree (fund_id);
CREATE INDEX idx_member_vouches_vouched_for ON public.member_vouches USING btree (vouched_for_user_id);
CREATE INDEX idx_mm_verifications_status ON public.mobile_money_verifications USING btree (status);
CREATE INDEX idx_mm_verifications_user ON public.mobile_money_verifications USING btree (user_id);
CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);
CREATE INDEX idx_notifications_fund ON public.notifications USING btree (fund_id);
CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);
CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);
CREATE INDEX idx_offline_queue_unsynced ON public.offline_queue USING btree (is_synced) WHERE (is_synced = false);
CREATE INDEX idx_offline_queue_user ON public.offline_queue USING btree (user_id);
CREATE INDEX idx_org_members_org ON public.organization_members USING btree (organization_id);
CREATE INDEX idx_org_members_user ON public.organization_members USING btree (user_id);
CREATE INDEX idx_org_payouts_org ON public.organization_payouts USING btree (organization_id);
CREATE INDEX idx_org_payouts_status ON public.organization_payouts USING btree (status);
CREATE INDEX idx_organizations_country ON public.organizations USING btree (country_code);
CREATE INDEX idx_organizations_referral ON public.organizations USING btree (referral_code);
CREATE INDEX idx_organizations_type ON public.organizations USING btree (type);
CREATE INDEX idx_ownership_history_fund ON public.fund_ownership_history USING btree (fund_id);
CREATE INDEX idx_partner_leads_status ON public.partner_leads USING btree (status);
CREATE INDEX idx_partner_leads_user ON public.partner_leads USING btree (user_id);
CREATE INDEX idx_payments_created ON public.payments USING btree (created_at DESC);
CREATE INDEX idx_payments_status ON public.payments USING btree (status);
CREATE INDEX idx_payments_user ON public.payments USING btree (user_id);
CREATE INDEX idx_payouts_status ON public.payouts USING btree (status);
CREATE INDEX idx_payouts_user ON public.payouts USING btree (user_id);
CREATE INDEX idx_promo_codes_active ON public.promo_codes USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (code);
CREATE INDEX idx_promo_uses_code ON public.promo_code_uses USING btree (promo_code_id);
CREATE INDEX idx_promo_uses_user ON public.promo_code_uses USING btree (user_id);
CREATE INDEX idx_recurring_groups_owner ON public.recurring_groups USING btree (owner_id);
CREATE INDEX idx_recurring_members_group ON public.recurring_group_members USING btree (group_id);
CREATE INDEX idx_recurring_rounds_group ON public.recurring_rounds USING btree (group_id);
CREATE INDEX idx_referral_rewards_referred ON public.referral_rewards USING btree (referred_id);
CREATE INDEX idx_referral_rewards_referrer ON public.referral_rewards USING btree (referrer_id);
CREATE INDEX idx_rich_auntie_fund ON public.rich_auntie_sponsorships USING btree (fund_id);
CREATE INDEX idx_rich_auntie_user ON public.rich_auntie_sponsorships USING btree (user_id);
CREATE INDEX idx_scheduled_contributions_due ON public.scheduled_contributions USING btree (next_due_date) WHERE (is_active = true);
CREATE INDEX idx_scheduled_contributions_user ON public.scheduled_contributions USING btree (user_id);
CREATE INDEX idx_security_events_severity ON public.security_events USING btree (severity);
CREATE INDEX idx_security_events_unreviewed ON public.security_events USING btree (requires_review) WHERE (requires_review = true);
CREATE INDEX idx_security_events_user ON public.security_events USING btree (user_id);
CREATE INDEX idx_sms_logs_created ON public.sms_logs USING btree (created_at DESC);
CREATE INDEX idx_sms_logs_status ON public.sms_logs USING btree (status);
CREATE INDEX idx_sms_logs_user ON public.sms_logs USING btree (user_id);
CREATE INDEX idx_succession_fund ON public.fund_succession_requests USING btree (fund_id);
CREATE INDEX idx_succession_status ON public.fund_succession_requests USING btree (status);
CREATE INDEX idx_succession_votes_request ON public.fund_succession_votes USING btree (request_id);
CREATE INDEX idx_support_tickets_number ON public.support_tickets USING btree (ticket_number);
CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);
CREATE INDEX idx_support_tickets_user ON public.support_tickets USING btree (user_id);
CREATE INDEX idx_system_announcements_active ON public.system_announcements USING btree (starts_at, ends_at);
CREATE INDEX idx_token_transactions_created ON public.token_transactions USING btree (created_at DESC);
CREATE INDEX idx_token_transactions_user ON public.token_transactions USING btree (user_id);
CREATE INDEX idx_trusted_devices_user ON public.user_trusted_devices USING btree (user_id);
CREATE INDEX idx_user_entitlements_type ON public.user_entitlements USING btree (entitlement_type);
CREATE INDEX idx_user_entitlements_user ON public.user_entitlements USING btree (user_id);
CREATE INDEX idx_user_referrals_referrer ON public.user_referrals USING btree (referrer_id);
CREATE INDEX idx_user_sessions_active ON public.user_sessions USING btree (last_active_at DESC);
CREATE INDEX idx_user_sessions_user ON public.user_sessions USING btree (user_id);
CREATE INDEX idx_users_country ON public.users USING btree (country_code);
CREATE INDEX idx_users_phone ON public.users USING btree (phone);
CREATE INDEX idx_users_referral_code ON public.users USING btree (referral_code);
CREATE INDEX idx_users_referred_by ON public.users USING btree (referred_by);
CREATE INDEX idx_users_trust_level ON public.users USING btree (trust_level);
CREATE INDEX idx_vendor_bookings_fund ON public.vendor_bookings USING btree (fund_id);
CREATE INDEX idx_vendor_bookings_vendor ON public.vendor_bookings USING btree (vendor_id);
CREATE INDEX idx_vendors_category ON public.vendors USING btree (category);
CREATE INDEX idx_vendors_location ON public.vendors USING btree (country_code, city);
CREATE INDEX idx_verification_codes_active ON public.verification_codes USING btree (phone, is_used, expires_at) WHERE (is_used = false);
CREATE INDEX idx_verification_codes_phone ON public.verification_codes USING btree (phone);
CREATE INDEX idx_verification_codes_user ON public.verification_codes USING btree (user_id);
CREATE INDEX idx_wealth_signals_user ON public.user_wealth_signals USING btree (user_id);
CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX push_tokens_user_idx ON public.push_tokens USING btree (user_id);

-- ── views ──────────────────────────────────────────────

-- ── row level security ──────────────────────────────────────────────
ALTER TABLE public.account_recovery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_fund_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_organisers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_type_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_ownership_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_succession_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_succession_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_type_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.high_value_fund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_qualification_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_vouches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_money_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_aggregators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rich_auntie_sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dismissed_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_free_tier ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lifecycle_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wealth_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- ── policies ──────────────────────────────────────────────
CREATE POLICY account_recovery_blocked ON public.account_recovery_attempts AS PERMISSIVE FOR SELECT TO public USING (false);
CREATE POLICY api_keys_select ON public.api_keys AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY api_usage_logs_select ON public.api_usage_logs AS PERMISSIVE FOR SELECT TO public USING ((api_key_id IN ( SELECT api_keys.id
   FROM api_keys
  WHERE (api_keys.user_id = auth.uid()))));
CREATE POLICY app_config_select ON public.app_config AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IS NOT NULL));
CREATE POLICY audit_log_select ON public.audit_log AS PERMISSIVE FOR SELECT TO public USING (((user_id = auth.uid()) OR ((fund_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM fund_members
  WHERE ((fund_members.fund_id = audit_log.fund_id) AND (fund_members.user_id = auth.uid()) AND (fund_members.status = 'joined'::member_status)))))));
CREATE POLICY blocked_users_blocked ON public.blocked_users AS PERMISSIVE FOR SELECT TO public USING (false);
CREATE POLICY campaigns_blocked ON public.campaigns AS PERMISSIVE FOR SELECT TO public USING (false);
CREATE POLICY consent_log_insert ON public.consent_log AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY consent_log_select ON public.consent_log AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY contribution_edits_select ON public.contribution_edits AS PERMISSIVE FOR SELECT TO public USING ((contribution_id IN ( SELECT contributions.id
   FROM contributions
  WHERE (contributions.fund_id IN ( SELECT fund_members.fund_id
           FROM fund_members
          WHERE (fund_members.user_id = auth.uid()))))));
CREATE POLICY contribution_reminders_insert ON public.contribution_reminders AS PERMISSIVE FOR INSERT TO public WITH CHECK ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE ((fund_members.user_id = auth.uid()) AND (fund_members.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role]))))));
CREATE POLICY contribution_reminders_select ON public.contribution_reminders AS PERMISSIVE FOR SELECT TO public USING ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid()))));
CREATE POLICY contributions_insert ON public.contributions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM funds f
  WHERE ((f.id = contributions.fund_id) AND ((f.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM fund_members fm
          WHERE ((fm.fund_id = f.id) AND (fm.user_id = auth.uid()) AND (fm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role]))))))))));
CREATE POLICY contributions_select ON public.contributions AS PERMISSIVE FOR SELECT TO public USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM fund_members
  WHERE ((fund_members.fund_id = contributions.fund_id) AND (fund_members.user_id = auth.uid()) AND (fund_members.status = 'joined'::member_status))))));
CREATE POLICY countries_select ON public.countries AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY country_waitlist_insert ON public.country_waitlist AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY country_waitlist_select ON public.country_waitlist AS PERMISSIVE FOR SELECT TO public USING ((signed_up_user_id = auth.uid()));
CREATE POLICY data_export_insert ON public.data_export_requests AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY data_export_select ON public.data_export_requests AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY disputes_insert ON public.disputes AS PERMISSIVE FOR INSERT TO public WITH CHECK (((raised_by = auth.uid()) AND (fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid())))));
CREATE POLICY disputes_select ON public.disputes AS PERMISSIVE FOR SELECT TO public USING (((raised_by = auth.uid()) OR (fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE ((fund_members.user_id = auth.uid()) AND (fund_members.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role])))))));
CREATE POLICY event_budgets_manage_related ON public.event_budgets AS PERMISSIVE FOR ALL TO authenticated USING ((is_event_creator(event_id) OR is_event_organiser(event_id))) WITH CHECK ((is_event_creator(event_id) OR is_event_organiser(event_id)));
CREATE POLICY event_fund_links_insert_owner ON public.event_fund_links AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((linked_by = auth.uid()) AND is_event_creator(event_id) AND is_fund_owner(fund_id)));
CREATE POLICY event_fund_links_select_related ON public.event_fund_links AS PERMISSIVE FOR SELECT TO authenticated USING (((linked_by = auth.uid()) OR is_event_creator(event_id) OR is_event_organiser(event_id) OR is_fund_owner(fund_id) OR is_fund_member(fund_id)));
CREATE POLICY event_fund_links_update_owner ON public.event_fund_links AS PERMISSIVE FOR UPDATE TO authenticated USING (((linked_by = auth.uid()) OR is_event_creator(event_id) OR is_fund_owner(fund_id))) WITH CHECK (((linked_by = auth.uid()) OR is_event_creator(event_id) OR is_fund_owner(fund_id)));
CREATE POLICY event_guests_insert_manager ON public.event_guests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((invited_by = auth.uid()) AND (is_event_creator(event_id) OR is_event_organiser(event_id))));
CREATE POLICY event_guests_select_related ON public.event_guests AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR is_event_creator(event_id) OR is_event_organiser(event_id)));
CREATE POLICY event_guests_update_related ON public.event_guests AS PERMISSIVE FOR UPDATE TO authenticated USING (((user_id = auth.uid()) OR is_event_creator(event_id) OR is_event_organiser(event_id))) WITH CHECK (((user_id = auth.uid()) OR is_event_creator(event_id) OR is_event_organiser(event_id)));
CREATE POLICY event_organisers_insert_invited_by_self ON public.event_organisers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((invited_by = auth.uid()) AND is_event_creator(event_id)));
CREATE POLICY event_organisers_select_related ON public.event_organisers AS PERMISSIVE FOR SELECT TO authenticated USING (((invited_by = auth.uid()) OR (user_id = auth.uid()) OR is_event_creator(event_id) OR is_event_organiser(event_id)));
CREATE POLICY event_organisers_update_related ON public.event_organisers AS PERMISSIVE FOR UPDATE TO authenticated USING (((user_id = auth.uid()) OR is_event_creator(event_id))) WITH CHECK (((user_id = auth.uid()) OR is_event_creator(event_id)));
CREATE POLICY event_type_config_read ON public.event_type_config AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY events_insert_own ON public.events AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((creator_id = auth.uid()));
CREATE POLICY events_select_related ON public.events AS PERMISSIVE FOR SELECT TO authenticated USING (((creator_id = auth.uid()) OR is_event_organiser(id) OR is_event_guest(id)));
CREATE POLICY events_update_related ON public.events AS PERMISSIVE FOR UPDATE TO authenticated USING (((creator_id = auth.uid()) OR is_event_organiser(id))) WITH CHECK (((creator_id = auth.uid()) OR is_event_organiser(id)));
CREATE POLICY exchange_rates_select ON public.exchange_rates AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY expense_edits_select ON public.expense_edits AS PERMISSIVE FOR SELECT TO public USING ((expense_id IN ( SELECT expenses.id
   FROM expenses
  WHERE (expenses.fund_id IN ( SELECT fund_members.fund_id
           FROM fund_members
          WHERE (fund_members.user_id = auth.uid()))))));
CREATE POLICY expense_queries_insert ON public.expense_queries AS PERMISSIVE FOR INSERT TO public WITH CHECK (((asked_by = auth.uid()) AND (fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid())))));
CREATE POLICY expense_queries_select ON public.expense_queries AS PERMISSIVE FOR SELECT TO public USING ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid()))));
CREATE POLICY expenses_delete ON public.expenses AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1
   FROM funds f
  WHERE ((f.id = expenses.fund_id) AND (f.owner_id = auth.uid())))));
CREATE POLICY expenses_insert ON public.expenses AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM funds f
  WHERE ((f.id = expenses.fund_id) AND ((f.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM fund_members fm
          WHERE ((fm.fund_id = f.id) AND (fm.user_id = auth.uid()) AND (fm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role]))))))))));
CREATE POLICY expenses_select ON public.expenses AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM fund_members
  WHERE ((fund_members.fund_id = expenses.fund_id) AND (fund_members.user_id = auth.uid()) AND (fund_members.status = 'joined'::member_status)))));
CREATE POLICY failed_login_blocked ON public.failed_login_attempts AS PERMISSIVE FOR SELECT TO public USING (false);
CREATE POLICY fraud_signals_blocked ON public.fraud_signals AS PERMISSIVE FOR SELECT TO public USING (false);
CREATE POLICY fund_allowances_insert_owner ON public.fund_allowances AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_fund_owner(fund_id));
CREATE POLICY fund_allowances_select_related ON public.fund_allowances AS PERMISSIVE FOR SELECT TO authenticated USING ((is_fund_owner(fund_id) OR is_fund_member(fund_id)));
CREATE POLICY fund_allowances_update_manager ON public.fund_allowances AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_fund_owner(fund_id) OR is_fund_admin(fund_id))) WITH CHECK ((is_fund_owner(fund_id) OR is_fund_admin(fund_id)));
CREATE POLICY fund_announcements_insert ON public.fund_announcements AS PERMISSIVE FOR INSERT TO public WITH CHECK ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE ((fund_members.user_id = auth.uid()) AND (fund_members.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role]))))));
CREATE POLICY fund_announcements_select ON public.fund_announcements AS PERMISSIVE FOR SELECT TO public USING ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid()))));
CREATE POLICY fund_announcements_update ON public.fund_announcements AS PERMISSIVE FOR UPDATE TO public USING ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE ((fund_members.user_id = auth.uid()) AND (fund_members.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role]))))));
CREATE POLICY fund_benchmarks_select ON public.fund_benchmarks AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY fund_exports_insert ON public.fund_exports AS PERMISSIVE FOR INSERT TO public WITH CHECK (((exported_by = auth.uid()) AND (fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid())))));
CREATE POLICY fund_exports_select ON public.fund_exports AS PERMISSIVE FOR SELECT TO public USING ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid()))));
CREATE POLICY fund_limits_select ON public.fund_limits AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY fund_members_insert_manager ON public.fund_members AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((((invited_by = auth.uid()) AND (is_fund_owner(fund_id) OR is_fund_admin(fund_id))) OR ((user_id = auth.uid()) AND (invited_by = auth.uid()) AND (role = 'member'::member_role))));
CREATE POLICY fund_members_select_related ON public.fund_members AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (invited_by = auth.uid()) OR is_fund_owner(fund_id) OR is_fund_admin(fund_id)));
CREATE POLICY fund_members_update_manager ON public.fund_members AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_fund_owner(fund_id) OR is_fund_admin(fund_id))) WITH CHECK ((is_fund_owner(fund_id) OR is_fund_admin(fund_id)));
CREATE POLICY fund_members_update_related ON public.fund_members AS PERMISSIVE FOR UPDATE TO authenticated USING (((user_id = auth.uid()) OR is_fund_owner(fund_id) OR is_fund_admin(fund_id))) WITH CHECK (((user_id = auth.uid()) OR is_fund_owner(fund_id) OR is_fund_admin(fund_id)));
CREATE POLICY fund_milestones_select ON public.fund_milestones AS PERMISSIVE FOR SELECT TO public USING ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid()))));
CREATE POLICY ownership_history_select ON public.fund_ownership_history AS PERMISSIVE FOR SELECT TO public USING ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid()))));
CREATE POLICY fund_reports_insert ON public.fund_reports AS PERMISSIVE FOR INSERT TO public WITH CHECK ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid()))));
CREATE POLICY fund_reports_select ON public.fund_reports AS PERMISSIVE FOR SELECT TO public USING (((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE ((fund_members.user_id = auth.uid()) AND (fund_members.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role]))))) OR (reported_by = auth.uid())));
CREATE POLICY fund_shares_insert ON public.fund_shares AS PERMISSIVE FOR INSERT TO public WITH CHECK (((shared_by = auth.uid()) AND (fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid())))));
CREATE POLICY fund_shares_select ON public.fund_shares AS PERMISSIVE FOR SELECT TO public USING ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid()))));
CREATE POLICY succession_requests_insert ON public.fund_succession_requests AS PERMISSIVE FOR INSERT TO public WITH CHECK (((requester_user_id = auth.uid()) AND (fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE ((fund_members.user_id = auth.uid()) AND (fund_members.role = 'owner'::member_role))))));
CREATE POLICY succession_requests_select ON public.fund_succession_requests AS PERMISSIVE FOR SELECT TO public USING ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid()))));
CREATE POLICY succession_votes_insert ON public.fund_succession_votes AS PERMISSIVE FOR INSERT TO public WITH CHECK ((voter_user_id = auth.uid()));
CREATE POLICY succession_votes_select ON public.fund_succession_votes AS PERMISSIVE FOR SELECT TO public USING (((voter_user_id = auth.uid()) OR (request_id IN ( SELECT fund_succession_requests.id
   FROM fund_succession_requests
  WHERE (fund_succession_requests.fund_id IN ( SELECT fund_members.fund_id
           FROM fund_members
          WHERE (fund_members.user_id = auth.uid())))))));
CREATE POLICY fund_templates_select ON public.fund_templates AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
CREATE POLICY fund_type_config_select ON public.fund_type_config AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can discover funds by share code" ON public.funds AS PERMISSIVE FOR SELECT TO authenticated USING ((deleted_at IS NULL));
CREATE POLICY "Members and owners can read their funds" ON public.funds AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = owner_id) OR (EXISTS ( SELECT 1
   FROM fund_members
  WHERE ((fund_members.fund_id = funds.id) AND (fund_members.user_id = auth.uid()) AND (fund_members.status <> ALL (ARRAY['left'::member_status, 'removed'::member_status, 'declined'::member_status])))))));
CREATE POLICY funds_delete_own ON public.funds AS PERMISSIVE FOR DELETE TO authenticated USING ((owner_id = auth.uid()));
CREATE POLICY funds_insert_own ON public.funds AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY funds_select_member ON public.funds AS PERMISSIVE FOR SELECT TO public USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM fund_members
  WHERE ((fund_members.fund_id = funds.id) AND (fund_members.user_id = auth.uid()) AND (fund_members.status = ANY (ARRAY['joined'::member_status, 'pending'::member_status])))))));
CREATE POLICY funds_select_related ON public.funds AS PERMISSIVE FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR is_fund_member(id)));
CREATE POLICY funds_update_own ON public.funds AS PERMISSIVE FOR UPDATE TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY high_value_requests_insert ON public.high_value_fund_requests AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY high_value_requests_select ON public.high_value_fund_requests AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY ip_blocklist_blocked ON public.ip_blocklist AS PERMISSIVE FOR SELECT TO public USING (false);
CREATE POLICY lead_qualification_blocked ON public.lead_qualification_data AS PERMISSIVE FOR SELECT TO public USING (false);
CREATE POLICY login_notifications_select ON public.login_notifications AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY vouches_insert ON public.member_vouches AS PERMISSIVE FOR INSERT TO public WITH CHECK ((voucher_user_id = auth.uid()));
CREATE POLICY vouches_select ON public.member_vouches AS PERMISSIVE FOR SELECT TO public USING (((voucher_user_id = auth.uid()) OR (vouched_for_user_id = auth.uid()) OR (fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid())))));
CREATE POLICY mmv_insert ON public.mobile_money_verifications AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY mmv_select ON public.mobile_money_verifications AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY notification_templates_select ON public.notification_templates AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IS NOT NULL));
CREATE POLICY notifications_select_own ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY notifications_update_own ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY offline_queue_delete ON public.offline_queue AS PERMISSIVE FOR DELETE TO public USING ((user_id = auth.uid()));
CREATE POLICY offline_queue_insert ON public.offline_queue AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY offline_queue_select ON public.offline_queue AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY org_members_select ON public.organization_members AS PERMISSIVE FOR SELECT TO public USING ((organization_id IN ( SELECT organization_members_1.organization_id
   FROM organization_members organization_members_1
  WHERE (organization_members_1.user_id = auth.uid()))));
CREATE POLICY org_payouts_select ON public.organization_payouts AS PERMISSIVE FOR SELECT TO public USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = auth.uid()))));
CREATE POLICY organizations_insert ON public.organizations AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY organizations_select ON public.organizations AS PERMISSIVE FOR SELECT TO public USING ((id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = auth.uid()))));
CREATE POLICY partner_leads_blocked ON public.partner_leads AS PERMISSIVE FOR SELECT TO public USING (false);
CREATE POLICY payment_aggregators_select ON public.payment_aggregators AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
CREATE POLICY payments_insert ON public.payments AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY payments_select ON public.payments AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY payouts_select ON public.payouts AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY promo_code_uses_insert ON public.promo_code_uses AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY promo_code_uses_select ON public.promo_code_uses AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY promo_codes_select ON public.promo_codes AS PERMISSIVE FOR SELECT TO public USING (((is_active = true) AND (valid_from <= now()) AND ((valid_until IS NULL) OR (valid_until >= now()))));
CREATE POLICY push_tokens_delete_own ON public.push_tokens AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY push_tokens_insert_own ON public.push_tokens AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY push_tokens_select_own ON public.push_tokens AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY push_tokens_update_own ON public.push_tokens AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY recurring_group_members_insert ON public.recurring_group_members AS PERMISSIVE FOR INSERT TO public WITH CHECK ((group_id IN ( SELECT recurring_groups.id
   FROM recurring_groups
  WHERE (recurring_groups.owner_id = auth.uid()))));
CREATE POLICY recurring_group_members_select ON public.recurring_group_members AS PERMISSIVE FOR SELECT TO public USING ((group_id IN ( SELECT recurring_group_members_1.group_id
   FROM recurring_group_members recurring_group_members_1
  WHERE (recurring_group_members_1.user_id = auth.uid()))));
CREATE POLICY recurring_groups_insert ON public.recurring_groups AS PERMISSIVE FOR INSERT TO public WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY recurring_groups_select ON public.recurring_groups AS PERMISSIVE FOR SELECT TO public USING ((id IN ( SELECT recurring_group_members.group_id
   FROM recurring_group_members
  WHERE (recurring_group_members.user_id = auth.uid()))));
CREATE POLICY recurring_groups_update ON public.recurring_groups AS PERMISSIVE FOR UPDATE TO public USING ((owner_id = auth.uid()));
CREATE POLICY recurring_rounds_select ON public.recurring_rounds AS PERMISSIVE FOR SELECT TO public USING ((group_id IN ( SELECT recurring_group_members.group_id
   FROM recurring_group_members
  WHERE (recurring_group_members.user_id = auth.uid()))));
CREATE POLICY referral_rewards_select ON public.referral_rewards AS PERMISSIVE FOR SELECT TO public USING (((referrer_id = auth.uid()) OR (referred_id = auth.uid())));
CREATE POLICY rich_auntie_insert ON public.rich_auntie_sponsorships AS PERMISSIVE FOR INSERT TO public WITH CHECK (((user_id = auth.uid()) AND (fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid())))));
CREATE POLICY rich_auntie_select ON public.rich_auntie_sponsorships AS PERMISSIVE FOR SELECT TO public USING ((fund_id IN ( SELECT fund_members.fund_id
   FROM fund_members
  WHERE (fund_members.user_id = auth.uid()))));
CREATE POLICY scheduled_contributions_insert ON public.scheduled_contributions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY scheduled_contributions_select ON public.scheduled_contributions AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY scheduled_contributions_update ON public.scheduled_contributions AS PERMISSIVE FOR UPDATE TO public USING ((user_id = auth.uid()));
CREATE POLICY security_events_blocked ON public.security_events AS PERMISSIVE FOR SELECT TO public USING (false);
CREATE POLICY sms_logs_insert ON public.sms_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY sms_logs_select ON public.sms_logs AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY support_tickets_insert ON public.support_tickets AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY support_tickets_select ON public.support_tickets AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY system_announcements_select ON public.system_announcements AS PERMISSIVE FOR SELECT TO public USING (((starts_at <= now()) AND ((ends_at IS NULL) OR (ends_at >= now()))));
CREATE POLICY token_bundles_select ON public.token_bundles AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
CREATE POLICY token_products_select ON public.token_products AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
CREATE POLICY token_transactions_select ON public.token_transactions AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY dismissed_announcements_insert ON public.user_dismissed_announcements AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY dismissed_announcements_select ON public.user_dismissed_announcements AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY engagement_events_select ON public.user_engagement_events AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY user_entitlements_select ON public.user_entitlements AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY feature_flags_select ON public.user_feature_flags AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY user_free_tier_select ON public.user_free_tier AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY lifecycle_metrics_select ON public.user_lifecycle_metrics AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY user_referrals_select ON public.user_referrals AS PERMISSIVE FOR SELECT TO public USING (((referrer_id = auth.uid()) OR (referred_id = auth.uid())));
CREATE POLICY user_sessions_delete ON public.user_sessions AS PERMISSIVE FOR DELETE TO public USING ((user_id = auth.uid()));
CREATE POLICY user_sessions_select ON public.user_sessions AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY trusted_devices_delete ON public.user_trusted_devices AS PERMISSIVE FOR DELETE TO public USING ((user_id = auth.uid()));
CREATE POLICY trusted_devices_select ON public.user_trusted_devices AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY wealth_signals_select ON public.user_wealth_signals AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY users_select_own ON public.users AS PERMISSIVE FOR SELECT TO public USING ((id = auth.uid()));
CREATE POLICY users_update_own ON public.users AS PERMISSIVE FOR UPDATE TO public USING ((id = auth.uid()));
CREATE POLICY vendor_bookings_insert ON public.vendor_bookings AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY vendor_bookings_select ON public.vendor_bookings AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY vendors_select ON public.vendors AS PERMISSIVE FOR SELECT TO public USING ((is_verified = true));
CREATE POLICY verification_codes_blocked ON public.verification_codes AS PERMISSIVE FOR SELECT TO public USING (false);

-- ── triggers ──────────────────────────────────────────────
CREATE TRIGGER tr_contributions_receipt_number BEFORE UPDATE ON public.contributions FOR EACH ROW EXECUTE FUNCTION trigger_generate_receipt_number();
CREATE TRIGGER tr_contributions_updated_at BEFORE UPDATE ON public.contributions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notify_contribution_insert AFTER INSERT ON public.contributions FOR EACH ROW EXECUTE FUNCTION notify_contribution_insert();
CREATE TRIGGER trigger_calculate_fund_goal BEFORE INSERT OR UPDATE ON public.event_budgets FOR EACH ROW EXECUTE FUNCTION calculate_fund_goal();
CREATE TRIGGER trigger_set_event_code BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION set_event_code();
CREATE TRIGGER tr_expense_queries_update_count AFTER INSERT OR UPDATE ON public.expense_queries FOR EACH ROW EXECUTE FUNCTION trigger_update_expense_query_count();
CREATE TRIGGER tr_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notify_expense_insert AFTER INSERT ON public.expenses REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION notify_expense_insert();
CREATE TRIGGER tr_fund_allowances_updated_at BEFORE UPDATE ON public.fund_allowances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_fund_members_updated_at BEFORE UPDATE ON public.fund_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notify_fund_member_insert AFTER INSERT ON public.fund_members FOR EACH ROW EXECUTE FUNCTION notify_fund_member_insert();
CREATE TRIGGER trg_notify_fund_member_update AFTER UPDATE ON public.fund_members FOR EACH ROW EXECUTE FUNCTION notify_fund_member_update();
CREATE TRIGGER tr_funds_create_allowances AFTER INSERT ON public.funds FOR EACH ROW EXECUTE FUNCTION trigger_create_fund_allowances();
CREATE TRIGGER tr_funds_generate_code BEFORE INSERT ON public.funds FOR EACH ROW EXECUTE FUNCTION trigger_generate_fund_code();
CREATE TRIGGER tr_funds_updated_at BEFORE UPDATE ON public.funds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- The production push webhook is dashboard-managed. Never embed its shared
-- secret in a migration or database trigger definition.
CREATE TRIGGER tr_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_recurring_groups_updated_at BEFORE UPDATE ON public.recurring_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_support_tickets_number BEFORE INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION trigger_generate_ticket_number();
CREATE TRIGGER tr_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_token_transactions_update_balance AFTER INSERT ON public.token_transactions FOR EACH ROW EXECUTE FUNCTION trigger_update_token_balance();
CREATE TRIGGER tr_user_free_tier_updated_at BEFORE UPDATE ON public.user_free_tier FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_users_create_free_tier AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION trigger_create_user_free_tier();
CREATE TRIGGER tr_users_generate_referral BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION trigger_generate_referral_code();
CREATE TRIGGER tr_users_update_trust_level BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION trigger_update_trust_level();
CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── auth schema triggers ──────────────────────────────────────────────
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── comments ──────────────────────────────────────────────
COMMENT ON TABLE public.account_recovery_attempts IS 'Lost phone/account recovery tracking';
COMMENT ON TABLE public.api_keys IS 'V2: API keys for partner integrations';
COMMENT ON TABLE public.api_usage_logs IS 'V2: API usage tracking for billing';
COMMENT ON TABLE public.app_config IS 'Global app configuration - runtime settings';
COMMENT ON TABLE public.audit_log IS 'Complete activity trail - heart of transparency';
COMMENT ON TABLE public.blocked_users IS 'User-to-user blocking for safety';
COMMENT ON TABLE public.campaigns IS 'Marketing campaigns for attribution tracking';
COMMENT ON TABLE public.consent_log IS 'Consent audit trail for GDPR/POPIA compliance';
COMMENT ON TABLE public.contribution_edits IS 'Edit history for contributions';
COMMENT ON TABLE public.contribution_reminders IS 'Scheduled reminders for unpaid pledges';
COMMENT ON TABLE public.contributions IS 'All contributions to funds - money IN';
COMMENT ON TABLE public.countries IS 'Reference table for supported countries';
COMMENT ON TABLE public.country_waitlist IS 'Expansion interest tracking';
COMMENT ON TABLE public.data_export_requests IS 'GDPR/POPIA compliance - data export and deletion';
COMMENT ON TABLE public.disputes IS 'Formal disputes between users';
COMMENT ON TABLE public.event_budgets IS 'Event budget with fund goal percentage linking';
COMMENT ON TABLE public.event_fund_links IS 'Links between events and funds with audit trail';
COMMENT ON TABLE public.event_guests IS 'Guest list with RSVP status for events';
COMMENT ON TABLE public.event_organisers IS 'Planning committee members who manage the event';
COMMENT ON TABLE public.event_type_config IS 'Configuration for event types - icons, defaults, categories';
COMMENT ON TABLE public.events IS 'Events with guest lists, RSVP, and venue details';
COMMENT ON TABLE public.exchange_rates IS 'Currency exchange rates for diaspora contributions';
COMMENT ON TABLE public.expense_edits IS 'Edit history for expenses';
COMMENT ON TABLE public.expense_queries IS 'Member questions about expenses';
COMMENT ON TABLE public.expenses IS 'All expenses from funds - money OUT';
COMMENT ON TABLE public.failed_login_attempts IS 'Failed login tracking for brute force protection';
COMMENT ON TABLE public.fraud_signals IS 'Suspicious activity patterns for fraud detection';
COMMENT ON TABLE public.fund_allowances IS 'Per-fund free tier limits';
COMMENT ON TABLE public.fund_announcements IS 'Owner announcements to fund members';
COMMENT ON TABLE public.fund_benchmarks IS 'Aggregated fund data for AI insights';
COMMENT ON TABLE public.fund_exports IS 'Tracks report/PDF exports';
COMMENT ON TABLE public.fund_limits IS 'Maximum fund amounts by country and trust level';
COMMENT ON TABLE public.fund_members IS 'Fund membership records';
COMMENT ON TABLE public.fund_milestones IS 'Tracks fund achievement milestones';
COMMENT ON TABLE public.fund_ownership_history IS 'Complete history of fund ownership changes';
COMMENT ON TABLE public.fund_reports IS 'User reports of suspicious funds';
COMMENT ON TABLE public.fund_shares IS 'Tracks when and how funds are shared';
COMMENT ON TABLE public.fund_succession_requests IS 'Fund ownership transfer for death/incapacity';
COMMENT ON TABLE public.fund_succession_votes IS 'Member votes on succession requests';
COMMENT ON TABLE public.fund_templates IS 'Pre-built templates for quick fund creation';
COMMENT ON TABLE public.fund_type_config IS 'Configuration for fund types';
COMMENT ON TABLE public.funds IS 'Contribution funds for family events';
COMMENT ON TABLE public.high_value_fund_requests IS 'Manual approval for high-value funds';
COMMENT ON TABLE public.ip_blocklist IS 'Blocked IPs - known attackers, fraud networks';
COMMENT ON TABLE public.lead_qualification_data IS 'Lead scoring for insurance and partner referrals';
COMMENT ON TABLE public.login_notifications IS 'New login alerts for security';
COMMENT ON TABLE public.member_vouches IS 'Social proof - members vouch for organizer';
COMMENT ON TABLE public.mobile_money_verifications IS 'Verify user owns mobile money account';
COMMENT ON TABLE public.notification_templates IS 'Configurable notification text';
COMMENT ON TABLE public.notifications IS 'All notifications sent to users';
COMMENT ON TABLE public.offline_queue IS 'Stores actions for sync when user goes offline';
COMMENT ON TABLE public.organization_members IS 'Staff members of partner organizations';
COMMENT ON TABLE public.organization_payouts IS 'Commission payments to partner organizations';
COMMENT ON TABLE public.organizations IS 'B2B partners - funeral homes, churches, employers';
COMMENT ON TABLE public.partner_leads IS 'V2: Insurance and partner leads';
COMMENT ON TABLE public.payment_aggregators IS 'Payment provider configuration for multi-country support';
COMMENT ON TABLE public.payments IS 'Real money payments for token purchases';
COMMENT ON TABLE public.payouts IS 'V2: Outbound payments - commissions, refunds';
COMMENT ON TABLE public.promo_code_uses IS 'Tracks promo code redemptions';
COMMENT ON TABLE public.promo_codes IS 'Promotional codes for discounts and bonuses';
COMMENT ON TABLE public.recurring_group_members IS 'V2: Members of stokvel groups';
COMMENT ON TABLE public.recurring_groups IS 'V2: Stokvel/rotating savings groups';
COMMENT ON TABLE public.recurring_rounds IS 'V2: Payout rounds for stokvel groups';
COMMENT ON TABLE public.referral_rewards IS 'Referral program reward tracking';
COMMENT ON TABLE public.rich_auntie_sponsorships IS 'Tracks who sponsored specific expenses';
COMMENT ON TABLE public.scheduled_contributions IS 'V2: Recurring contribution schedules';
COMMENT ON TABLE public.security_events IS 'Security event tracking';
COMMENT ON TABLE public.sms_logs IS 'SMS Magic - parsed mobile money SMS';
COMMENT ON TABLE public.support_tickets IS 'Customer support tickets';
COMMENT ON TABLE public.system_announcements IS 'App-wide announcements';
COMMENT ON TABLE public.token_bundles IS 'Token packages available for purchase';
COMMENT ON TABLE public.token_products IS 'Features that cost tokens and rewards that earn tokens';
COMMENT ON TABLE public.token_transactions IS 'Complete token ledger';
COMMENT ON TABLE public.user_dismissed_announcements IS 'Tracks dismissed announcements per user';
COMMENT ON TABLE public.user_engagement_events IS 'User interaction tracking for retention analysis';
COMMENT ON TABLE public.user_entitlements IS 'Features user has access to';
COMMENT ON TABLE public.user_feature_flags IS 'Per-user feature toggles for gradual rollout';
COMMENT ON TABLE public.user_free_tier IS 'Per-user free tier tracking';
COMMENT ON TABLE public.user_lifecycle_metrics IS 'Pre-aggregated user metrics for retention';
COMMENT ON TABLE public.user_referrals IS 'Who referred who';
COMMENT ON TABLE public.user_sessions IS 'Logged-in devices with push tokens';
COMMENT ON TABLE public.user_trusted_devices IS 'Known devices for security';
COMMENT ON TABLE public.user_wealth_signals IS 'High-value user indicators for partner leads';
COMMENT ON TABLE public.users IS 'All Tshelo users';
COMMENT ON TABLE public.vendor_bookings IS 'V2: Marketplace bookings';
COMMENT ON TABLE public.vendors IS 'V2: Vendor directory for marketplace';
COMMENT ON TABLE public.verification_codes IS 'OTP codes for SMS verification';
