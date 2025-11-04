-- Add config_file column to clusters table for storing Kubernetes YAML configs
ALTER TABLE public.clusters 
ADD COLUMN config_file text;