-- Developer platform v2: Helm charts + Dockerfiles + cluster deploy
ALTER TABLE public.generated_yamls
  ADD COLUMN IF NOT EXISTS generate_type text NOT NULL DEFAULT 'yaml',
  ADD COLUMN IF NOT EXISTS raw_data     jsonb         DEFAULT '{}';

-- Index for filtering by generation type in history panel
CREATE INDEX IF NOT EXISTS generated_yamls_type_idx
  ON public.generated_yamls (user_id, generate_type, created_at DESC);
