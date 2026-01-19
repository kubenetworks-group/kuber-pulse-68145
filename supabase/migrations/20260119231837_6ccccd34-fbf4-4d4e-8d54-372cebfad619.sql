-- Create admin_cluster_alerts table for admin-to-cluster notifications
CREATE TABLE public.admin_cluster_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES public.clusters(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'info',
  action_type TEXT,
  action_params JSONB,
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_cluster_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view alerts for their own clusters
CREATE POLICY "Users can view their cluster alerts"
ON public.admin_cluster_alerts
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can dismiss their own alerts
CREATE POLICY "Users can dismiss their alerts"
ON public.admin_cluster_alerts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage all alerts"
ON public.admin_cluster_alerts
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Add index for performance
CREATE INDEX idx_admin_cluster_alerts_cluster ON public.admin_cluster_alerts(cluster_id);
CREATE INDEX idx_admin_cluster_alerts_user ON public.admin_cluster_alerts(user_id);
CREATE INDEX idx_admin_cluster_alerts_dismissed ON public.admin_cluster_alerts(dismissed) WHERE dismissed = false;