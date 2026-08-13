-- Paid tokens are commercial credit. Achievements award non-monetary trust
-- points instead, so engagement rewards can never inflate token liabilities.

ALTER TABLE public.reward_definitions
  ADD COLUMN trust_points_reward integer NOT NULL DEFAULT 0
  CHECK (trust_points_reward >= 0);

ALTER TABLE public.user_rewards
  ADD COLUMN trust_points_awarded integer NOT NULL DEFAULT 0
  CHECK (trust_points_awarded >= 0);

INSERT INTO public.reward_definitions (
  code, name, description, category, token_reward, trust_points_reward,
  threshold, progress_unit, icon_name, sort_order
) VALUES (
  'payment_identity_verified',
  'Payment Identity Verified',
  'Verified your registered mobile money identity.',
  'onboarding',
  0,
  5,
  1,
  'verification',
  'phone-portrait-outline',
  15
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  token_reward = 0,
  trust_points_reward = EXCLUDED.trust_points_reward,
  threshold = EXCLUDED.threshold,
  progress_unit = EXCLUDED.progress_unit,
  icon_name = EXCLUDED.icon_name,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

UPDATE public.reward_definitions
SET token_reward = 0,
    trust_points_reward = CASE code
      WHEN 'profile_ready' THEN 5
      WHEN 'payment_identity_verified' THEN 5
      WHEN 'first_contribution' THEN 5
      WHEN 'consistent_contributor' THEN 10
      WHEN 'community_pillar' THEN 15
      WHEN 'receipt_starter' THEN 5
      WHEN 'transparent_organiser' THEN 15
      WHEN 'first_fund_completed' THEN 10
      WHEN 'reliable_organiser' THEN 15
      WHEN 'goal_getter' THEN 10
      WHEN 'event_ready' THEN 5
      ELSE 0
    END,
    updated_at = now();

-- Preserve historical token credits, but give previously earned achievements
-- their trust-point value. No existing token balance is reduced.
UPDATE public.user_rewards AS earned
SET trust_points_awarded = definition.trust_points_reward
FROM public.reward_definitions AS definition
WHERE definition.code = earned.reward_code;

-- Retire the legacy catalogue rows that described engagement rewards as
-- negative-cost token products. They are not used by the current app.
UPDATE public.token_products
SET is_active = false
WHERE is_reward = true;

COMMENT ON COLUMN public.reward_definitions.token_reward IS
  'Deprecated. Achievements do not grant paid tokens; retained for schema compatibility.';
COMMENT ON COLUMN public.reward_definitions.trust_points_reward IS
  'Non-monetary trust points granted once when this achievement is earned.';
COMMENT ON COLUMN public.user_rewards.tokens_awarded IS
  'Historical paid-token grant. New achievement rows always store zero.';
COMMENT ON COLUMN public.user_rewards.trust_points_awarded IS
  'Immutable trust points granted when this achievement was earned.';

CREATE OR REPLACE FUNCTION public.get_user_trust_score(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score integer;
BEGIN
  SELECT greatest(
    0,
    least(
      100,
      coalesce((
        SELECT sum(reward.trust_points_awarded)::integer
        FROM public.user_rewards AS reward
        WHERE reward.user_id = profile.id
      ), 0)
      - coalesce(profile.funds_reported, 0) * 10
      - CASE WHEN coalesce(profile.is_flagged, false) THEN 20 ELSE 0 END
    )
  )
  INTO score
  FROM public.users AS profile
  WHERE profile.id = p_user_id;

  RETURN coalesce(score, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_trust_score(uuid)
  FROM PUBLIC, anon, authenticated;

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
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO definition
  FROM public.reward_definitions
  WHERE code = p_reward_code AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive reward: %', p_reward_code;
  END IF;

  INSERT INTO public.user_rewards (
    user_id,
    reward_code,
    source_type,
    source_id,
    tokens_awarded,
    trust_points_awarded
  ) VALUES (
    p_user_id,
    definition.code,
    p_source_type,
    p_source_id,
    0,
    definition.trust_points_reward
  )
  ON CONFLICT (user_id, reward_code) DO NOTHING
  RETURNING id INTO award_id;

  IF award_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.notifications (
    user_id, fund_id, type, title, body, data
  ) VALUES (
    p_user_id,
    CASE WHEN p_source_type = 'fund' THEN p_source_id ELSE NULL END,
    'reward_earned'::public.notification_type,
    'Achievement unlocked',
    definition.name || CASE
      WHEN definition.trust_points_reward > 0
        THEN ' · +' || definition.trust_points_reward || ' trust points'
      ELSE ''
    END,
    jsonb_build_object(
      'kind', 'reward_earned',
      'rewardId', award_id,
      'rewardCode', definition.code,
      'trustPoints', definition.trust_points_reward
    )
  ) RETURNING id INTO reward_notification_id;

  UPDATE public.user_rewards
  SET notification_id = reward_notification_id
  WHERE id = award_id;

  PERFORM public.refresh_user_trust(p_user_id);
  RETURN award_id;
END;
$$;

REVOKE ALL ON FUNCTION public.award_user_reward(uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.evaluate_user_rewards(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_is_ready boolean := false;
  payment_identity_is_verified boolean := false;
  contributed_funds integer := 0;
  receipts_added integer := 0;
  completed_funds integer := 0;
  reliable_funds integer := 0;
  qualifying_fund_id uuid;
  qualifying_event_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT coalesce(profile_completed, false), coalesce(mobile_money_verified, false)
  INTO profile_is_ready, payment_identity_is_verified
  FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF profile_is_ready THEN
    PERFORM public.award_user_reward(p_user_id, 'profile_ready', 'profile', p_user_id);
  END IF;
  IF payment_identity_is_verified THEN
    PERFORM public.award_user_reward(p_user_id, 'payment_identity_verified', 'profile', p_user_id);
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

REVOKE ALL ON FUNCTION public.evaluate_user_rewards(uuid)
  FROM PUBLIC, anon, authenticated;

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

  PERFORM public.evaluate_user_rewards(caller_id);
  PERFORM public.refresh_user_trust(caller_id);

  SELECT count(*)::integer INTO reward_count
  FROM public.user_rewards WHERE user_id = caller_id;
  RETURN reward_count;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_my_rewards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_my_rewards() TO authenticated;

DROP FUNCTION public.get_my_reward_progress();
CREATE FUNCTION public.get_my_reward_progress()
RETURNS TABLE (
  reward_code text,
  reward_name text,
  reward_description text,
  category text,
  trust_points_reward integer,
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
      coalesce((SELECT mobile_money_verified::integer FROM public.users u, caller c WHERE u.id = c.id), 0) AS payment_identity_verified,
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
    definition.code,
    definition.name,
    definition.description,
    definition.category,
    definition.trust_points_reward,
    definition.threshold,
    definition.progress_unit,
    definition.icon_name,
    CASE definition.code
      WHEN 'profile_ready' THEN metric.profile_ready
      WHEN 'payment_identity_verified' THEN metric.payment_identity_verified
      WHEN 'first_contribution' THEN least(metric.contributed_funds, 1)
      WHEN 'consistent_contributor' THEN least(metric.contributed_funds, definition.threshold)
      WHEN 'community_pillar' THEN least(metric.contributed_funds, definition.threshold)
      WHEN 'receipt_starter' THEN least(metric.receipts_added, definition.threshold)
      WHEN 'transparent_organiser' THEN metric.has_transparent_fund
      WHEN 'first_fund_completed' THEN least(metric.completed_funds, 1)
      WHEN 'reliable_organiser' THEN least(metric.reliable_funds, definition.threshold)
      WHEN 'goal_getter' THEN metric.has_goal_fund
      WHEN 'event_ready' THEN metric.has_ready_event
      ELSE 0
    END,
    earned.id IS NOT NULL,
    earned.earned_at
  FROM public.reward_definitions AS definition
  CROSS JOIN metrics AS metric
  LEFT JOIN public.user_rewards AS earned
    ON earned.reward_code = definition.code AND earned.user_id = auth.uid()
  WHERE definition.is_active = true
  ORDER BY definition.sort_order;
$$;

REVOKE ALL ON FUNCTION public.get_my_reward_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_reward_progress() TO authenticated;

DROP TRIGGER IF EXISTS rewards_profile_changed ON public.users;
CREATE TRIGGER rewards_profile_changed
  AFTER INSERT OR UPDATE OF profile_completed, mobile_money_verified ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.on_reward_profile_change();

CREATE OR REPLACE FUNCTION public.notify_token_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.amount <= 0 OR NEW.transaction_type <> 'purchase' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.user_id,
    'tokens_purchased'::public.notification_type,
    'Token purchase confirmed',
    NEW.amount || ' tokens were added to your Tshelo balance.',
    jsonb_build_object(
      'kind', 'tokens_purchased',
      'transactionId', NEW.id,
      'tokens', NEW.amount,
      'balance', NEW.balance_after
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_token_purchase()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_token_purchase ON public.token_transactions;
CREATE TRIGGER notify_token_purchase
  AFTER INSERT ON public.token_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_token_purchase();

-- Recalculate existing profiles from their earned trust points. Historical
-- paid-token balances and token transactions are deliberately left untouched.
UPDATE public.users AS profile
SET trust_score = public.get_user_trust_score(profile.id);
