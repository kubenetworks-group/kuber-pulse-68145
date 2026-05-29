-- pvc_usage_history was created by 20251223202911 with a different schema.
-- This migration adds missing columns and indexes for the newer schema.
CREATE TABLE IF NOT EXISTS public.pvc_usage_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id uuid,
  used_bytes bigint NOT NULL DEFAULT 0,
  requested_bytes bigint NOT NULL DEFAULT 0,
  usage_percentage numeric(5,2),
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add columns that may be missing in older schema
ALTER TABLE public.pvc_usage_history ADD COLUMN IF NOT EXISTS pvc_id uuid REFERENCES public.pvcs(id) ON DELETE CASCADE;
ALTER TABLE public.pvc_usage_history ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.pvc_usage_history ADD COLUMN IF NOT EXISTS recorded_at timestamp with time zone DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_pvc_usage_history_pvc_id ON public.pvc_usage_history(pvc_id);
CREATE INDEX IF NOT EXISTS idx_pvc_usage_history_cluster_id ON public.pvc_usage_history(cluster_id);
CREATE INDEX IF NOT EXISTS idx_pvc_usage_history_recorded_at ON public.pvc_usage_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_pvc_usage_history_user_id ON public.pvc_usage_history(user_id);

ALTER TABLE public.pvc_usage_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own PVC usage history" ON public.pvc_usage_history
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "System can insert PVC usage history" ON public.pvc_usage_history
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own PVC usage history" ON public.pvc_usage_history
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
