-- Add episode tracking to pod_restart_audit for deduplication
ALTER TABLE public.pod_restart_audit
  ADD COLUMN IF NOT EXISTS episode_key TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- UNIQUE index: prevents capturing the same restart episode twice
-- episode_key = "{namespace}/{pod_name}/{restart_count}"
CREATE UNIQUE INDEX IF NOT EXISTS idx_pod_restart_audit_episode
  ON public.pod_restart_audit(cluster_id, episode_key)
  WHERE episode_key IS NOT NULL;

-- Enable Realtime so UI auto-updates when analysis_summary is populated
ALTER TABLE public.pod_restart_audit REPLICA IDENTITY FULL;
