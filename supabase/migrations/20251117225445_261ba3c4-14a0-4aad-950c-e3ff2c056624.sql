-- Fase 1: Remover tabelas desnecessárias do MVP

-- Remover sistema de billing/trial/subscriptions
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS usage_tracking CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;

-- Remover storage detalhado
DROP TABLE IF EXISTS storage_recommendations CASCADE;

-- Remover security scanning
DROP TABLE IF EXISTS security_audits CASCADE;

-- Remover user roles (todos serão admins)
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TYPE IF EXISTS app_role CASCADE;

-- Remover enums não utilizados
DROP TYPE IF EXISTS plan_type CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;

-- Simplificar tabela organizations
ALTER TABLE organizations 
DROP COLUMN IF EXISTS cnpj,
DROP COLUMN IF EXISTS onboarding_completed;

-- Adicionar campos úteis para MVP de economia
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS total_savings NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_incidents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_heals_applied INTEGER DEFAULT 0;

-- Melhorar tabela clusters para suporte local
ALTER TABLE clusters
ADD COLUMN IF NOT EXISTS is_local BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'cloud' CHECK (connection_type IN ('cloud', 'local-exposed', 'local-direct')),
ADD COLUMN IF NOT EXISTS local_connection_instructions JSONB;

-- Atualizar cluster_type para incluir tipos locais
ALTER TABLE clusters 
DROP CONSTRAINT IF EXISTS clusters_cluster_type_check;

ALTER TABLE clusters
ADD CONSTRAINT clusters_cluster_type_check 
CHECK (cluster_type IN ('kubernetes', 'microk8s', 'minikube', 'k3s', 'docker'));

-- Remover functions relacionadas a roles
DROP FUNCTION IF EXISTS has_role(uuid, app_role);
DROP FUNCTION IF EXISTS get_user_roles(uuid);

-- Remover trigger de onboarding
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Criar nova função simples para criar organização
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organizations (user_id, company_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Minha Organização')
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recriar trigger simplificado
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atualizar RLS policies do profiles para remover referências a roles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Manter apenas políticas simples
-- (As outras políticas já existentes estão OK)