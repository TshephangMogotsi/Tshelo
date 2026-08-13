-- Tshelo Rewards: server-owned achievements, token incentives, progress,
-- notifications, and trust refreshes. Rich Auntie remains a separate,
-- organiser-awarded recognition and deliberately does not grant tokens.

CREATE TABLE public.reward_definitions (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('onboarding', 'contribution', 'organising', 'transparency', 'event')),
  token_reward integer NOT NULL DEFAULT 0 CHECK (token_reward >= 0),
  threshold integer NOT NULL DEFAULT 1 CHECK (threshold > 0),
  progress_unit text NOT NULL DEFAULT 'step',
  icon_name text NOT NULL DEFAULT 'trophy-outline',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reward_code text NOT NULL REFERENCES public.reward_definitions(code),
  source_type text,
  source_id uuid,
  tokens_awarded integer NOT NULL DEFAULT 0 CHECK (tokens_awarded >= 0),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  snackbar_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reward_code)
);

CREATE INDEX user_rewards_user_earned_idx
  ON public.user_rewards (user_id, earned_at DESC);
CREATE INDEX user_rewards_unseen_idx
  ON public.user_rewards (user_id, earned_at)
  WHERE snackbar_seen_at IS NULL;

COMMENT ON TABLE public.reward_definitions IS
  'Versioned catalogue of automatic Tshelo achievements and their one-time token incentives.';
COMMENT ON TABLE public.user_rewards IS
  'Immutable, server-awarded user achievements. The unique key makes awards idempotent.';

INSERT INTO public.reward_definitions
  (code, name, description, category, token_reward, threshold, progress_unit, icon_name, sort_order)
VALUES
  ('profile_ready', 'Profile Ready', 'Completed your Tshelo profile.', 'onboarding', 5, 1, 'profile', 'person-circle-outline', 10),
  ('first_contribution', 'First Contribution', 'Made your first confirmed contribution.', 'contribution', 3, 1, 'fund', 'sparkles-outline', 20),
  ('consistent_contributor', 'Consistent Contributor', 'Contributed to three different funds.', 'contribution', 10, 3, 'funds', 'repeat-outline', 30),
  ('community_pillar', 'Community Pillar', 'Supported ten different funds.', 'contribution', 20, 10, 'funds', 'people-outline', 40),
  ('receipt_starter', 'Receipt Starter', 'Added valid receipts to three expenses.', 'transparency', 5, 3, 'receipts', 'receipt-outline', 50),
  ('transparent_organiser', 'Transparent Organiser', 'Kept receipt coverage at 80% or more on a fund with at least five expenses.', 'transparency', 15, 1, 'transparent fund', 'shield-checkmark-outline', 60),
  ('first_fund_completed', 'First Fund Completed', 'Successfully closed your first fund.', 'organising', 10, 1, 'fund', 'checkmark-done-circle-outline', 70),
  ('reliable_organiser', 'Reliable Organiser', 'Closed three funds without unresolved disputes.', 'organising', 20, 3, 'funds', 'ribbon-outline', 80),
  ('goal_getter', 'Goal Getter', 'Led a fund that reached 100% of its target.', 'organising', 10, 1, 'fund', 'flag-outline', 90),
  ('event_ready', 'Event Ready', 'Completed an event date, time, venue, and initial guest list.', 'event', 5, 1, 'event', 'calendar-outline', 100)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  token_reward = EXCLUDED.token_reward,
  threshold = EXCLUDED.threshold,
  progress_unit = EXCLUDED.progress_unit,
  icon_name = EXCLUDED.icon_name,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

ALTER TABLE public.reward_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY reward_definitions_read_active
  ON public.reward_definitions FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY user_rewards_read_own
  ON public.user_rewards FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.reward_definitions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.user_rewards FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.reward_definitions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_rewards FROM authenticated;
GRANT SELECT ON TABLE public.reward_definitions, public.user_rewards TO authenticated;

