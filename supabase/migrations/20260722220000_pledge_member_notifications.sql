-- Pledges should be clearly distinguished from cash received. Preserve the
-- existing member-wide audience while using pledge-specific wording and data.

CREATE OR REPLACE FUNCTION public.notify_contribution_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fund_title text;
  fund_currency text;
  currency_symbol text;
  actor_id uuid;
  recipient_id uuid;
BEGIN
  SELECT title, currency_code
  INTO fund_title, fund_currency
  FROM public.funds
  WHERE id = NEW.fund_id;

  IF fund_title IS NULL THEN
    RETURN NEW;
  END IF;

  currency_symbol := CASE WHEN fund_currency = 'BWP' THEN 'P' ELSE fund_currency END;
  actor_id := coalesce(NEW.confirmed_by, NEW.tagged_by, NEW.user_id);

  IF NEW.status = 'pledged'::public.contribution_status THEN
    FOR recipient_id IN
      SELECT * FROM public.fund_member_user_ids(NEW.fund_id)
    LOOP
      IF recipient_id IS DISTINCT FROM actor_id THEN
        PERFORM public.create_notification(
          recipient_id,
          NEW.fund_id,
          'contribution_added',
          'New pledge',
          NEW.contributor_name || ' pledged '
            || currency_symbol || ' ' || to_char(NEW.amount, 'FM999,999,990.00')
            || ' to ' || fund_title,
          jsonb_build_object(
            'fundId', NEW.fund_id,
            'contributionId', NEW.id,
            'kind', 'pledge',
            'status', 'pledged'
          )
        );
      END IF;
    END LOOP;
  ELSE
    FOR recipient_id IN
      SELECT * FROM public.fund_member_user_ids(NEW.fund_id)
    LOOP
      IF recipient_id IS DISTINCT FROM actor_id THEN
        PERFORM public.create_notification(
          recipient_id,
          NEW.fund_id,
          'contribution_added',
          'Contribution recorded',
          currency_symbol || ' ' || to_char(NEW.amount, 'FM999,999,990.00')
            || ' from ' || NEW.contributor_name || ' · ' || fund_title,
          jsonb_build_object(
            'fundId', NEW.fund_id,
            'contributionId', NEW.id,
            'kind', 'contribution',
            'status', NEW.status
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_contribution_insert()
  FROM PUBLIC, anon, authenticated;
