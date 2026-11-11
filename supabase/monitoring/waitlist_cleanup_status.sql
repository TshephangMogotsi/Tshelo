-- Read-only external health check. No contacts or cron return_message fields.
SELECT jsonb_build_object(
  'checked_at',h.checked_at,
  'fresh',coalesce(h.checked_at >= now()-interval '30 minutes',false),
  'issues',coalesce(h.issues,ARRAY['monitor_state_missing']),
  'last_success_at',h.last_success_at,
  'expected_run_at',h.expected_run_at,
  'monitor_scheduled',EXISTS(SELECT 1 FROM cron.job WHERE jobname='tshelo-country-waitlist-monitor'
    AND active AND schedule='*/15 * * * *' AND command='SELECT public.monitor_country_waitlist_cleanup();'
    AND username='postgres' AND database=current_database()),
  'latest_monitor_run_status',(SELECT r.status FROM cron.job_run_details r JOIN cron.job j USING(jobid)
    WHERE j.jobname='tshelo-country-waitlist-monitor' ORDER BY r.start_time DESC,r.runid DESC LIMIT 1),
  'open_incidents',(SELECT count(*) FROM public.waitlist_cleanup_incidents WHERE resolved_at IS NULL)
) AS health FROM (SELECT true AS singleton) s LEFT JOIN public.waitlist_cleanup_health h USING(singleton);
