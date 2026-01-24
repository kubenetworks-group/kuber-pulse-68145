-- Create table for pod restart audit logs with container details
CREATE TABLE public.pod_restart_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL,
  user_id UUID NOT NULL,
  pod_name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  container_name TEXT,
  restart_reason TEXT NOT NULL,
  previous_state JSONB DEFAULT '{}'::jsonb,
  container_logs TEXT,
  container_logs_tail INTEGER DEFAULT 100,
  exit_code INTEGER,
  terminated_at TIMESTAMP WITH TIME ZONE,
  restart_count INTEGER DEFAULT 0,
  analysis_summary TEXT,
  command_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for daily restart reports
CREATE TABLE public.pod_restart_daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL,
  user_id UUID NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_restarts INTEGER DEFAULT 0,
  pods_affected INTEGER DEFAULT 0,
  namespaces_affected TEXT[] DEFAULT '{}',
  top_restart_reasons JSONB DEFAULT '[]'::jsonb,
  pods_summary JSONB DEFAULT '[]'::jsonb,
  ai_analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cluster_id, report_date)
);

-- Enable RLS
ALTER TABLE public.pod_restart_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_restart_daily_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for pod_restart_audit
CREATE POLICY "Users can view own pod restart audit" 
ON public.pod_restart_audit 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert pod restart audit" 
ON public.pod_restart_audit 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can delete own pod restart audit" 
ON public.pod_restart_audit 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for pod_restart_daily_reports
CREATE POLICY "Users can view own daily reports" 
ON public.pod_restart_daily_reports 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert daily reports" 
ON public.pod_restart_daily_reports 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update daily reports" 
ON public.pod_restart_daily_reports 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete own daily reports" 
ON public.pod_restart_daily_reports 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_pod_restart_audit_cluster ON public.pod_restart_audit(cluster_id, created_at DESC);
CREATE INDEX idx_pod_restart_audit_pod ON public.pod_restart_audit(cluster_id, namespace, pod_name);
CREATE INDEX idx_pod_restart_daily_reports_cluster ON public.pod_restart_daily_reports(cluster_id, report_date DESC);