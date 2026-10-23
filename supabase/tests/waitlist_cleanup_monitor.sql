-- All cron history/configuration and simulated incidents are rolled back.
BEGIN;
SET LOCAL TIME ZONE 'Pacific/Auckland';
CREATE FUNCTION pg_temp.assert_monitor(ok boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Waitlist monitor regression: %',label; END IF;
END; $$;
DO $$
DECLARE job_id bigint; client_role text;
BEGIN
  PERFORM pg_temp.assert_monitor(current_setting('cron.log_run',true)='on','history enabled');
  SELECT jobid INTO job_id FROM cron.job WHERE jobname='tshelo-country-waitlist-cleanup';
  PERFORM pg_temp.assert_monitor(job_id IS NOT NULL,'cleanup scheduled');
  DELETE FROM public.waitlist_cleanup_incidents;
  DELETE FROM cron.job_run_details WHERE jobid=job_id;
  INSERT INTO cron.job_run_details(jobid,runid,status,start_time,end_time)
    VALUES(job_id,-16120001,'succeeded',now()-interval '2 minutes',now()-interval '2 minutes');
  PERFORM public.monitor_country_waitlist_cleanup();
  PERFORM pg_temp.assert_monitor((SELECT cardinality(issues)=0 FROM public.waitlist_cleanup_health),'healthy run');
  PERFORM pg_temp.assert_monitor((SELECT expected_run_at =
    (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + interval '2 hours 15 minutes'
     - CASE WHEN (now() AT TIME ZONE 'UTC')::time < time '02:45' THEN interval '1 day' ELSE interval '0' END)
    FROM public.waitlist_cleanup_health),'UTC deadline independent of session timezone');

  INSERT INTO cron.job_run_details(jobid,runid,status,start_time,end_time,return_message)
    VALUES(job_id,-16120002,'failed',now()-interval '1 minute',now()-interval '1 minute','SYNTHETIC PRIVATE ERROR MUST NOT BE COPIED');
  PERFORM public.monitor_country_waitlist_cleanup();
  PERFORM public.monitor_country_waitlist_cleanup();
  PERFORM pg_temp.assert_monitor((SELECT 'run_failed'=ANY(issues) FROM public.waitlist_cleanup_health),'failed run detected');
  PERFORM pg_temp.assert_monitor((SELECT count(*)=1 FROM public.waitlist_cleanup_incidents WHERE reason='run_failed' AND resolved_at IS NULL),'failure deduplicated');
  PERFORM pg_temp.assert_monitor(NOT EXISTS(SELECT 1 FROM public.waitlist_cleanup_incidents i WHERE to_jsonb(i)::text LIKE '%SYNTHETIC PRIVATE%'),'raw errors omitted');

  INSERT INTO cron.job_run_details(jobid,runid,status,start_time,end_time)
    VALUES(job_id,-16120003,'succeeded',now(),now());
  PERFORM public.monitor_country_waitlist_cleanup();
  PERFORM pg_temp.assert_monitor((SELECT cardinality(issues)=0 FROM public.waitlist_cleanup_health),'success recovers health');
  PERFORM pg_temp.assert_monitor((SELECT resolved_at IS NOT NULL FROM public.waitlist_cleanup_incidents WHERE cron_run_id=-16120002),'failed run retained as resolved');
  -- A failure followed by a retry before the monitor wakes must still be recorded.
  INSERT INTO cron.job_run_details(jobid,runid,status,start_time,end_time)
    VALUES(job_id,-16120004,'failed',now()-interval '30 seconds',now()-interval '30 seconds');
  PERFORM public.monitor_country_waitlist_cleanup();
  PERFORM pg_temp.assert_monitor((SELECT resolved_at IS NOT NULL FROM public.waitlist_cleanup_incidents WHERE cron_run_id=-16120004),'intervening failure preserved');

  PERFORM cron.alter_job(job_id,active:=false);
  PERFORM public.monitor_country_waitlist_cleanup();
  PERFORM pg_temp.assert_monitor((SELECT 'job_disabled'=ANY(issues) FROM public.waitlist_cleanup_health),'disabled job');
  PERFORM cron.alter_job(job_id,schedule:='0 0 * * *',active:=true);
  PERFORM public.monitor_country_waitlist_cleanup();
  PERFORM pg_temp.assert_monitor((SELECT 'job_configuration_changed'=ANY(issues) FROM public.waitlist_cleanup_health),'schedule drift');
  PERFORM cron.unschedule(job_id);
  PERFORM public.monitor_country_waitlist_cleanup();
  PERFORM pg_temp.assert_monitor((SELECT 'job_missing'=ANY(issues) FROM public.waitlist_cleanup_health),'missing job');
  job_id := cron.schedule('tshelo-country-waitlist-cleanup','15 2 * * *','SELECT public.purge_expired_country_waitlist();');
  DELETE FROM cron.job_run_details WHERE jobid=job_id;
  PERFORM public.monitor_country_waitlist_cleanup();
  PERFORM pg_temp.assert_monitor((SELECT 'run_overdue'=ANY(issues) FROM public.waitlist_cleanup_health),'missing successful run');
  FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    PERFORM pg_temp.assert_monitor(NOT has_function_privilege(client_role,'public.monitor_country_waitlist_cleanup()','EXECUTE'),'client cannot invoke monitor');
    PERFORM pg_temp.assert_monitor(NOT has_table_privilege(client_role,'public.waitlist_cleanup_health','SELECT,INSERT,UPDATE,DELETE'),'client health access denied');
    PERFORM pg_temp.assert_monitor(NOT has_table_privilege(client_role,'public.waitlist_cleanup_incidents','SELECT,INSERT,UPDATE,DELETE'),'client incident access denied');
  END LOOP;
  PERFORM pg_temp.assert_monitor(has_table_privilege('service_role','public.waitlist_cleanup_health','SELECT'),'backend health read');
  PERFORM pg_temp.assert_monitor(NOT has_table_privilege('service_role','public.waitlist_cleanup_health','INSERT,UPDATE,DELETE'),'no direct backend health writes');
END; $$;
ROLLBACK;
SELECT jsonb_build_object('result','PASS','fixtures_rolled_back',true,
  'checks',ARRAY['healthy','UTC deadline','failed','deduplicated','private errors omitted',
  'recovery','intervening failure','disabled','configuration drift','missing','overdue','history enabled','role boundaries']) AS evidence;
