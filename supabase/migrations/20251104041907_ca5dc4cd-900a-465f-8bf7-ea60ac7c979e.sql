-- Enable realtime for clusters and cluster_events tables
ALTER TABLE public.clusters REPLICA IDENTITY FULL;
ALTER TABLE public.cluster_events REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.clusters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cluster_events;