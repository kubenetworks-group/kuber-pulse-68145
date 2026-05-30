-- Agent logs table for admin support visibility
CREATE TABLE IF NOT EXISTS public.agent_logs (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
    pod_name TEXT NOT NULL DEFAULT '',
    pod_namespace TEXT NOT NULL DEFAULT 'kodo',
    pod_phase TEXT NOT NULL DEFAULT 'Unknown',
    container_name TEXT NOT NULL DEFAULT 'agent',
    container_state TEXT NOT NULL DEFAULT 'unknown',
    container_restart_count INTEGER NOT NULL DEFAULT 0,
    log_lines TEXT NOT NULL DEFAULT '',
    collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agent_logs_cluster_collected
    ON public.agent_logs(cluster_id, collected_at DESC);

-- Add agent pod columns to clusters for quick status display
ALTER TABLE public.clusters
    ADD COLUMN IF NOT EXISTS agent_pod_name TEXT,
    ADD COLUMN IF NOT EXISTS agent_pod_namespace TEXT DEFAULT 'kodo',
    ADD COLUMN IF NOT EXISTS agent_pod_phase TEXT,
    ADD COLUMN IF NOT EXISTS agent_container_restart_count INTEGER DEFAULT 0;
