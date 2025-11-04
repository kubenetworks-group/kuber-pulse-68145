-- Create AI Incidents table for auto-healing system
CREATE TABLE public.ai_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES public.clusters(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('pod_crash', 'high_memory', 'high_cpu', 'disk_full', 'pod_restart_loop', 'deployment_stuck', 'certificate_expiring', 'slow_response')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  ai_analysis JSONB NOT NULL,
  auto_heal_action TEXT CHECK (auto_heal_action IN ('restart_pod', 'scale_up', 'scale_down', 'clear_cache', 'rollback_deployment', 'rotate_certificate', 'optimize_resources')),
  action_taken BOOLEAN DEFAULT false,
  action_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.ai_incidents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own incidents"
  ON public.ai_incidents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own incidents"
  ON public.ai_incidents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own incidents"
  ON public.ai_incidents FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_ai_incidents_cluster ON public.ai_incidents(cluster_id);
CREATE INDEX idx_ai_incidents_severity ON public.ai_incidents(severity);
CREATE INDEX idx_ai_incidents_resolved ON public.ai_incidents(resolved_at);
CREATE INDEX idx_ai_incidents_user ON public.ai_incidents(user_id);

-- Enable realtime
ALTER TABLE public.ai_incidents REPLICA IDENTITY FULL;