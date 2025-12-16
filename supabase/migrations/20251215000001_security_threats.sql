-- =============================================
-- SECURITY THREATS DETECTION SYSTEM
-- Detecção de DDoS, Hackers, Anomalias em Containers
-- =============================================

-- 1. CREATE SECURITY THREATS TABLE
CREATE TABLE IF NOT EXISTS public.security_threats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,

  -- Threat Classification
  threat_type text NOT NULL, -- ddos, brute_force, port_scan, suspicious_process, crypto_mining, privilege_escalation, data_exfiltration, shell_injection, unauthorized_access
  severity text NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  status text NOT NULL DEFAULT 'active', -- active, investigating, mitigated, false_positive

  -- Threat Details
  title text NOT NULL,
  description text,

  -- Container/Pod Information
  container_name text,
  container_id text,
  pod_name text,
  namespace text,
  node_name text,

  -- Suspicious Activity Details
  suspicious_command text, -- Comando suspeito executado
  suspicious_process text, -- Processo suspeito
  source_ip text,
  destination_ip text,
  affected_port integer,
  connection_count integer, -- Para DDoS

  -- Network Activity
  network_activity jsonb, -- { inbound_connections, outbound_connections, bandwidth_usage }

  -- AI Analysis
  ai_analysis jsonb, -- { threat_score, confidence, indicators, recommendation, mitigation_steps }

  -- Evidence
  evidence jsonb, -- { logs, commands, network_traces }
  raw_data jsonb, -- Dados brutos coletados

  -- Resolution
  mitigated boolean DEFAULT false,
  mitigated_at timestamp with time zone,
  mitigation_action text,
  false_positive boolean DEFAULT false,

  -- Timestamps
  detected_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_threats_cluster_id ON public.security_threats(cluster_id);
CREATE INDEX IF NOT EXISTS idx_security_threats_user_id ON public.security_threats(user_id);
CREATE INDEX IF NOT EXISTS idx_security_threats_threat_type ON public.security_threats(threat_type);
CREATE INDEX IF NOT EXISTS idx_security_threats_severity ON public.security_threats(severity);
CREATE INDEX IF NOT EXISTS idx_security_threats_status ON public.security_threats(status);
CREATE INDEX IF NOT EXISTS idx_security_threats_detected_at ON public.security_threats(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_threats_container_name ON public.security_threats(container_name);
CREATE INDEX IF NOT EXISTS idx_security_threats_pod_name ON public.security_threats(pod_name);

-- Enable RLS
ALTER TABLE public.security_threats ENABLE ROW LEVEL SECURITY;

-- Users can view threats for their clusters
CREATE POLICY "Users can view own cluster threats"
ON public.security_threats
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own threats
CREATE POLICY "Users can update own cluster threats"
ON public.security_threats
FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert threats
CREATE POLICY "System can insert threats"
ON public.security_threats
FOR INSERT
WITH CHECK (true);

-- 2. CREATE SECURITY METRICS TABLE (for historical analysis)
CREATE TABLE IF NOT EXISTS public.security_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,

  -- Metric Type
  metric_type text NOT NULL, -- network_connections, process_activity, container_exec, resource_anomaly

  -- Metric Data
  metric_data jsonb NOT NULL,

  -- Source
  container_name text,
  pod_name text,
  namespace text,
  node_name text,

  -- Timestamps
  collected_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_security_metrics_cluster_id ON public.security_metrics(cluster_id);
CREATE INDEX IF NOT EXISTS idx_security_metrics_metric_type ON public.security_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_security_metrics_collected_at ON public.security_metrics(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_metrics_pod_name ON public.security_metrics(pod_name);

-- Enable RLS
ALTER TABLE public.security_metrics ENABLE ROW LEVEL SECURITY;

-- Service role can insert metrics
CREATE POLICY "Service role can insert security metrics"
ON public.security_metrics
FOR INSERT
WITH CHECK (true);

-- Users can view metrics for their clusters
CREATE POLICY "Users can view cluster security metrics"
ON public.security_metrics
FOR SELECT
USING (
  cluster_id IN (
    SELECT id FROM public.clusters WHERE user_id = auth.uid()
  )
);

-- 3. CREATE FUNCTION TO DETECT THREATS
CREATE OR REPLACE FUNCTION public.create_security_threat(
  p_cluster_id uuid,
  p_user_id uuid,
  p_threat_type text,
  p_severity text,
  p_title text,
  p_description text DEFAULT NULL,
  p_container_name text DEFAULT NULL,
  p_pod_name text DEFAULT NULL,
  p_namespace text DEFAULT NULL,
  p_node_name text DEFAULT NULL,
  p_suspicious_command text DEFAULT NULL,
  p_suspicious_process text DEFAULT NULL,
  p_source_ip text DEFAULT NULL,
  p_connection_count integer DEFAULT NULL,
  p_ai_analysis jsonb DEFAULT NULL,
  p_evidence jsonb DEFAULT NULL,
  p_raw_data jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threat_id uuid;
BEGIN
  INSERT INTO public.security_threats (
    cluster_id,
    user_id,
    threat_type,
    severity,
    title,
    description,
    container_name,
    pod_name,
    namespace,
    node_name,
    suspicious_command,
    suspicious_process,
    source_ip,
    connection_count,
    ai_analysis,
    evidence,
    raw_data
  ) VALUES (
    p_cluster_id,
    p_user_id,
    p_threat_type,
    p_severity,
    p_title,
    p_description,
    p_container_name,
    p_pod_name,
    p_namespace,
    p_node_name,
    p_suspicious_command,
    p_suspicious_process,
    p_source_ip,
    p_connection_count,
    p_ai_analysis,
    p_evidence,
    p_raw_data
  )
  RETURNING id INTO v_threat_id;

  -- Also create a notification for critical/high threats
  IF p_severity IN ('critical', 'high') THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      related_entity_type,
      related_entity_id
    ) VALUES (
      p_user_id,
      CASE p_severity
        WHEN 'critical' THEN '🚨 ALERTA CRÍTICO DE SEGURANÇA'
        ELSE '⚠️ Alerta de Segurança'
      END,
      p_title || ' - ' || COALESCE(p_description, 'Verifique o monitor de segurança para mais detalhes.'),
      'error',
      'security_threat',
      v_threat_id
    );
  END IF;

  RETURN v_threat_id;
END;
$$;

-- 4. CREATE FUNCTION TO GET ACTIVE THREATS COUNT
CREATE OR REPLACE FUNCTION public.get_active_threats_count(p_user_id uuid)
RETURNS TABLE (
  total_count bigint,
  critical_count bigint,
  high_count bigint,
  medium_count bigint,
  low_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_count,
    COUNT(*) FILTER (WHERE severity = 'critical')::bigint as critical_count,
    COUNT(*) FILTER (WHERE severity = 'high')::bigint as high_count,
    COUNT(*) FILTER (WHERE severity = 'medium')::bigint as medium_count,
    COUNT(*) FILTER (WHERE severity = 'low')::bigint as low_count
  FROM public.security_threats
  WHERE user_id = p_user_id
    AND status = 'active'
    AND mitigated = false;
END;
$$;

-- 5. ENABLE REALTIME FOR SECURITY THREATS
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_threats;