CREATE OR REPLACE FUNCTION public.award_user_reward(
  p_user_id uuid,
  p_reward_code text,
  p_source_type text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  definition public.reward_definitions%ROWTYPE;
  award_id uuid;
  reward_notification_id uuid;
  current_balance integer;
  next_balance integer;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO definition
  FROM public.reward_definitions
  WHERE code = p_reward_code AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive reward: %', p_reward_code;
  END IF;

  INSERT INTO public.user_rewards (
    user_id, reward_code, source_type, source_id, tokens_awarded
  ) VALUES (
    p_user_id, definition.code, p_source_type, p_source_id, definition.token_reward
  )
  ON CONFLICT (user_id, reward_code) DO NOTHING
  RETURNING id INTO award_id;

  -- Another event already granted this one-time reward.
  IF award_id IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(token_balance, 0)
  INTO current_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward recipient profile is unavailable';
  END IF;

  IF definition.token_reward > 0 THEN
    next_balance := current_balance + definition.token_reward;
    INSERT INTO public.token_transactions (
      user_id, amount, transaction_type, product_code, description,
      fund_id, balance_after
    ) VALUES (
      p_user_id, definition.token_reward, 'reward', 'reward_' || definition.code,
      'Achievement: ' || definition.name,
      CASE WHEN p_source_type = 'fund' THEN p_source_id ELSE NULL END,
      next_balance
    );
  END IF;

  INSERT INTO public.notifications (
    user_id, fund_id, type, title, body, data
  ) VALUES (
    p_user_id,
    CASE WHEN p_source_type = 'fund' THEN p_source_id ELSE NULL END,
    'reward_earned'::public.notification_type,
    'Achievement unlocked',
    definition.name || CASE
      WHEN definition.token_reward > 0 THEN ' · +' || definition.token_reward || ' tokens'
      ELSE ''
    END,
    jsonb_build_object(
      'kind', 'reward_earned',
      'rewardId', award_id,
      'rewardCode', definition.code,
      'tokens', definition.token_reward
    )
  ) RETURNING id INTO reward_notification_id;

  UPDATE public.user_rewards
  SET notification_id = reward_notification_id
  WHERE id = award_id;

  RETURN award_id;
END;
$$;

REVOKE ALL ON FUNCTION public.award_user_reward(uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_user_trust(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  completed_count integer;
  calculated_score integer;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT count(*)::integer INTO completed_count
  FROM public.funds
  WHERE owner_id = p_user_id AND status = 'closed' AND deleted_at IS NULL;

  UPDATE public.users
  SET funds_completed = completed_count
  WHERE id = p_user_id;

  calculated_score := public.get_user_trust_score(p_user_id);
  UPDATE public.users
  SET trust_score = calculated_score
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_user_trust(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.evaluate_user_rewards(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_is_ready boolean := false;
  contributed_funds integer := 0;
  receipts_added integer := 0;
  completed_funds integer := 0;
  reliable_funds integer := 0;
  qualifying_fund_id uuid;
  qualifying_event_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT coalesce(profile_completed, false)
  INTO profile_is_ready
  FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF profile_is_ready THEN
    PERFORM public.award_user_reward(p_user_id, 'profile_ready', 'profile', p_user_id);
  END IF;

  SELECT count(DISTINCT fund_id)::integer
  INTO contributed_funds
  FROM public.contributions
  WHERE user_id = p_user_id
    AND status = 'confirmed'::public.contribution_status
    AND coalesce(is_refunded, false) = false;

  IF contributed_funds >= 1 THEN
    PERFORM public.award_user_reward(p_user_id, 'first_contribution', 'user', p_user_id);
  END IF;
  IF contributed_funds >= 3 THEN
    PERFORM public.award_user_reward(p_user_id, 'consistent_contributor', 'user', p_user_id);
  END IF;
  IF contributed_funds >= 10 THEN
    PERFORM public.award_user_reward(p_user_id, 'community_pillar', 'user', p_user_id);
  END IF;

  SELECT count(*)::integer
  INTO receipts_added
  FROM public.expenses
  WHERE added_by = p_user_id
    AND deleted_at IS NULL
    AND nullif(trim(receipt_url), '') IS NOT NULL;

  IF receipts_added >= 3 THEN
    PERFORM public.award_user_reward(p_user_id, 'receipt_starter', 'user', p_user_id);
  END IF;

  SELECT f.id INTO qualifying_fund_id
  FROM public.funds f
  JOIN public.expenses e ON e.fund_id = f.id
  WHERE f.owner_id = p_user_id
    AND f.deleted_at IS NULL
    AND e.deleted_at IS NULL
    AND coalesce(e.is_sponsored, false) = false
  GROUP BY f.id
  HAVING count(*) >= 5
     AND count(*) FILTER (WHERE nullif(trim(e.receipt_url), '') IS NOT NULL)::numeric / count(*) >= 0.8
  ORDER BY min(e.created_at)
  LIMIT 1;

  IF qualifying_fund_id IS NOT NULL THEN
    PERFORM public.award_user_reward(p_user_id, 'transparent_organiser', 'fund', qualifying_fund_id);
  END IF;

  SELECT count(*)::integer INTO completed_funds
  FROM public.funds
  WHERE owner_id = p_user_id AND status = 'closed' AND deleted_at IS NULL;

  IF completed_funds >= 1 THEN
    SELECT id INTO qualifying_fund_id FROM public.funds
    WHERE owner_id = p_user_id AND status = 'closed' AND deleted_at IS NULL
    ORDER BY closed_at NULLS LAST, created_at LIMIT 1;
    PERFORM public.award_user_reward(p_user_id, 'first_fund_completed', 'fund', qualifying_fund_id);
  END IF;

  SELECT count(*)::integer INTO reliable_funds
  FROM public.funds f
  WHERE f.owner_id = p_user_id
    AND f.status = 'closed'
    AND f.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.fund_id = f.id
        AND d.status IN ('open', 'pending', 'under_review', 'escalated')
    );

  IF reliable_funds >= 3 THEN
    PERFORM public.award_user_reward(p_user_id, 'reliable_organiser', 'user', p_user_id);
  END IF;

  SELECT f.id INTO qualifying_fund_id
  FROM public.funds f
  WHERE f.owner_id = p_user_id
    AND f.goal_amount > 0
    AND f.deleted_at IS NULL
    AND (
      SELECT coalesce(sum(c.amount), 0)
      FROM public.contributions c
      WHERE c.fund_id = f.id
        AND c.status = 'confirmed'::public.contribution_status
        AND coalesce(c.is_refunded, false) = false
    ) >= f.goal_amount
  ORDER BY f.created_at
  LIMIT 1;

  IF qualifying_fund_id IS NOT NULL THEN
    PERFORM public.award_user_reward(p_user_id, 'goal_getter', 'fund', qualifying_fund_id);
  END IF;

  SELECT e.id INTO qualifying_event_id
  FROM public.events e
  WHERE e.creator_id = p_user_id
    AND e.deleted_at IS NULL
    AND e.event_date IS NOT NULL
    AND e.event_time IS NOT NULL
    AND length(trim(coalesce(e.venue_name, ''))) >= 3
    AND EXISTS (SELECT 1 FROM public.event_guests g WHERE g.event_id = e.id)
  ORDER BY e.created_at
  LIMIT 1;

  IF qualifying_event_id IS NOT NULL THEN
    PERFORM public.award_user_reward(p_user_id, 'event_ready', 'event', qualifying_event_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_user_rewards(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.evaluate_my_rewards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  reward_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  PERFORM public.refresh_user_trust(caller_id);
  PERFORM public.evaluate_user_rewards(caller_id);

  SELECT count(*)::integer INTO reward_count
  FROM public.user_rewards WHERE user_id = caller_id;
  RETURN reward_count;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_my_rewards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_my_rewards() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_reward_snackbar_seen(p_reward_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  UPDATE public.user_rewards
  SET snackbar_seen_at = coalesce(snackbar_seen_at, now())
  WHERE id = p_reward_id AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_reward_snackbar_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_reward_snackbar_seen(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_reward_progress()
RETURNS TABLE (
  reward_code text,
  reward_name text,
  reward_description text,
  category text,
  token_reward integer,
  threshold integer,
  progress_unit text,
  icon_name text,
  current_progress integer,
  is_earned boolean,
  earned_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT auth.uid() AS id
  ), metrics AS (
    SELECT
      coalesce((SELECT profile_completed::integer FROM public.users u, caller c WHERE u.id = c.id), 0) AS profile_ready,
      (SELECT count(DISTINCT co.fund_id)::integer FROM public.contributions co, caller c
       WHERE co.user_id = c.id AND co.status = 'confirmed'::public.contribution_status
         AND coalesce(co.is_refunded, false) = false) AS contributed_funds,
      (SELECT count(*)::integer FROM public.expenses e, caller c
       WHERE e.added_by = c.id AND e.deleted_at IS NULL
         AND nullif(trim(e.receipt_url), '') IS NOT NULL) AS receipts_added,
      (SELECT count(*)::integer FROM public.funds f, caller c
       WHERE f.owner_id = c.id AND f.status = 'closed' AND f.deleted_at IS NULL) AS completed_funds,
      (SELECT count(*)::integer FROM public.funds f, caller c
       WHERE f.owner_id = c.id AND f.status = 'closed' AND f.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM public.disputes d WHERE d.fund_id = f.id
           AND d.status IN ('open', 'pending', 'under_review', 'escalated'))) AS reliable_funds,
      (SELECT EXISTS (
        SELECT 1 FROM public.funds f JOIN public.expenses e ON e.fund_id = f.id, caller c
        WHERE f.owner_id = c.id AND f.deleted_at IS NULL AND e.deleted_at IS NULL
          AND coalesce(e.is_sponsored, false) = false
        GROUP BY f.id HAVING count(*) >= 5
          AND count(*) FILTER (WHERE nullif(trim(e.receipt_url), '') IS NOT NULL)::numeric / count(*) >= 0.8
      )::integer) AS has_transparent_fund,
      (SELECT EXISTS (
        SELECT 1 FROM public.funds f, caller c WHERE f.owner_id = c.id
          AND f.goal_amount > 0 AND f.deleted_at IS NULL
          AND (SELECT coalesce(sum(co.amount), 0) FROM public.contributions co
               WHERE co.fund_id = f.id AND co.status = 'confirmed'::public.contribution_status
                 AND coalesce(co.is_refunded, false) = false) >= f.goal_amount
      )::integer) AS has_goal_fund,
      (SELECT EXISTS (
        SELECT 1 FROM public.events e, caller c WHERE e.creator_id = c.id
          AND e.deleted_at IS NULL AND e.event_time IS NOT NULL
          AND length(trim(coalesce(e.venue_name, ''))) >= 3
          AND EXISTS (SELECT 1 FROM public.event_guests g WHERE g.event_id = e.id)
      )::integer) AS has_ready_event
  )
  SELECT
    d.code,
    d.name,
    d.description,
    d.category,
    d.token_reward,
    d.threshold,
    d.progress_unit,
    d.icon_name,
    CASE d.code
      WHEN 'profile_ready' THEN m.profile_ready
      WHEN 'first_contribution' THEN least(m.contributed_funds, 1)
      WHEN 'consistent_contributor' THEN least(m.contributed_funds, d.threshold)
      WHEN 'community_pillar' THEN least(m.contributed_funds, d.threshold)
      WHEN 'receipt_starter' THEN least(m.receipts_added, d.threshold)
      WHEN 'transparent_organiser' THEN m.has_transparent_fund
      WHEN 'first_fund_completed' THEN least(m.completed_funds, 1)
      WHEN 'reliable_organiser' THEN least(m.reliable_funds, d.threshold)
      WHEN 'goal_getter' THEN m.has_goal_fund
      WHEN 'event_ready' THEN m.has_ready_event
      ELSE 0
    END,
    ur.id IS NOT NULL,
    ur.earned_at
  FROM public.reward_definitions d
  CROSS JOIN metrics m
  LEFT JOIN public.user_rewards ur
    ON ur.reward_code = d.code AND ur.user_id = auth.uid()
  WHERE d.is_active = true
  ORDER BY d.sort_order;
$$;

REVOKE ALL ON FUNCTION public.get_my_reward_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_reward_progress() TO authenticated;

CREATE OR REPLACE FUNCTION public.on_reward_profile_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.evaluate_user_rewards(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_reward_contribution_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fund_owner uuid;
BEGIN
  IF NEW.status = 'confirmed'::public.contribution_status
     AND coalesce(NEW.is_refunded, false) = false THEN
    PERFORM public.evaluate_user_rewards(NEW.user_id);
    SELECT owner_id INTO fund_owner FROM public.funds WHERE id = NEW.fund_id;
    PERFORM public.evaluate_user_rewards(fund_owner);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_reward_expense_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fund_owner uuid;
BEGIN
  PERFORM public.evaluate_user_rewards(NEW.added_by);
  SELECT owner_id INTO fund_owner FROM public.funds WHERE id = NEW.fund_id;
  PERFORM public.refresh_user_trust(fund_owner);
  IF fund_owner IS DISTINCT FROM NEW.added_by THEN
    PERFORM public.evaluate_user_rewards(fund_owner);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_reward_fund_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.refresh_user_trust(NEW.owner_id);
  PERFORM public.evaluate_user_rewards(NEW.owner_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_reward_event_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.evaluate_user_rewards(NEW.creator_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_reward_guest_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE event_creator uuid;
BEGIN
  SELECT creator_id INTO event_creator FROM public.events WHERE id = NEW.event_id;
  PERFORM public.evaluate_user_rewards(event_creator);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_trust_level_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.trust_level IS DISTINCT FROM OLD.trust_level THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.id,
      'trust_level_changed'::public.notification_type,
      'Trust level updated',
      'Your trust level is now ' || initcap(NEW.trust_level::text) || '.',
      jsonb_build_object(
        'kind', 'trust_level_changed',
        'trustLevel', NEW.trust_level::text,
        'trustScore', NEW.trust_score
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rewards_profile_changed ON public.users;
CREATE TRIGGER rewards_profile_changed
  AFTER INSERT OR UPDATE OF profile_completed ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.on_reward_profile_change();

DROP TRIGGER IF EXISTS rewards_contribution_changed ON public.contributions;
CREATE TRIGGER rewards_contribution_changed
  AFTER INSERT OR UPDATE OF status, is_refunded, user_id ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.on_reward_contribution_change();

DROP TRIGGER IF EXISTS rewards_expense_changed ON public.expenses;
CREATE TRIGGER rewards_expense_changed
  AFTER INSERT OR UPDATE OF receipt_url, deleted_at ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.on_reward_expense_change();

DROP TRIGGER IF EXISTS rewards_fund_changed ON public.funds;
CREATE TRIGGER rewards_fund_changed
  AFTER UPDATE OF status, closed_at, goal_amount, deleted_at ON public.funds
  FOR EACH ROW EXECUTE FUNCTION public.on_reward_fund_change();

DROP TRIGGER IF EXISTS rewards_event_changed ON public.events;
CREATE TRIGGER rewards_event_changed
  AFTER UPDATE OF event_date, event_time, venue_name, deleted_at ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.on_reward_event_change();

DROP TRIGGER IF EXISTS rewards_guest_changed ON public.event_guests;
CREATE TRIGGER rewards_guest_changed
  AFTER INSERT OR UPDATE OF event_id ON public.event_guests
  FOR EACH ROW EXECUTE FUNCTION public.on_reward_guest_change();

DROP TRIGGER IF EXISTS rewards_trust_level_changed ON public.users;
CREATE TRIGGER rewards_trust_level_changed
  AFTER UPDATE OF trust_level ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_trust_level_change();

REVOKE ALL ON FUNCTION public.on_reward_profile_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_reward_contribution_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_reward_expense_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_reward_fund_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_reward_event_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_reward_guest_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_trust_level_change() FROM PUBLIC, anon, authenticated;

-- Let the signed-in app receive newly earned rewards immediately. The RLS
-- policy still restricts rows to the recipient.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'user_rewards'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_rewards;
  END IF;
END;
$$;
