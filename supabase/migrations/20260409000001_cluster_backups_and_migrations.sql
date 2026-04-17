-- Migration: Cluster Backups & Zero-Downtime Migration Feature
-- Tables: cluster_snapshots, cluster_migrations, migration_validations

-- ============================================================
-- cluster_snapshots: stores K8s cluster backup metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cluster_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  storage_path TEXT,          -- path in cluster-backups bucket
  storage_size_bytes BIGINT,
  manifest_count INTEGER,
  namespace_count INTEGER,
  resource_summary JSONB,     -- { namespaces: [], resourceCounts: {}, storageClasses: [] }
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cluster_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own snapshots"
  ON public.cluster_snapshots
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_cluster_snapshots_cluster_id ON public.cluster_snapshots(cluster_id);
CREATE INDEX idx_cluster_snapshots_user_id ON public.cluster_snapshots(user_id);
CREATE INDEX idx_cluster_snapshots_status ON public.cluster_snapshots(status);
CREATE INDEX idx_cluster_snapshots_created_at ON public.cluster_snapshots(created_at DESC);

-- ============================================================
-- cluster_migrations: tracks zero-downtime migration jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cluster_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  target_cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES public.cluster_snapshots(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'analyzing', 'ready', 'transforming', 'applying', 'validating', 'completed', 'failed', 'rolled_back'
  )),
  -- AI analysis results
  ai_analysis JSONB,          -- full Gemini compatibility report
  compatibility_score INTEGER CHECK (compatibility_score BETWEEN 0 AND 100),
  issues_found INTEGER DEFAULT 0,
  issues_auto_fixed INTEGER DEFAULT 0,
  -- manifest transformation
  original_manifest_path TEXT,   -- storage path of original manifests
  transformed_manifest_path TEXT, -- storage path of transformed manifests
  transformation_log JSONB,       -- array of { resource, change, reason }
  -- progress tracking
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  current_step TEXT,
  steps_log JSONB DEFAULT '[]'::JSONB,  -- array of { step, status, timestamp, detail }
  -- error handling
  error_message TEXT,
  rollback_available BOOLEAN DEFAULT FALSE,
  -- timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cluster_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own migrations"
  ON public.cluster_migrations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_cluster_migrations_user_id ON public.cluster_migrations(user_id);
CREATE INDEX idx_cluster_migrations_source_cluster ON public.cluster_migrations(source_cluster_id);
CREATE INDEX idx_cluster_migrations_target_cluster ON public.cluster_migrations(target_cluster_id);
CREATE INDEX idx_cluster_migrations_status ON public.cluster_migrations(status);
CREATE INDEX idx_cluster_migrations_created_at ON public.cluster_migrations(created_at DESC);

-- ============================================================
-- migration_validations: post-migration integrity checks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.migration_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id UUID NOT NULL REFERENCES public.cluster_migrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL CHECK (validation_type IN (
    'pod_health', 'service_connectivity', 'pvc_binding', 'ingress_routing',
    'resource_count', 'configmap_secret', 'custom'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'passed', 'failed', 'skipped')),
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

CREATE POLICY "Users can manage their own validations"
  ON public.migration_validations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_migration_validations_migration_id ON public.migration_validations(migration_id);
CREATE INDEX idx_migration_validations_user_id ON public.migration_validations(user_id);
CREATE INDEX idx_migration_validations_status ON public.migration_validations(status);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_cluster_snapshots_updated_at
  BEFORE UPDATE ON public.cluster_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_cluster_migrations_updated_at
  BEFORE UPDATE ON public.cluster_migrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Realtime publications
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.cluster_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cluster_migrations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.migration_validations;

-- ============================================================
-- Storage bucket: cluster-backups (private, 100MB limit)
-- NOTE: Run this block manually in SQL editor if bucket already exists
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cluster-backups',
  'cluster-backups',
  false,
  104857600,  -- 100 MB
  ARRAY['application/json', 'application/gzip', 'application/octet-stream', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: users can only access their own paths (user_id/*)
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
