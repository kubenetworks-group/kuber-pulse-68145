-- Create table for standalone PVs (Released, Available, Failed)
CREATE TABLE IF NOT EXISTS public.persistent_volumes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  capacity_bytes BIGINT NOT NULL DEFAULT 0,
  storage_class TEXT,
  reclaim_policy TEXT,
  access_modes TEXT[],
  volume_mode TEXT,
  claim_ref_namespace TEXT,
  claim_ref_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cluster_id, name)
);

-- Enable RLS
ALTER TABLE public.persistent_volumes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own PVs"
  ON public.persistent_volumes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own PVs"
  ON public.persistent_volumes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PVs"
  ON public.persistent_volumes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own PVs"
  ON public.persistent_volumes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_persistent_volumes_cluster_id ON public.persistent_volumes(cluster_id);
CREATE INDEX IF NOT EXISTS idx_persistent_volumes_status ON public.persistent_volumes(status);
