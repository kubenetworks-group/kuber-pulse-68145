-- Create ai_usage_logs table for tracking AI usage and costs
CREATE TABLE public.ai_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  model text NOT NULL,
  provider text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  is_free_tier boolean NOT NULL DEFAULT true,
  estimated_cost_usd numeric(10,6) DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_logs_provider ON public.ai_usage_logs(provider);
CREATE INDEX idx_ai_usage_logs_user_day ON public.ai_usage_logs(user_id, created_at);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own AI usage logs"
ON public.ai_usage_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert AI usage logs"
ON public.ai_usage_logs
FOR INSERT
WITH CHECK (true);

-- Function to get daily request count for a user
CREATE OR REPLACE FUNCTION public.get_user_daily_ai_requests(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO request_count
  FROM public.ai_usage_logs
  WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE
    AND provider = 'google';
  
  RETURN COALESCE(request_count, 0);
END;
$$;

-- Function to get monthly estimated cost for a user
CREATE OR REPLACE FUNCTION public.get_user_monthly_ai_cost(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_cost numeric;
BEGIN
  SELECT COALESCE(SUM(estimated_cost_usd), 0) INTO total_cost
  FROM public.ai_usage_logs
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('month', CURRENT_DATE)
    AND is_free_tier = false;
  
  RETURN total_cost;
END;
$$;