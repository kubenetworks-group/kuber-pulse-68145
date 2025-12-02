-- Fix function search_path for get_cron_jobs_status
CREATE OR REPLACE FUNCTION public.get_cron_jobs_status()
 RETURNS TABLE(jobid bigint, jobname text, schedule text, active boolean, last_run_time timestamp with time zone, next_run_time timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobid,
    j.jobname,
    j.schedule,
    j.active,
    jr.start_time as last_run_time,
    CASE 
      WHEN j.schedule = '*/5 * * * *' THEN 
        DATE_TRUNC('minute', COALESCE(jr.start_time, NOW())) + 
        ((EXTRACT(MINUTE FROM NOW())::int / 5 + 1) * 5 || ' minutes')::INTERVAL
      WHEN j.schedule = '* * * * *' THEN 
        DATE_TRUNC('minute', NOW()) + '1 minute'::INTERVAL
      ELSE NULL
    END as next_run_time
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time
    FROM cron.job_run_details
    WHERE jobid = j.jobid
    ORDER BY start_time DESC
    LIMIT 1
  ) jr ON true
  ORDER BY j.jobid;
END;
$function$;

-- Move uuid-ossp extension from public to extensions schema (if it exists in public)
DO $$
BEGIN
  -- Check if extension exists in public and move it
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'uuid-ossp' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Extension might not exist or already in correct schema
    NULL;
END $$;