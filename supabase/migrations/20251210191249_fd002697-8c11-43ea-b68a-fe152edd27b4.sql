-- 1. Add INSERT policy for profiles table
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 2. Add api_key_hash column for secure storage
ALTER TABLE public.agent_api_keys 
ADD COLUMN IF NOT EXISTS api_key_hash TEXT,
ADD COLUMN IF NOT EXISTS api_key_prefix TEXT;

-- 3. Create function to hash API keys (for comparison)
CREATE OR REPLACE FUNCTION public.verify_api_key_hash(p_api_key TEXT, p_stored_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Using pgcrypto for hash comparison
  RETURN encode(digest(p_api_key, 'sha256'), 'hex') = p_stored_hash;
END;
$$;

-- 4. Add DELETE policies for tables that need it (optional, for user data control)
CREATE POLICY "Users can delete own agent anomalies"
ON public.agent_anomalies
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai incidents"
ON public.ai_incidents
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cluster events"
ON public.cluster_events
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);