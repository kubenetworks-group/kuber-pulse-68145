-- =============================================
-- SECURITY IMPLEMENTATION PLAN - PHASE 1
-- =============================================

-- 1. CLEAN UP PLAINTEXT API KEYS (CRITICAL)
-- Redact all existing plaintext API keys that have been migrated to hash
UPDATE public.agent_api_keys 
SET api_key = 'REDACTED_' || LEFT(api_key, 8)
WHERE api_key_hash IS NOT NULL 
AND api_key NOT LIKE 'REDACTED_%';

-- 2. CREATE AUDIT LOGS TABLE (HIGH PRIORITY)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
ON public.audit_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- System can insert audit logs (using service role)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- No one can update or delete audit logs (immutability)
-- No UPDATE or DELETE policies = logs are immutable

-- 3. ADD INSERT POLICY TO agent_metrics (MEDIUM)
CREATE POLICY "Service role can insert metrics"
ON public.agent_metrics
FOR INSERT
WITH CHECK (true);

-- 4. CREATE SECURITY ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text,
  details jsonb,
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON public.security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON public.security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_acknowledged ON public.security_alerts(acknowledged);

-- Enable RLS
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view their own alerts
CREATE POLICY "Users can view own security alerts"
ON public.security_alerts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can acknowledge their own alerts
CREATE POLICY "Users can update own security alerts"
ON public.security_alerts
FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert alerts
CREATE POLICY "System can insert security alerts"
ON public.security_alerts
FOR INSERT
WITH CHECK (true);

-- 5. CREATE FUNCTION TO LOG AUDIT EVENTS
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 6. CREATE FUNCTION TO CREATE SECURITY ALERT
CREATE OR REPLACE FUNCTION public.create_security_alert(
  p_user_id uuid,
  p_alert_type text,
  p_severity text,
  p_title text,
  p_description text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert_id uuid;
BEGIN
  INSERT INTO public.security_alerts (
    user_id,
    alert_type,
    severity,
    title,
    description,
    details
  ) VALUES (
    p_user_id,
    p_alert_type,
    p_severity,
    p_title,
    p_description,
    p_details
  )
  RETURNING id INTO v_alert_id;
  
  RETURN v_alert_id;
END;
$$;

-- 7. CREATE TRIGGER FOR LOGIN TRACKING (for security alerts)
-- This will be called from edge function to track suspicious logins