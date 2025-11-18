-- Remove the insecure public insert policy for metrics
-- The agent-receive-metrics edge function uses SERVICE_ROLE_KEY which bypasses RLS
-- This prevents attackers from flooding the database with fake metrics

DROP POLICY IF EXISTS "Public can insert metrics" ON public.agent_metrics;

-- The edge function agent-receive-metrics authenticates agents via API keys
-- and uses SERVICE_ROLE_KEY to insert metrics, bypassing RLS securely
-- Users can still view metrics from their own clusters via the existing policy