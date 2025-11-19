-- Add skip_ssl_verify column to clusters table
ALTER TABLE public.clusters
ADD COLUMN IF NOT EXISTS skip_ssl_verify boolean DEFAULT false;

COMMENT ON COLUMN public.clusters.skip_ssl_verify IS 'Whether to skip SSL certificate verification for this cluster (useful for self-signed certificates)';