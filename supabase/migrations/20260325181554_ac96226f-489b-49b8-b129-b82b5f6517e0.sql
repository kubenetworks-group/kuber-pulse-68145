CREATE TABLE public.storage_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  pvc_id uuid NOT NULL REFERENCES public.pvcs(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL,
  current_size_gb numeric NOT NULL DEFAULT 0,
  recommended_size_gb numeric NOT NULL DEFAULT 0,
  potential_savings numeric NOT NULL DEFAULT 0,
  usage_percentage numeric NOT NULL DEFAULT 0,
  reasoning text,
  status text NOT NULL DEFAULT 'pending',
  days_analyzed integer NOT NULL DEFAULT 7,
  created_at timestamp with time zone DEFAULT now(),
  applied_at timestamp with time zone
);

ALTER TABLE public.storage_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own storage recommendations" ON public.storage_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own storage recommendations" ON public.storage_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own storage recommendations" ON public.storage_recommendations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own storage recommendations" ON public.storage_recommendations FOR DELETE USING (auth.uid() = user_id);