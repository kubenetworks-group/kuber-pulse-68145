-- Create function to get cron jobs status
CREATE OR REPLACE FUNCTION get_cron_jobs_status()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  last_run_time timestamptz,
  next_run_time timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobid,
    j.jobname,
    j.schedule,
    j.active,
    jr.start_time as last_run_time,
    -- Calculate next run time based on schedule
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_cron_jobs_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_cron_jobs_status() TO service_role;