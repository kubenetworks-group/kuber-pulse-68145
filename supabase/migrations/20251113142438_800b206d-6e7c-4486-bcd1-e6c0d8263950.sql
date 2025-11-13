-- Create enum for subscription status
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');

-- Create enum for plan types
CREATE TYPE plan_type AS ENUM ('trial', 'starter', 'growth', 'enterprise');

-- Table: subscription_plans
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_brl NUMERIC NOT NULL DEFAULT 0,
  price_usd NUMERIC,
  currency TEXT NOT NULL DEFAULT 'BRL',
  price_id_brl TEXT,
  price_id_usd TEXT,
  features JSONB NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_type plan_type NOT NULL DEFAULT 'trial',
  status subscription_status NOT NULL DEFAULT 'trialing',
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Table: usage_tracking
CREATE TABLE public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  clusters_connected INTEGER NOT NULL DEFAULT 0,
  ai_analyses_used INTEGER NOT NULL DEFAULT 0,
  ai_actions_executed INTEGER NOT NULL DEFAULT 0,
  storage_analyzed_gb NUMERIC NOT NULL DEFAULT 0,
  reports_generated INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  amount_brl NUMERIC NOT NULL DEFAULT 0,
  amount_usd NUMERIC,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'draft',
  invoice_pdf_url TEXT,
  paid_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for usage_tracking
CREATE POLICY "Users can view own usage"
  ON public.usage_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE subscriptions.id = usage_tracking.subscription_id
      AND subscriptions.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert usage"
  ON public.usage_tracking FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update usage"
  ON public.usage_tracking FOR UPDATE
  USING (true);

-- RLS Policies for invoices
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update invoices"
  ON public.invoices FOR UPDATE
  USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at
  BEFORE UPDATE ON public.usage_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Populate subscription plans
INSERT INTO public.subscription_plans (slug, name, description, price_brl, features, limits) VALUES
('starter', 'Starter', 'Ideal para startups', 497.00, 
  '["1 cluster Kubernetes", "Análises IA ilimitadas", "Auto-healing básico", "Relatórios semanais", "Otimização de custos", "Suporte por email (48h)"]'::jsonb,
  '{"clusters": 1, "ai_analyses": -1, "reports": "weekly", "support": "email_48h"}'::jsonb
),
('growth', 'Growth', 'Para empresas em crescimento', 997.00,
  '["3 clusters Kubernetes", "Tudo do Starter", "Auto-healing avançado", "Relatórios diários", "Alertas customizados", "Acesso à API", "Suporte por email (24h)"]'::jsonb,
  '{"clusters": 3, "ai_analyses": -1, "reports": "daily", "alerts": true, "api_access": true, "support": "email_24h"}'::jsonb
),
('enterprise', 'Enterprise', 'Para grandes operações', 2997.00,
  '["Clusters ilimitados", "Tudo do Growth", "Relatórios em tempo real", "White-label", "SSO (Single Sign-On)", "SLA com uptime 99.9%", "Suporte telefônico (1h)", "Integrações customizadas"]'::jsonb,
  '{"clusters": -1, "ai_analyses": -1, "reports": "realtime", "white_label": true, "sso": true, "sla": "99.9", "support": "phone_1h", "custom_integrations": true}'::jsonb
);