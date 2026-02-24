
-- Alert Rules: user-defined alert conditions
CREATE TABLE public.alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL DEFAULT 'cpu_usage',
  condition TEXT NOT NULL DEFAULT 'greater_than',
  threshold NUMERIC NOT NULL DEFAULT 80,
  severity TEXT NOT NULL DEFAULT 'warning',
  target_type TEXT NOT NULL DEFAULT 'cluster',
  target_namespace TEXT,
  target_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  cooldown_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alert Instances: triggered alerts
CREATE TABLE public.alert_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  source TEXT NOT NULL DEFAULT 'custom',
  metric_value NUMERIC,
  status TEXT NOT NULL DEFAULT 'firing',
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook configs for alert notifications
CREATE TABLE public.webhook_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  webhook_type TEXT NOT NULL DEFAULT 'generic',
  headers JSONB DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  severity_filter TEXT[] DEFAULT '{critical,high,warning}'::text[],
  last_triggered_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own alert rules" ON public.alert_rules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can insert alert instances" ON public.alert_instances FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own alert instances" ON public.alert_instances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own alert instances" ON public.alert_instances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alert instances" ON public.alert_instances FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own webhook configs" ON public.webhook_configs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Enable realtime for alert instances
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_instances;
