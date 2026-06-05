-- Ensure clusters.status constraint includes all required values.
-- Idempotent: safe to run even if 20251117233643 was already applied.
ALTER TABLE public.clusters
  DROP CONSTRAINT IF EXISTS clusters_status_check;

ALTER TABLE public.clusters
  ADD CONSTRAINT clusters_status_check
  CHECK (status IN ('connecting', 'healthy', 'warning', 'error', 'pending_agent'));
