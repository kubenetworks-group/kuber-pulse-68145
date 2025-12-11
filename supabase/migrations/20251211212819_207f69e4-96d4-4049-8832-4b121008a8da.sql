-- MIGRATION: Habilitar Realtime para AI Monitor

-- 1. Habilitar REPLICA IDENTITY FULL para tabelas de monitoramento
ALTER TABLE public.agent_anomalies REPLICA IDENTITY FULL;
ALTER TABLE public.agent_commands REPLICA IDENTITY FULL;
ALTER TABLE public.agent_metrics REPLICA IDENTITY FULL;
ALTER TABLE public.scan_history REPLICA IDENTITY FULL;

-- 2. Adicionar tabelas à publicação do Supabase Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE agent_anomalies;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE agent_commands;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE agent_metrics;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE scan_history;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;