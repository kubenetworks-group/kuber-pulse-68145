-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create clusters table
CREATE TABLE public.clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('production', 'staging', 'development', 'on-premises')),
  provider TEXT NOT NULL CHECK (provider IN ('aws', 'gcp', 'azure', 'on-premises', 'digitalocean', 'other')),
  cluster_type TEXT NOT NULL CHECK (cluster_type IN ('kubernetes', 'docker', 'docker-swarm')),
  status TEXT NOT NULL DEFAULT 'connecting' CHECK (status IN ('healthy', 'warning', 'critical', 'connecting', 'disconnected')),
  api_endpoint TEXT NOT NULL,
  region TEXT,
  nodes INTEGER DEFAULT 0,
  pods INTEGER DEFAULT 0,
  cpu_usage NUMERIC(5,2) DEFAULT 0,
  memory_usage NUMERIC(5,2) DEFAULT 0,
  storage_used_gb NUMERIC(10,2) DEFAULT 0,
  monthly_cost NUMERIC(10,2) DEFAULT 0,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on clusters
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;

-- Clusters policies
CREATE POLICY "Users can view own clusters"
  ON public.clusters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own clusters"
  ON public.clusters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clusters"
  ON public.clusters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clusters"
  ON public.clusters FOR DELETE
  USING (auth.uid() = user_id);

-- Create cluster_events table
CREATE TABLE public.cluster_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('info', 'success', 'warning', 'error')),
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on cluster_events
ALTER TABLE public.cluster_events ENABLE ROW LEVEL SECURITY;

-- Cluster events policies
CREATE POLICY "Users can view own cluster events"
  ON public.cluster_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create cluster events"
  ON public.cluster_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create security_audits table
CREATE TABLE public.security_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on security_audits
ALTER TABLE public.security_audits ENABLE ROW LEVEL SECURITY;

-- Security audits policies
CREATE POLICY "Users can view own security audits"
  ON public.security_audits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create security audits"
  ON public.security_audits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own security audits"
  ON public.security_audits FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clusters_updated_at
  BEFORE UPDATE ON public.clusters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();