-- KubeCost FinOps Integration: kubecost_allocations + colunas em clusters

-- Flags de status do KubeCost no cluster
ALTER TABLE public.clusters
  ADD COLUMN IF NOT EXISTS kubecost_installed bool    DEFAULT false,
  ADD COLUMN IF NOT EXISTS kubecost_url       text    DEFAULT NULL;

-- Alocação de custo real por workload coletada via KubeCost API
-- Granularidade: namespace | deployment | pod, por dia (window=1d)
CREATE TABLE IF NOT EXISTS public.kubecost_allocations (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id     uuid           NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id        uuid           NOT NULL,
  window_date    date           NOT NULL,
  aggregate_type text           NOT NULL CHECK (aggregate_type IN ('namespace', 'deployment', 'pod', 'summary')),
  resource_name  text           NOT NULL,
  namespace      text           DEFAULT NULL,
  deployment     text           DEFAULT NULL,
  cpu_cost       numeric(10,4)  DEFAULT 0,
  memory_cost    numeric(10,4)  DEFAULT 0,
  pv_cost        numeric(10,4)  DEFAULT 0,
  network_cost   numeric(10,4)  DEFAULT 0,
  total_cost     numeric(10,4)  DEFAULT 0,
  efficiency     numeric(5,2)   DEFAULT NULL,  -- 0-100%, NULL quando não disponível
  raw_data       jsonb          DEFAULT '{}',
  created_at     timestamptz    NOT NULL DEFAULT now(),

  UNIQUE(cluster_id, window_date, aggregate_type, resource_name, COALESCE(namespace, ''))
);

ALTER TABLE public.kubecost_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own kubecost allocations"
  ON public.kubecost_allocations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can upsert kubecost allocations"
  ON public.kubecost_allocations FOR ALL
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_kubecost_allocations_cluster_date
  ON public.kubecost_allocations(cluster_id, window_date DESC, aggregate_type);

CREATE INDEX IF NOT EXISTS idx_kubecost_allocations_namespace
  ON public.kubecost_allocations(cluster_id, namespace, window_date DESC)
  WHERE aggregate_type = 'namespace';

CREATE INDEX IF NOT EXISTS idx_kubecost_allocations_deployment
  ON public.kubecost_allocations(cluster_id, namespace, deployment, window_date DESC)
  WHERE aggregate_type = 'deployment';
