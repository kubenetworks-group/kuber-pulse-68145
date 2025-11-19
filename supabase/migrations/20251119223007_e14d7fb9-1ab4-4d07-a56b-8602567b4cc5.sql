-- Enable realtime for clusters and agent_metrics tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.clusters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_metrics;