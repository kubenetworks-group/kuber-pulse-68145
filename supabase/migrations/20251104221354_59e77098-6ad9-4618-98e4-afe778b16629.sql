-- Tabela para armazenar API Keys dos agentes
CREATE TABLE IF NOT EXISTS public.agent_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar métricas recebidas dos agentes
CREATE TABLE IF NOT EXISTS public.agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- cpu, memory, pvc, events, pods, nodes
  metric_data JSONB NOT NULL,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar comandos a serem enviados para os agentes
CREATE TABLE IF NOT EXISTS public.agent_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  command_type TEXT NOT NULL, -- restart_pod, scale_deployment, clear_cache, etc
  command_params JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, completed, failed
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  executed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Tabela para armazenar detecção de anomalias pela IA
CREATE TABLE IF NOT EXISTS public.agent_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- low, medium, high, critical
  description TEXT NOT NULL,
  ai_analysis JSONB NOT NULL,
  recommendation TEXT,
  auto_heal_applied BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX idx_agent_metrics_cluster_type ON public.agent_metrics(cluster_id, metric_type);
CREATE INDEX idx_agent_metrics_collected_at ON public.agent_metrics(collected_at DESC);
CREATE INDEX idx_agent_commands_cluster_status ON public.agent_commands(cluster_id, status);
CREATE INDEX idx_agent_anomalies_cluster ON public.agent_anomalies(cluster_id, resolved);
CREATE INDEX idx_agent_api_keys_cluster ON public.agent_api_keys(cluster_id);

-- RLS Policies para agent_api_keys
ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent API keys"
  ON public.agent_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own agent API keys"
  ON public.agent_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agent API keys"
  ON public.agent_api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agent API keys"
  ON public.agent_api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para agent_metrics
ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view metrics from own clusters"
  ON public.agent_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clusters
      WHERE clusters.id = agent_metrics.cluster_id
      AND clusters.user_id = auth.uid()
    )
  );

-- Permitir inserção pública para agentes (validação por API key na edge function)
CREATE POLICY "Public can insert metrics"
  ON public.agent_metrics FOR INSERT
  WITH CHECK (true);

-- RLS Policies para agent_commands
ALTER TABLE public.agent_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own commands"
  ON public.agent_commands FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own commands"
  ON public.agent_commands FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own commands"
  ON public.agent_commands FOR UPDATE
  USING (auth.uid() = user_id);

-- Permitir leitura pública para agentes (validação por API key na edge function)
CREATE POLICY "Public can read pending commands"
  ON public.agent_commands FOR SELECT
  USING (status = 'pending');

-- RLS Policies para agent_anomalies
ALTER TABLE public.agent_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own anomalies"
  ON public.agent_anomalies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own anomalies"
  ON public.agent_anomalies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own anomalies"
  ON public.agent_anomalies FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_agent_api_keys_updated_at
  BEFORE UPDATE ON public.agent_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();