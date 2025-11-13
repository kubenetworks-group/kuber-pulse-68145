--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'dev',
    'sre',
    'gestor',
    'finops'
);


--
-- Name: get_user_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_roles(_user_id uuid) RETURNS SETOF public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.organizations (user_id, name, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'My Organization'),
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: agent_anomalies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_anomalies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    user_id uuid NOT NULL,
    anomaly_type text NOT NULL,
    severity text NOT NULL,
    description text NOT NULL,
    ai_analysis jsonb NOT NULL,
    recommendation text,
    auto_heal_applied boolean DEFAULT false,
    resolved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);


--
-- Name: agent_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    cluster_id uuid NOT NULL,
    api_key text NOT NULL,
    name text NOT NULL,
    last_seen timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_commands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    user_id uuid NOT NULL,
    command_type text NOT NULL,
    command_params jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    result jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    executed_at timestamp with time zone,
    completed_at timestamp with time zone
);


--
-- Name: agent_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    metric_type text NOT NULL,
    metric_data jsonb NOT NULL,
    collected_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_cost_savings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_cost_savings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    incident_id uuid NOT NULL,
    cluster_id uuid NOT NULL,
    downtime_avoided_minutes integer DEFAULT 0 NOT NULL,
    cost_per_minute numeric(10,4) DEFAULT 0 NOT NULL,
    estimated_savings numeric(10,2) DEFAULT 0 NOT NULL,
    saving_type text NOT NULL,
    calculation_details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_saving_type CHECK ((saving_type = ANY (ARRAY['downtime_prevention'::text, 'resource_optimization'::text, 'scale_optimization'::text])))
);


--
-- Name: ai_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    user_id uuid NOT NULL,
    incident_type text NOT NULL,
    severity text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    ai_analysis jsonb NOT NULL,
    auto_heal_action text,
    action_taken boolean DEFAULT false,
    action_result jsonb,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    CONSTRAINT ai_incidents_auto_heal_action_check CHECK ((auto_heal_action = ANY (ARRAY['restart_pod'::text, 'scale_up'::text, 'scale_down'::text, 'clear_cache'::text, 'rollback_deployment'::text, 'rotate_certificate'::text, 'optimize_resources'::text]))),
    CONSTRAINT ai_incidents_incident_type_check CHECK ((incident_type = ANY (ARRAY['pod_crash'::text, 'high_memory'::text, 'high_cpu'::text, 'disk_full'::text, 'pod_restart_loop'::text, 'deployment_stuck'::text, 'certificate_expiring'::text, 'slow_response'::text]))),
    CONSTRAINT ai_incidents_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);

ALTER TABLE ONLY public.ai_incidents REPLICA IDENTITY FULL;


--
-- Name: cluster_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cluster_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    cluster_id uuid NOT NULL,
    user_id uuid NOT NULL,
    event_type text NOT NULL,
    message text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cluster_events_event_type_check CHECK ((event_type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text])))
);

ALTER TABLE ONLY public.cluster_events REPLICA IDENTITY FULL;


--
-- Name: cluster_validation_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cluster_validation_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    has_storage boolean DEFAULT false NOT NULL,
    has_monitoring boolean DEFAULT false NOT NULL,
    has_ingress boolean DEFAULT false NOT NULL,
    available_features jsonb,
    recommendations text,
    validation_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clusters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clusters (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    environment text NOT NULL,
    provider text NOT NULL,
    cluster_type text NOT NULL,
    status text DEFAULT 'connecting'::text NOT NULL,
    api_endpoint text NOT NULL,
    region text,
    nodes integer DEFAULT 0,
    pods integer DEFAULT 0,
    cpu_usage numeric(5,2) DEFAULT 0,
    memory_usage numeric(5,2) DEFAULT 0,
    storage_used_gb numeric(10,2) DEFAULT 0,
    monthly_cost numeric(10,2) DEFAULT 0,
    last_sync timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    config_file text,
    last_cost_calculation timestamp with time zone,
    storage_total_gb numeric DEFAULT 0,
    storage_available_gb numeric DEFAULT 0,
    CONSTRAINT clusters_cluster_type_check CHECK ((cluster_type = ANY (ARRAY['kubernetes'::text, 'docker'::text, 'docker-swarm'::text]))),
    CONSTRAINT clusters_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'staging'::text, 'development'::text, 'on-premises'::text]))),
    CONSTRAINT clusters_provider_check CHECK ((provider = ANY (ARRAY['aws'::text, 'gcp'::text, 'azure'::text, 'digitalocean'::text, 'magalu'::text, 'on-premises'::text, 'other'::text]))),
    CONSTRAINT clusters_status_check CHECK ((status = ANY (ARRAY['healthy'::text, 'warning'::text, 'critical'::text, 'connecting'::text, 'disconnected'::text])))
);

