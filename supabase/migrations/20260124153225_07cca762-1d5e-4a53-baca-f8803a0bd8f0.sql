-- Create table for LoadBalancer traffic monitoring
CREATE TABLE public.loadbalancer_traffic_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  external_ip TEXT NOT NULL,
  source_ip TEXT,
  request_path TEXT,
  request_method TEXT,
  status_code INTEGER,
  user_agent TEXT,
  is_suspicious BOOLEAN DEFAULT false,
  threat_level TEXT DEFAULT 'none' CHECK (threat_level IN ('none', 'low', 'medium', 'high', 'critical')),
  threat_reason TEXT,
  request_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_lb_traffic_cluster_ip ON public.loadbalancer_traffic_logs(cluster_id, external_ip);
CREATE INDEX idx_lb_traffic_suspicious ON public.loadbalancer_traffic_logs(cluster_id, is_suspicious) WHERE is_suspicious = true;
CREATE INDEX idx_lb_traffic_timestamp ON public.loadbalancer_traffic_logs(request_timestamp DESC);

-- Enable RLS
ALTER TABLE public.loadbalancer_traffic_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own traffic logs"
  ON public.loadbalancer_traffic_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert traffic logs"
  ON public.loadbalancer_traffic_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete own traffic logs"
  ON public.loadbalancer_traffic_logs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create table for LoadBalancer service summary
CREATE TABLE public.loadbalancer_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  external_ip TEXT NOT NULL,
  ports JSONB DEFAULT '[]',
  total_requests INTEGER DEFAULT 0,
  suspicious_requests INTEGER DEFAULT 0,
  last_suspicious_at TIMESTAMP WITH TIME ZONE,
  has_network_policy BOOLEAN DEFAULT false,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cluster_id, service_name, namespace)
);

-- Create index for lookups
CREATE INDEX idx_lb_services_cluster ON public.loadbalancer_services(cluster_id);
CREATE INDEX idx_lb_services_suspicious ON public.loadbalancer_services(cluster_id, suspicious_requests) WHERE suspicious_requests > 0;

-- Enable RLS
ALTER TABLE public.loadbalancer_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own LB services"
  ON public.loadbalancer_services
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert LB services"
  ON public.loadbalancer_services
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update LB services"
  ON public.loadbalancer_services
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete own LB services"
  ON public.loadbalancer_services
  FOR DELETE
  USING (auth.uid() = user_id);