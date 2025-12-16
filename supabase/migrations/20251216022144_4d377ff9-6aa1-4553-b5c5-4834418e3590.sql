-- Create security_threats table
CREATE TABLE public.security_threats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  threat_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'active',
  title TEXT NOT NULL,
  description TEXT,
  affected_resources JSONB DEFAULT '[]'::jsonb,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  ai_recommendation TEXT,
  remediation_steps JSONB DEFAULT '[]'::jsonb,
  auto_remediated BOOLEAN DEFAULT false,
  remediated_at TIMESTAMP WITH TIME ZONE,
  remediation_result JSONB,
  detection_source TEXT DEFAULT 'manual',
  raw_data JSONB,
  false_positive BOOLEAN DEFAULT false,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create auto_heal_settings table
CREATE TABLE public.auto_heal_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  auto_apply_security BOOLEAN NOT NULL DEFAULT false,
  auto_apply_anomalies BOOLEAN NOT NULL DEFAULT false,
  severity_threshold TEXT NOT NULL DEFAULT 'high',
  scan_interval_minutes INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cluster_id)
);

-- Create auto_heal_actions_log table
CREATE TABLE public.auto_heal_actions_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  trigger_reason TEXT NOT NULL,
  trigger_entity_id UUID,
  trigger_entity_type TEXT,
  action_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.security_threats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_heal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_heal_actions_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for security_threats
CREATE POLICY "Users can view own security threats" ON public.security_threats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own security threats" ON public.security_threats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own security threats" ON public.security_threats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own security threats" ON public.security_threats
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for auto_heal_settings
CREATE POLICY "Users can view own auto heal settings" ON public.auto_heal_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own auto heal settings" ON public.auto_heal_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own auto heal settings" ON public.auto_heal_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own auto heal settings" ON public.auto_heal_settings
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for auto_heal_actions_log
CREATE POLICY "Users can view own auto heal actions" ON public.auto_heal_actions_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own auto heal actions" ON public.auto_heal_actions_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert auto heal actions" ON public.auto_heal_actions_log
  FOR INSERT WITH CHECK (true);

-- Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_threats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_heal_actions_log;

-- Create updated_at trigger for security_threats
CREATE TRIGGER update_security_threats_updated_at
  BEFORE UPDATE ON public.security_threats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for auto_heal_settings
CREATE TRIGGER update_auto_heal_settings_updated_at
  BEFORE UPDATE ON public.auto_heal_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();