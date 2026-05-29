-- ========== LGPD enhancements ==========
ALTER TABLE public.user_consents
  ADD COLUMN IF NOT EXISTS terms_version text NOT NULL DEFAULT 'v1.2',
  ADD COLUMN IF NOT EXISTS policy_version text NOT NULL DEFAULT 'v1.2';

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.user_consents     WHERE user_id = v_user_id;
  DELETE FROM public.notifications     WHERE user_id = v_user_id;
  DELETE FROM public.audit_logs        WHERE user_id = v_user_id;
  DELETE FROM public.agent_api_keys    WHERE user_id = v_user_id;
  DELETE FROM public.subscriptions     WHERE user_id = v_user_id;
  DELETE FROM public.usage_tracking    WHERE user_id = v_user_id;
  DELETE FROM public.clusters          WHERE user_id = v_user_id;
  DELETE FROM public.profiles          WHERE id = v_user_id;
  DELETE FROM auth.users               WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

COMMENT ON FUNCTION public.delete_user_account() IS
  'LGPD Art. 18: Allows an authenticated user to permanently delete their account and all associated data.';

-- ========== Cluster snapshots ==========
CREATE TABLE IF NOT EXISTS public.cluster_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  storage_path TEXT,
  storage_size_bytes BIGINT,
  manifest_count INTEGER,
  namespace_count INTEGER,
  resource_summary JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.cluster_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own snapshots" ON public.cluster_snapshots
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_cluster_snapshots_cluster_id ON public.cluster_snapshots(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_snapshots_user_id ON public.cluster_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_cluster_snapshots_status ON public.cluster_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_cluster_snapshots_created_at ON public.cluster_snapshots(created_at DESC);

-- ========== Cluster migrations ==========
CREATE TABLE IF NOT EXISTS public.cluster_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  target_cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES public.cluster_snapshots(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','analyzing','ready','transforming','applying','validating','completed','failed','rolled_back'
  )),
  ai_analysis JSONB,
  compatibility_score INTEGER CHECK (compatibility_score BETWEEN 0 AND 100),
  issues_found INTEGER DEFAULT 0,
  issues_auto_fixed INTEGER DEFAULT 0,
  original_manifest_path TEXT,
  transformed_manifest_path TEXT,
  transformation_log JSONB,
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  current_step TEXT,
  steps_log JSONB DEFAULT '[]'::JSONB,
  error_message TEXT,
  rollback_available BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.cluster_migrations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own migrations" ON public.cluster_migrations
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_cluster_migrations_user_id ON public.cluster_migrations(user_id);
CREATE INDEX IF NOT EXISTS idx_cluster_migrations_source_cluster ON public.cluster_migrations(source_cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_migrations_target_cluster ON public.cluster_migrations(target_cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_migrations_status ON public.cluster_migrations(status);
CREATE INDEX IF NOT EXISTS idx_cluster_migrations_created_at ON public.cluster_migrations(created_at DESC);

-- ========== Migration validations ==========
CREATE TABLE IF NOT EXISTS public.migration_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id UUID NOT NULL REFERENCES public.cluster_migrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL CHECK (validation_type IN (
    'pod_health','service_connectivity','pvc_binding','ingress_routing',
    'resource_count','configmap_secret','custom'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','passed','failed','skipped')),
  namespace TEXT,
  resource_name TEXT,
  expected JSONB,
  actual JSONB,
  detail TEXT,
  error_message TEXT,
  ran_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.migration_validations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own validations" ON public.migration_validations
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_migration_validations_migration_id ON public.migration_validations(migration_id);
CREATE INDEX IF NOT EXISTS idx_migration_validations_user_id ON public.migration_validations(user_id);
CREATE INDEX IF NOT EXISTS idx_migration_validations_status ON public.migration_validations(status);

-- ========== updated_at triggers ==========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_cluster_snapshots_updated_at ON public.cluster_snapshots;
CREATE TRIGGER set_cluster_snapshots_updated_at
  BEFORE UPDATE ON public.cluster_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_cluster_migrations_updated_at ON public.cluster_migrations;
CREATE TRIGGER set_cluster_migrations_updated_at
  BEFORE UPDATE ON public.cluster_migrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== Realtime ==========
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cluster_snapshots; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cluster_migrations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.migration_validations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ========== Storage bucket: cluster-backups ==========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cluster-backups', 'cluster-backups', false, 104857600,
  ARRAY['application/json','application/gzip','application/octet-stream','text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users access own backup files" ON storage.objects;
CREATE POLICY "Users access own backup files"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'cluster-backups'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'cluster-backups'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ========== agent_versions: ensure release_type and min_compatible_version columns ==========
ALTER TABLE public.agent_versions
  ADD COLUMN IF NOT EXISTS release_type text,
  ADD COLUMN IF NOT EXISTS min_compatible_version text;

CREATE UNIQUE INDEX IF NOT EXISTS agent_versions_version_key ON public.agent_versions(version);

-- ========== Insert agent v0.0.55 and v0.0.56 ==========
INSERT INTO public.agent_versions (version, release_notes, release_type, is_latest, is_required)
VALUES (
  'v0.0.55',
  E'Melhorias e correções:\n- Suporte a visualização de logs de containers (get_pod_logs)\n- Auto-update automático via métricas (clusters offline atualizam ao voltar online)\n- Detecção de restart do agente com histórico de causa e solução aplicada\n- Fix: agent-check-update agora lê versão do banco em vez de valor hardcoded',
  'patch', false, false
)
ON CONFLICT (version) DO NOTHING;

INSERT INTO public.agent_versions (version, release_notes, release_type, is_latest, is_required, min_compatible_version)
VALUES (
  'v0.0.56',
  'Corrige problema de agentes aparecendo como offline; auto-update agora detecta o namespace correto automaticamente; coleta logs de containers crashados para diagnóstico de IA',
  'minor', false, false, 'v0.0.50'
)
ON CONFLICT (version) DO NOTHING;