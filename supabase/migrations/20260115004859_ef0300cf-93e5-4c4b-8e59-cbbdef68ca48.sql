-- Add agent version tracking columns to clusters table
ALTER TABLE public.clusters 
ADD COLUMN IF NOT EXISTS agent_version TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS agent_last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS agent_update_available BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agent_update_message TEXT DEFAULT NULL;

-- Create agent_versions table to track available versions
CREATE TABLE IF NOT EXISTS public.agent_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  release_notes TEXT,
  is_latest BOOLEAN DEFAULT FALSE,
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;

-- Allow reading versions publicly (agents need to check)
CREATE POLICY "Anyone can read agent versions" 
ON public.agent_versions 
FOR SELECT 
USING (true);

-- Only admins can modify versions
CREATE POLICY "Only admins can insert versions" 
ON public.agent_versions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Only admins can update versions" 
ON public.agent_versions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert current latest version
INSERT INTO public.agent_versions (version, release_notes, is_latest, is_required)
VALUES ('v0.0.50', 'Melhorias de performance e correções de bugs', true, false)
ON CONFLICT (version) DO UPDATE SET is_latest = true;

-- Ensure only one version is marked as latest
CREATE OR REPLACE FUNCTION public.ensure_single_latest_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_latest = true THEN
    UPDATE public.agent_versions 
    SET is_latest = false 
    WHERE id != NEW.id AND is_latest = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER ensure_single_latest_version_trigger
BEFORE INSERT OR UPDATE ON public.agent_versions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_latest_version();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clusters_agent_version ON public.clusters(agent_version);
CREATE INDEX IF NOT EXISTS idx_agent_versions_is_latest ON public.agent_versions(is_latest) WHERE is_latest = true;