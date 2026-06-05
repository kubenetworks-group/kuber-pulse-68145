-- Add allowed_namespaces to auto_heal_settings.
-- NULL = all non-system namespaces (default behaviour, backwards-compatible).
-- Non-null array = only these namespaces are monitored/acted upon.
ALTER TABLE public.auto_heal_settings
  ADD COLUMN IF NOT EXISTS allowed_namespaces TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.auto_heal_settings.allowed_namespaces IS
  'Namespaces the AI agent may monitor and act on. NULL = all user namespaces.';
