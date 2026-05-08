-- Add episode tracking to pod_restart_audit for deduplication
ALTER TABLE public.pod_restart_audit
  ADD COLUMN IF NOT EXISTS episode_key TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pod_restart_audit_episode
  ON public.pod_restart_audit(cluster_id, episode_key)
  WHERE episode_key IS NOT NULL;

ALTER TABLE public.pod_restart_audit REPLICA IDENTITY FULL;

-- Table to store AI-generated Kubernetes YAML manifests
CREATE TABLE IF NOT EXISTS public.generated_yamls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cluster_id UUID NOT NULL,
  user_description TEXT NOT NULL,
  generated_yaml TEXT NOT NULL,
  explanation TEXT,
  components TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_yamls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own generated YAMLs" ON public.generated_yamls;
CREATE POLICY "Users can view own generated YAMLs"
ON public.generated_yamls FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own generated YAMLs" ON public.generated_yamls;
CREATE POLICY "Users can insert own generated YAMLs"
ON public.generated_yamls FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own generated YAMLs" ON public.generated_yamls;
CREATE POLICY "Users can delete own generated YAMLs"
ON public.generated_yamls FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_generated_yamls_user ON public.generated_yamls(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_yamls_cluster ON public.generated_yamls(cluster_id, created_at DESC);