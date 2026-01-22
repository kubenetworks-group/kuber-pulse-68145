-- Create a secure view for agent_api_keys that never exposes the plaintext api_key
CREATE OR REPLACE VIEW public.agent_api_keys_secure AS
SELECT 
  id,
  user_id,
  cluster_id,
  name,
  api_key_prefix,
  is_active,
  last_seen,
  created_at,
  updated_at
  -- api_key and api_key_hash are intentionally excluded for security
FROM public.agent_api_keys;

-- Grant access to the view
GRANT SELECT ON public.agent_api_keys_secure TO authenticated;

-- Add comment explaining security purpose
COMMENT ON VIEW public.agent_api_keys_secure IS 'Secure view that exposes agent API keys metadata without the sensitive key material. Use this view for all frontend queries.';

-- Update RLS on profiles to add explicit column-level documentation
-- The existing policies are correct, but let's add a security comment
COMMENT ON COLUMN public.profiles.whatsapp_phone IS 'Sensitive field - protected by RLS, only visible to profile owner and admins';
COMMENT ON COLUMN public.profiles.whatsapp_verification_code IS 'Highly sensitive - temporary verification code, protected by RLS';

-- Add index for better query performance on secure view
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_user_cluster ON public.agent_api_keys(user_id, cluster_id);