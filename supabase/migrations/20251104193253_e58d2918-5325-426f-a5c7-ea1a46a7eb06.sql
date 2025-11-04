-- Add storage monitoring fields to clusters table
ALTER TABLE public.clusters 
ADD COLUMN IF NOT EXISTS storage_total_gb NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS storage_available_gb NUMERIC DEFAULT 0;

-- Create table for PVC tracking
CREATE TABLE IF NOT EXISTS public.pvcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  storage_class TEXT,
  requested_bytes BIGINT NOT NULL DEFAULT 0,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'bound',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (cluster_id, namespace, name)
);

-- Enable RLS
ALTER TABLE public.pvcs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pvcs
CREATE POLICY "Users can view own PVCs"
ON public.pvcs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own PVCs"
ON public.pvcs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PVCs"
ON public.pvcs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own PVCs"
ON public.pvcs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create table for storage optimization recommendations
CREATE TABLE IF NOT EXISTS public.storage_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pvc_id UUID NOT NULL REFERENCES public.pvcs(id) ON DELETE CASCADE,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  recommendation_type TEXT NOT NULL, -- 'resize_down', 'resize_up', 'underutilized', 'overutilized'
  current_size_gb NUMERIC NOT NULL,
  recommended_size_gb NUMERIC NOT NULL,
  potential_savings NUMERIC DEFAULT 0,
  usage_percentage NUMERIC NOT NULL,
  days_analyzed INTEGER DEFAULT 7,
  reasoning TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'applied', 'dismissed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  applied_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.storage_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for storage_recommendations
CREATE POLICY "Users can view own recommendations"
ON public.storage_recommendations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create recommendations"
ON public.storage_recommendations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendations"
ON public.storage_recommendations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_pvcs_cluster_id ON public.pvcs(cluster_id);
CREATE INDEX idx_pvcs_user_id ON public.pvcs(user_id);
CREATE INDEX idx_pvcs_storage_class ON public.pvcs(storage_class);
CREATE INDEX idx_storage_recommendations_pvc_id ON public.storage_recommendations(pvc_id);
CREATE INDEX idx_storage_recommendations_status ON public.storage_recommendations(status);

-- Add trigger for updated_at
CREATE TRIGGER update_pvcs_updated_at
BEFORE UPDATE ON public.pvcs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();