-- Create organizations table for company information
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  cnpj TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own organization"
  ON public.organizations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own organization"
  ON public.organizations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own organization"
  ON public.organizations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create cluster_validation_results table to store AI analysis
CREATE TABLE IF NOT EXISTS public.cluster_validation_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  has_storage BOOLEAN NOT NULL DEFAULT false,
  has_monitoring BOOLEAN NOT NULL DEFAULT false,
  has_ingress BOOLEAN NOT NULL DEFAULT false,
  available_features JSONB,
  recommendations TEXT,
  validation_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for validation results
ALTER TABLE public.cluster_validation_results ENABLE ROW LEVEL SECURITY;

-- Create policies for validation results
CREATE POLICY "Users can view validation results for their clusters"
  ON public.cluster_validation_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clusters
      WHERE clusters.id = cluster_validation_results.cluster_id
      AND clusters.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert validation results"
  ON public.cluster_validation_results
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update validation results"
  ON public.cluster_validation_results
  FOR UPDATE
  USING (true);