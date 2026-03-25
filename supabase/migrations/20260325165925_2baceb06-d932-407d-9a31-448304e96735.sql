ALTER TABLE public.clusters ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE public.ai_incidents ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE public.cost_calculations ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE public.ai_cost_savings ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE public.pvcs ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;