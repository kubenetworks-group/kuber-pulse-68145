-- HTTP Attack Detection: índices em security_threats + tabela attack_reports

-- Índice composto para queries de ataques HTTP por cluster (is_attack=true)
CREATE INDEX IF NOT EXISTS idx_security_threats_attack_type
  ON public.security_threats(cluster_id, is_attack, threat_type, created_at DESC);

-- Índice para filtrar por fonte de detecção (agent_log_scan vs. outros)
CREATE INDEX IF NOT EXISTS idx_security_threats_detection_source
  ON public.security_threats(detection_source)
  WHERE detection_source IS NOT NULL;

-- Tabela para relatórios de ataque gerados por IA (via generate-attack-report)
-- Segue o mesmo padrão de weekly_reports e pod_restart_daily_reports
CREATE TABLE IF NOT EXISTS public.attack_reports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id       uuid        NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL,
  threat_id        uuid        REFERENCES public.security_threats(id) ON DELETE SET NULL,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  since_hours      integer     NOT NULL DEFAULT 24,
  statistics       jsonb       NOT NULL DEFAULT '{}',
  attack_timeline  jsonb       NOT NULL DEFAULT '[]',
  ai_report        text,
  token_usage      jsonb       DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attack_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attack reports"
  ON public.attack_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert attack reports"
  ON public.attack_reports FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_attack_reports_cluster_date
  ON public.attack_reports(cluster_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attack_reports_threat_id
  ON public.attack_reports(threat_id)
  WHERE threat_id IS NOT NULL;
