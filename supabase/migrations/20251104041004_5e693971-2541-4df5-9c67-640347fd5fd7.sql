-- Add 'magalu' to the allowed cloud providers in the clusters table
ALTER TABLE public.clusters DROP CONSTRAINT IF EXISTS clusters_provider_check;

ALTER TABLE public.clusters ADD CONSTRAINT clusters_provider_check 
CHECK (provider IN ('aws', 'gcp', 'azure', 'digitalocean', 'magalu', 'on-premises', 'other'));