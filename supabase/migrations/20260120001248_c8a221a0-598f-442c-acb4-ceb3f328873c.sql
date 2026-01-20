-- Create weekly reports table
CREATE TABLE public.weekly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Storage metrics
  total_storage_gb NUMERIC DEFAULT 0,
  storage_used_gb NUMERIC DEFAULT 0,
  storage_available_gb NUMERIC DEFAULT 0,
  
  -- Health metrics
  cluster_health_score INTEGER DEFAULT 100,
  cluster_status TEXT DEFAULT 'healthy',
  nodes_count INTEGER DEFAULT 0,
  pods_count INTEGER DEFAULT 0,
  pods_healthy INTEGER DEFAULT 0,
  pods_unhealthy INTEGER DEFAULT 0,
  
  -- Incidents summary
  total_incidents INTEGER DEFAULT 0,
  critical_incidents INTEGER DEFAULT 0,
  warning_incidents INTEGER DEFAULT 0,
  resolved_incidents INTEGER DEFAULT 0,
  
  -- Agent actions summary
  total_agent_actions INTEGER DEFAULT 0,
  auto_heals_applied INTEGER DEFAULT 0,
  pods_restarted INTEGER DEFAULT 0,
  resource_limits_applied INTEGER DEFAULT 0,
  
  -- Recommendations
  recommendations JSONB DEFAULT '[]'::jsonb,
  critical_issues JSONB DEFAULT '[]'::jsonb,
  
  -- AI analysis
  ai_summary TEXT,
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, cluster_id, week_start)
);

-- Enable RLS
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own weekly reports"
ON public.weekly_reports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert weekly reports"
ON public.weekly_reports FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own weekly reports"
ON public.weekly_reports FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_weekly_reports_user_cluster ON public.weekly_reports(user_id, cluster_id);
CREATE INDEX idx_weekly_reports_date ON public.weekly_reports(report_date DESC);
CREATE INDEX idx_weekly_reports_unread ON public.weekly_reports(user_id, is_read) WHERE is_read = FALSE;

-- Add trigger for updated_at
CREATE TRIGGER update_weekly_reports_updated_at
BEFORE UPDATE ON public.weekly_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();