ALTER TABLE ONLY public.clusters REPLICA IDENTITY FULL;


--
-- Name: cost_calculations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_calculations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    cluster_id uuid NOT NULL,
    compute_cost numeric(10,2) DEFAULT 0 NOT NULL,
    storage_cost numeric(10,2) DEFAULT 0 NOT NULL,
    network_cost numeric(10,2) DEFAULT 0 NOT NULL,
    total_cost numeric(10,2) DEFAULT 0 NOT NULL,
    calculation_date timestamp with time zone DEFAULT now() NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    pricing_details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    related_entity_type text,
    related_entity_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_name text NOT NULL,
    cnpj text,
    onboarding_completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    company text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: pvcs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pvcs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    namespace text NOT NULL,
    storage_class text,
    requested_bytes bigint DEFAULT 0 NOT NULL,
    used_bytes bigint DEFAULT 0 NOT NULL,
    status text DEFAULT 'bound'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_sync timestamp with time zone DEFAULT now()
);


--
-- Name: security_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_audits (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    cluster_id uuid NOT NULL,
    user_id uuid NOT NULL,
    severity text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    CONSTRAINT security_audits_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT security_audits_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'ignored'::text])))
);


--
-- Name: storage_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storage_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pvc_id uuid NOT NULL,
    cluster_id uuid NOT NULL,
    user_id uuid NOT NULL,
    recommendation_type text NOT NULL,
    current_size_gb numeric NOT NULL,
    recommended_size_gb numeric NOT NULL,
    potential_savings numeric DEFAULT 0,
    usage_percentage numeric NOT NULL,
    days_analyzed integer DEFAULT 7,
    reasoning text NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    applied_at timestamp with time zone
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: agent_anomalies agent_anomalies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_anomalies
    ADD CONSTRAINT agent_anomalies_pkey PRIMARY KEY (id);


--
-- Name: agent_api_keys agent_api_keys_api_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_api_keys
    ADD CONSTRAINT agent_api_keys_api_key_key UNIQUE (api_key);


--
-- Name: agent_api_keys agent_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_api_keys
    ADD CONSTRAINT agent_api_keys_pkey PRIMARY KEY (id);


--
-- Name: agent_commands agent_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commands
    ADD CONSTRAINT agent_commands_pkey PRIMARY KEY (id);


--
-- Name: agent_metrics agent_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_metrics
    ADD CONSTRAINT agent_metrics_pkey PRIMARY KEY (id);


--
-- Name: ai_cost_savings ai_cost_savings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_cost_savings
    ADD CONSTRAINT ai_cost_savings_pkey PRIMARY KEY (id);


--
-- Name: ai_incidents ai_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_incidents
    ADD CONSTRAINT ai_incidents_pkey PRIMARY KEY (id);


--
-- Name: cluster_events cluster_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cluster_events
    ADD CONSTRAINT cluster_events_pkey PRIMARY KEY (id);


--
-- Name: cluster_validation_results cluster_validation_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cluster_validation_results
    ADD CONSTRAINT cluster_validation_results_pkey PRIMARY KEY (id);


--
-- Name: clusters clusters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clusters
    ADD CONSTRAINT clusters_pkey PRIMARY KEY (id);


