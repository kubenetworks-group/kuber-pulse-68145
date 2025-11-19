-- Create scan_history table to track cluster scans
CREATE TABLE IF NOT EXISTS public.scan_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  anomalies_found INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  anomalies_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own scan history"
  ON public.scan_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scan history"
  ON public.scan_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_scan_history_cluster_id ON public.scan_history(cluster_id);
CREATE INDEX idx_scan_history_user_id ON public.scan_history(user_id);
CREATE INDEX idx_scan_history_scan_date ON public.scan_history(scan_date DESC);