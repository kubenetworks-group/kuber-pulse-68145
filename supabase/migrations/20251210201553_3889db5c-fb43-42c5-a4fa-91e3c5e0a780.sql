-- Create table for cluster security scans
CREATE TABLE public.cluster_security_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Security checks
  has_rbac BOOLEAN DEFAULT false,
  rbac_details JSONB,
  has_network_policies BOOLEAN DEFAULT false,
  network_policy_details JSONB,
  has_pod_security BOOLEAN DEFAULT false,
  pod_security_details JSONB,
  has_secrets_encryption BOOLEAN DEFAULT false,
  secrets_details JSONB,
  has_resource_limits BOOLEAN DEFAULT false,
  resource_limits_details JSONB,
  
  -- Overall
  security_score INTEGER DEFAULT 0,
  recommendations TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'warning', 'failed')),
  ai_analysis JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cluster_security_scans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own security scans" 
ON public.cluster_security_scans 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own security scans" 
ON public.cluster_security_scans 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own security scans" 
ON public.cluster_security_scans 
FOR DELETE 
USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_cluster_security_scans_cluster ON public.cluster_security_scans(cluster_id);
CREATE INDEX idx_cluster_security_scans_user ON public.cluster_security_scans(user_id);