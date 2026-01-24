-- Add is_attack column to differentiate real attacks from configuration risks
ALTER TABLE public.security_threats 
ADD COLUMN IF NOT EXISTS is_attack boolean DEFAULT true;

-- Update existing threats based on threat_type only (since evidence column doesn't exist yet)
UPDATE public.security_threats 
SET is_attack = false 
WHERE threat_type IN ('privilege_escalation', 'unauthorized_access', 'port_scan', 'misconfiguration', 'compliance_violation', 'suspicious_process');

-- Add comment for documentation
COMMENT ON COLUMN public.security_threats.is_attack IS 'True for real attacks (malware, DDoS, crypto mining), false for configuration risks (privileged containers, host network, etc)';