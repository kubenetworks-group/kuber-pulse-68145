-- Table to store AI-generated Kubernetes YAML manifests
CREATE TABLE public.generated_yamls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cluster_id UUID NOT NULL,
  user_description TEXT NOT NULL,
  generated_yaml TEXT NOT NULL,
  explanation TEXT,
  components TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_yamls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated YAMLs"
ON public.generated_yamls FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated YAMLs"
ON public.generated_yamls FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated YAMLs"
ON public.generated_yamls FOR DELETE
USING (auth.uid() = user_id);

-- Index for fast history queries
CREATE INDEX idx_generated_yamls_user ON public.generated_yamls(user_id, created_at DESC);
CREATE INDEX idx_generated_yamls_cluster ON public.generated_yamls(cluster_id, created_at DESC);
