-- Agent versions management table
CREATE TABLE IF NOT EXISTS public.agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  release_notes TEXT,
  release_type TEXT DEFAULT 'patch' CHECK (release_type IN ('major', 'minor', 'patch', 'hotfix')),
  is_latest BOOLEAN DEFAULT false,
  is_required BOOLEAN DEFAULT false, -- If true, forces update
  min_compatible_version TEXT, -- Minimum version that can communicate with backend
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Track which version each cluster is running
ALTER TABLE public.clusters
ADD COLUMN IF NOT EXISTS agent_version TEXT,
ADD COLUMN IF NOT EXISTS agent_last_seen_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS agent_update_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS agent_update_message TEXT;

-- Enable RLS
ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;

-- Everyone can read versions
CREATE POLICY "Anyone can view agent versions"
  ON public.agent_versions FOR SELECT
  USING (true);

-- Only admins can manage versions (via service role)
CREATE POLICY "Service role can manage agent versions"
  ON public.agent_versions FOR ALL
  USING (auth.role() = 'service_role');

-- Insert initial version
INSERT INTO public.agent_versions (version, release_notes, release_type, is_latest, is_required)
VALUES
  ('v0.0.50', 'Current stable version with metrics collection and auto-heal support', 'patch', false, false),
  ('v0.0.51', E'Bug fixes and improvements:\n- Fixed command type validation for auto-heal\n- Added support for self-update command\n- Improved error handling', 'patch', true, false)
ON CONFLICT (version) DO NOTHING;

-- Function to set latest version (ensures only one is latest)
CREATE OR REPLACE FUNCTION set_latest_agent_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_latest = true THEN
    UPDATE public.agent_versions SET is_latest = false WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_latest_version
  BEFORE INSERT OR UPDATE ON public.agent_versions
  FOR EACH ROW
  WHEN (NEW.is_latest = true)
  EXECUTE FUNCTION set_latest_agent_version();

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_agent_versions_latest ON public.agent_versions(is_latest) WHERE is_latest = true;
CREATE INDEX IF NOT EXISTS idx_clusters_agent_version ON public.clusters(agent_version);
