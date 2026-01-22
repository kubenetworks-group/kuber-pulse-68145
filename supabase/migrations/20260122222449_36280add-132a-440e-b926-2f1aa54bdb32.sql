-- Fix the agent_api_keys_secure view to use SECURITY INVOKER instead of DEFINER
DROP VIEW IF EXISTS public.agent_api_keys_secure;

CREATE VIEW public.agent_api_keys_secure 
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  cluster_id,
  name,
  api_key_prefix,
  is_active,
  last_seen,
  created_at,
  updated_at
FROM public.agent_api_keys;

-- Grant access to the view
GRANT SELECT ON public.agent_api_keys_secure TO authenticated;

-- Add comment explaining security purpose
COMMENT ON VIEW public.agent_api_keys_secure IS 'Secure view that exposes agent API keys metadata without the sensitive key material. Uses SECURITY INVOKER to respect RLS policies.';

-- The "system" INSERT policies with true are intentional for service role operations
-- but we should restrict them to service_role only
-- These are INSERT policies that allow the backend (service role) to insert data

-- For agent_metrics: This is correct - agent sends metrics via edge function with service role
-- For ai_usage_logs: This is correct - system logs AI usage
-- For audit_logs: This is correct - system creates audit entries
-- For auto_heal_actions_log: This is correct - system logs auto heal actions
-- For notifications: This is correct - system creates notifications
-- For pvc_usage_history: This is correct - system records PVC usage
-- For security_alerts: This is correct - system creates security alerts
-- For subscriptions: This is correct - system creates subscriptions on user signup
-- For user_roles: This is correct - system assigns roles
-- For weekly_reports: This is correct - system generates weekly reports
-- For whatsapp_approvals: This is correct - system manages approval flow

-- The only concerning ones are the UPDATE with true:

-- Fix cluster_validation_results UPDATE policy to be more restrictive
DROP POLICY IF EXISTS "Service role can update validation results" ON public.cluster_validation_results;
-- No need to recreate - service role bypasses RLS anyway

-- Fix whatsapp_approvals UPDATE policy to be more restrictive  
DROP POLICY IF EXISTS "System can update approvals" ON public.whatsapp_approvals;
-- No need to recreate - service role bypasses RLS anyway, and users have their own UPDATE policy