-- Create pvc_usage_history table for tracking PVC usage over time
CREATE TABLE public.pvc_usage_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pvc_id uuid NOT NULL REFERENCES public.pvcs(id) ON DELETE CASCADE,
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  used_bytes bigint NOT NULL DEFAULT 0,
  requested_bytes bigint NOT NULL DEFAULT 0,
  usage_percentage numeric(5,2) NOT NULL DEFAULT 0,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_pvc_usage_history_pvc_id ON public.pvc_usage_history(pvc_id);
CREATE INDEX idx_pvc_usage_history_cluster_id ON public.pvc_usage_history(cluster_id);
CREATE INDEX idx_pvc_usage_history_recorded_at ON public.pvc_usage_history(recorded_at DESC);
CREATE INDEX idx_pvc_usage_history_user_id ON public.pvc_usage_history(user_id);

-- Enable RLS
ALTER TABLE public.pvc_usage_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own PVC usage history"
ON public.pvc_usage_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert PVC usage history"
ON public.pvc_usage_history
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete own PVC usage history"
ON public.pvc_usage_history
FOR DELETE
USING (auth.uid() = user_id);

-- Function to cleanup old usage history (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_pvc_usage_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pvc_usage_history
  WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$;