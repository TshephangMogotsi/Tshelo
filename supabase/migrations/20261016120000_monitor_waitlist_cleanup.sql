-- Operator-only health state: no contacts, request bodies or cron error text.
CREATE TABLE public.waitlist_cleanup_health (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  checked_at timestamptz NOT NULL,
  expected_run_at timestamptz NOT NULL,
  last_success_at timestamptz,
  issues text[] NOT NULL
);
CREATE TABLE public.waitlist_cleanup_incidents (
  incident_key text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN
    ('job_missing','job_disabled','job_configuration_changed','cron_history_disabled','run_failed','run_overdue')),
  cron_run_id bigint,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.waitlist_cleanup_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_cleanup_incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_cleanup_health, public.waitlist_cleanup_incidents FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.waitlist_cleanup_health, public.waitlist_cleanup_incidents TO service_role;

CREATE FUNCTION public.monitor_country_waitlist_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  cleanup_job cron.job%ROWTYPE;
  latest_success timestamptz;
  due_at timestamptz;
  problem text;
  problems text[] := ARRAY[]::text[];
  failed_run record;
  incident_changed boolean;
BEGIN
  -- Serialize manual checks with the scheduled monitor.
  PERFORM pg_advisory_xact_lock(776219041);
  SELECT * INTO cleanup_job FROM cron.job WHERE jobname='tshelo-country-waitlist-cleanup';
  -- At 02:45 UTC today's 02:15 run must have completed. Before that,
  -- yesterday's run is the required successful execution.
  due_at := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + interval '2 hours 15 minutes';
  IF now() < due_at + interval '30 minutes' THEN due_at := due_at - interval '1 day'; END IF;

  IF cleanup_job.jobid IS NULL THEN
    problems := array_append(problems,'job_missing');
  ELSE
    IF NOT cleanup_job.active THEN problems := array_append(problems,'job_disabled'); END IF;
    IF cleanup_job.schedule <> '15 2 * * *'
      OR cleanup_job.command <> 'SELECT public.purge_expired_country_waitlist();'
      OR cleanup_job.username <> 'postgres' OR cleanup_job.database <> current_database()
    THEN problems := array_append(problems,'job_configuration_changed'); END IF;
    SELECT max(end_time) INTO latest_success FROM cron.job_run_details
      WHERE jobid=cleanup_job.jobid AND status='succeeded';
    IF latest_success IS NULL OR latest_success < due_at THEN
      problems := array_append(problems,'run_overdue');
    END IF;
    -- Preserve each failed run even if a later retry succeeds between checks.
    -- Only stable IDs/status/times are kept; return_message can contain PII.
    FOR failed_run IN SELECT runid,start_time FROM cron.job_run_details
      WHERE jobid=cleanup_job.jobid AND status='failed'
        AND start_time >= now()-interval '90 days'
    LOOP
      INSERT INTO public.waitlist_cleanup_incidents(incident_key,reason,cron_run_id,first_seen_at,last_seen_at,resolved_at)
      VALUES ('run_failed:'||failed_run.runid,'run_failed',failed_run.runid,now(),now(),
        CASE WHEN latest_success > failed_run.start_time THEN now() END)
      ON CONFLICT (incident_key) DO UPDATE SET last_seen_at=now(),
        resolved_at=coalesce(waitlist_cleanup_incidents.resolved_at,excluded.resolved_at)
      RETURNING (xmax=0) INTO incident_changed;
      IF incident_changed THEN
        RAISE WARNING 'TSHELO_WAITLIST_CLEANUP: run_failed (run_id=%)', failed_run.runid;
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM public.waitlist_cleanup_incidents WHERE reason='run_failed' AND resolved_at IS NULL) THEN
      problems := array_append(problems,'run_failed');
    END IF;
  END IF;
  IF current_setting('cron.log_run',true) IS DISTINCT FROM 'on' THEN
    problems := array_append(problems,'cron_history_disabled');
  END IF;

  FOREACH problem IN ARRAY problems LOOP
    IF problem='run_failed' THEN CONTINUE; END IF;
    INSERT INTO public.waitlist_cleanup_incidents(incident_key,reason,first_seen_at,last_seen_at,resolved_at)
      VALUES (problem,problem,now(),now(),NULL)
    ON CONFLICT (incident_key) DO UPDATE SET last_seen_at=now(),resolved_at=NULL,
      first_seen_at=CASE WHEN waitlist_cleanup_incidents.resolved_at IS NOT NULL THEN now() ELSE waitlist_cleanup_incidents.first_seen_at END
    RETURNING (xmax=0 OR first_seen_at=now()) INTO incident_changed;
    IF incident_changed THEN RAISE WARNING 'TSHELO_WAITLIST_CLEANUP: %', problem; END IF;
  END LOOP;
  UPDATE public.waitlist_cleanup_incidents SET resolved_at=now()
    WHERE resolved_at IS NULL AND reason <> 'run_failed' AND NOT (reason=ANY(problems));
  INSERT INTO public.waitlist_cleanup_health(singleton,checked_at,expected_run_at,last_success_at,issues)
    VALUES (true,now(),due_at,latest_success,problems)
    ON CONFLICT (singleton) DO UPDATE SET checked_at=excluded.checked_at,
      expected_run_at=excluded.expected_run_at,last_success_at=excluded.last_success_at,issues=excluded.issues;
  DELETE FROM public.waitlist_cleanup_incidents WHERE resolved_at < now()-interval '90 days';
END;
$$;
REVOKE ALL ON FUNCTION public.monitor_country_waitlist_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.monitor_country_waitlist_cleanup() TO service_role;
SELECT cron.schedule('tshelo-country-waitlist-monitor','*/15 * * * *',
  'SELECT public.monitor_country_waitlist_cleanup();');
SELECT public.monitor_country_waitlist_cleanup();
SELECT public.assert_application_table_security();