--
-- Name: cost_calculations cost_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_calculations
    ADD CONSTRAINT cost_calculations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_user_id_key UNIQUE (user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: pvcs pvcs_cluster_id_namespace_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pvcs
    ADD CONSTRAINT pvcs_cluster_id_namespace_name_key UNIQUE (cluster_id, namespace, name);


--
-- Name: pvcs pvcs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pvcs
    ADD CONSTRAINT pvcs_pkey PRIMARY KEY (id);


--
-- Name: security_audits security_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audits
    ADD CONSTRAINT security_audits_pkey PRIMARY KEY (id);


--
-- Name: storage_recommendations storage_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storage_recommendations
    ADD CONSTRAINT storage_recommendations_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_agent_anomalies_cluster; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_anomalies_cluster ON public.agent_anomalies USING btree (cluster_id, resolved);


--
-- Name: idx_agent_api_keys_cluster; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_api_keys_cluster ON public.agent_api_keys USING btree (cluster_id);


--
-- Name: idx_agent_commands_cluster_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_commands_cluster_status ON public.agent_commands USING btree (cluster_id, status);


--
-- Name: idx_agent_metrics_cluster_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_metrics_cluster_type ON public.agent_metrics USING btree (cluster_id, metric_type);


--
-- Name: idx_agent_metrics_collected_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_metrics_collected_at ON public.agent_metrics USING btree (collected_at DESC);


--
-- Name: idx_ai_cost_savings_cluster; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_cost_savings_cluster ON public.ai_cost_savings USING btree (cluster_id);


--
-- Name: idx_ai_cost_savings_incident; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_cost_savings_incident ON public.ai_cost_savings USING btree (incident_id);


--
-- Name: idx_ai_cost_savings_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_cost_savings_user ON public.ai_cost_savings USING btree (user_id);


--
-- Name: idx_ai_incidents_cluster; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_incidents_cluster ON public.ai_incidents USING btree (cluster_id);


--
-- Name: idx_ai_incidents_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_incidents_resolved ON public.ai_incidents USING btree (resolved_at);


--
-- Name: idx_ai_incidents_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_incidents_severity ON public.ai_incidents USING btree (severity);


--
-- Name: idx_ai_incidents_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_incidents_user ON public.ai_incidents USING btree (user_id);


--
-- Name: idx_cost_calculations_cluster; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_calculations_cluster ON public.cost_calculations USING btree (cluster_id);


--
-- Name: idx_cost_calculations_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_calculations_date ON public.cost_calculations USING btree (calculation_date);


--
-- Name: idx_cost_calculations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_calculations_user ON public.cost_calculations USING btree (user_id);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, read, created_at DESC) WHERE (read = false);


--
-- Name: idx_pvcs_cluster_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pvcs_cluster_id ON public.pvcs USING btree (cluster_id);


--
-- Name: idx_pvcs_storage_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pvcs_storage_class ON public.pvcs USING btree (storage_class);


--
-- Name: idx_pvcs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pvcs_user_id ON public.pvcs USING btree (user_id);


--
-- Name: idx_storage_recommendations_pvc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storage_recommendations_pvc_id ON public.storage_recommendations USING btree (pvc_id);


--
-- Name: idx_storage_recommendations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storage_recommendations_status ON public.storage_recommendations USING btree (status);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: agent_api_keys update_agent_api_keys_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_api_keys_updated_at BEFORE UPDATE ON public.agent_api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clusters update_clusters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clusters_updated_at BEFORE UPDATE ON public.clusters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pvcs update_pvcs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pvcs_updated_at BEFORE UPDATE ON public.pvcs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agent_anomalies agent_anomalies_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_anomalies
    ADD CONSTRAINT agent_anomalies_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: agent_api_keys agent_api_keys_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_api_keys
    ADD CONSTRAINT agent_api_keys_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: agent_commands agent_commands_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commands
    ADD CONSTRAINT agent_commands_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: agent_metrics agent_metrics_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_metrics
    ADD CONSTRAINT agent_metrics_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: ai_cost_savings ai_cost_savings_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_cost_savings
    ADD CONSTRAINT ai_cost_savings_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: ai_cost_savings ai_cost_savings_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_cost_savings
    ADD CONSTRAINT ai_cost_savings_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.ai_incidents(id) ON DELETE CASCADE;


