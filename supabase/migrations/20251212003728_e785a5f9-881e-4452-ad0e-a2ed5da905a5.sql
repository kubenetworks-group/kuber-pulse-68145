-- Add custom cluster limit field to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS custom_cluster_limit integer DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.subscriptions.custom_cluster_limit IS 'Custom cluster limit that overrides the plan default. NULL means use plan default.';