-- Migration: Create PVC Usage History table for tracking storage usage over time
-- This enables AI analysis of usage patterns for rightsizing recommendations

-- Create table to store historical PVC usage data
CREATE TABLE public.pvc_usage_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
    pvc_name TEXT NOT NULL,
    namespace TEXT NOT NULL,
    used_bytes BIGINT NOT NULL DEFAULT 0,
    capacity_bytes BIGINT NOT NULL DEFAULT 0,
    requested_bytes BIGINT NOT NULL DEFAULT 0,
    usage_percentage NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE WHEN requested_bytes > 0
        THEN (used_bytes::NUMERIC / requested_bytes::NUMERIC * 100)
        ELSE 0 END
    ) STORED,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for filtering by cluster
CREATE INDEX idx_pvc_usage_history_cluster_id ON public.pvc_usage_history(cluster_id);

-- Index for analysis queries (cluster + pvc + time range)
CREATE INDEX idx_pvc_usage_history_analysis ON public.pvc_usage_history(cluster_id, pvc_name, namespace, collected_at DESC);

-- Index for cleanup queries
CREATE INDEX idx_pvc_usage_history_collected_at ON public.pvc_usage_history(collected_at);

-- Enable Row Level Security
ALTER TABLE public.pvc_usage_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view history of their own clusters
CREATE POLICY "Users can view own pvc_usage_history"
ON public.pvc_usage_history FOR SELECT TO authenticated
USING (
    cluster_id IN (SELECT id FROM public.clusters WHERE user_id = auth.uid())
);

-- Policy: Allow insert from service role (agent)
CREATE POLICY "Service role can insert pvc_usage_history"
ON public.pvc_usage_history FOR INSERT TO service_role
WITH CHECK (true);

-- Function to cleanup old history data (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_pvc_usage_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.pvc_usage_history
    WHERE collected_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
        RAISE NOTICE 'Cleaned up % old PVC usage history records', deleted_count;
    END IF;
END;
$$;

-- Grant execute permission on cleanup function
GRANT EXECUTE ON FUNCTION cleanup_old_pvc_usage_history() TO service_role;