--
-- Name: ai_incidents ai_incidents_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_incidents
    ADD CONSTRAINT ai_incidents_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: ai_incidents ai_incidents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_incidents
    ADD CONSTRAINT ai_incidents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: cluster_events cluster_events_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cluster_events
    ADD CONSTRAINT cluster_events_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: cluster_events cluster_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cluster_events
    ADD CONSTRAINT cluster_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cluster_validation_results cluster_validation_results_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cluster_validation_results
    ADD CONSTRAINT cluster_validation_results_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: clusters clusters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clusters
    ADD CONSTRAINT clusters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cost_calculations cost_calculations_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_calculations
    ADD CONSTRAINT cost_calculations_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: pvcs pvcs_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pvcs
    ADD CONSTRAINT pvcs_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: security_audits security_audits_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audits
    ADD CONSTRAINT security_audits_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: security_audits security_audits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audits
    ADD CONSTRAINT security_audits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: storage_recommendations storage_recommendations_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storage_recommendations
    ADD CONSTRAINT storage_recommendations_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: storage_recommendations storage_recommendations_pvc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storage_recommendations
    ADD CONSTRAINT storage_recommendations_pvc_id_fkey FOREIGN KEY (pvc_id) REFERENCES public.pvcs(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_metrics Public can insert metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert metrics" ON public.agent_metrics FOR INSERT WITH CHECK (true);


--
-- Name: agent_commands Public can read pending commands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read pending commands" ON public.agent_commands FOR SELECT USING ((status = 'pending'::text));


--
-- Name: cluster_validation_results Service role can insert validation results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert validation results" ON public.cluster_validation_results FOR INSERT WITH CHECK (true);


--
-- Name: cluster_validation_results Service role can update validation results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update validation results" ON public.cluster_validation_results FOR UPDATE USING (true);


--
-- Name: notifications System can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: cluster_events Users can create cluster events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create cluster events" ON public.cluster_events FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: pvcs Users can create own PVCs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own PVCs" ON public.pvcs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: agent_api_keys Users can create own agent API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own agent API keys" ON public.agent_api_keys FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: agent_anomalies Users can create own anomalies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own anomalies" ON public.agent_anomalies FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: clusters Users can create own clusters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own clusters" ON public.clusters FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: agent_commands Users can create own commands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own commands" ON public.agent_commands FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: cost_calculations Users can create own cost calculations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own cost calculations" ON public.cost_calculations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_cost_savings Users can create own cost savings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own cost savings" ON public.ai_cost_savings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ai_incidents Users can create own incidents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own incidents" ON public.ai_incidents FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: storage_recommendations Users can create recommendations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create recommendations" ON public.storage_recommendations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: security_audits Users can create security audits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create security audits" ON public.security_audits FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: pvcs Users can delete own PVCs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own PVCs" ON public.pvcs FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: agent_api_keys Users can delete own agent API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own agent API keys" ON public.agent_api_keys FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: clusters Users can delete own clusters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own clusters" ON public.clusters FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: organizations Users can insert their own organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own organization" ON public.organizations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: pvcs Users can update own PVCs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own PVCs" ON public.pvcs FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: agent_api_keys Users can update own agent API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own agent API keys" ON public.agent_api_keys FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: agent_anomalies Users can update own anomalies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own anomalies" ON public.agent_anomalies FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: clusters Users can update own clusters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own clusters" ON public.clusters FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: agent_commands Users can update own commands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own commands" ON public.agent_commands FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: ai_incidents Users can update own incidents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own incidents" ON public.ai_incidents FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: storage_recommendations Users can update own recommendations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own recommendations" ON public.storage_recommendations FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: security_audits Users can update own security audits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own security audits" ON public.security_audits FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: organizations Users can update their own organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own organization" ON public.organizations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: agent_metrics Users can view metrics from own clusters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view metrics from own clusters" ON public.agent_metrics FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.clusters
  WHERE ((clusters.id = agent_metrics.cluster_id) AND (clusters.user_id = auth.uid())))));


--
-- Name: pvcs Users can view own PVCs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own PVCs" ON public.pvcs FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: agent_api_keys Users can view own agent API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own agent API keys" ON public.agent_api_keys FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: agent_anomalies Users can view own anomalies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own anomalies" ON public.agent_anomalies FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: cluster_events Users can view own cluster events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own cluster events" ON public.cluster_events FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: clusters Users can view own clusters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own clusters" ON public.clusters FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: agent_commands Users can view own commands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own commands" ON public.agent_commands FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: cost_calculations Users can view own cost calculations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own cost calculations" ON public.cost_calculations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ai_cost_savings Users can view own cost savings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own cost savings" ON public.ai_cost_savings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ai_incidents Users can view own incidents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own incidents" ON public.ai_incidents FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: storage_recommendations Users can view own recommendations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own recommendations" ON public.storage_recommendations FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: security_audits Users can view own security audits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own security audits" ON public.security_audits FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: organizations Users can view their own organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own organization" ON public.organizations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: cluster_validation_results Users can view validation results for their clusters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view validation results for their clusters" ON public.cluster_validation_results FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.clusters
  WHERE ((clusters.id = cluster_validation_results.cluster_id) AND (clusters.user_id = auth.uid())))));


--
-- Name: agent_anomalies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_anomalies ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_commands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_commands ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_cost_savings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_cost_savings ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: cluster_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cluster_events ENABLE ROW LEVEL SECURITY;

--
-- Name: cluster_validation_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cluster_validation_results ENABLE ROW LEVEL SECURITY;

--
-- Name: clusters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_calculations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cost_calculations ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: pvcs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pvcs ENABLE ROW LEVEL SECURITY;

--
-- Name: security_audits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_audits ENABLE ROW LEVEL SECURITY;

--
-- Name: storage_recommendations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.storage_recommendations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


