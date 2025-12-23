-- Migration: Enable real-time for PVCs and Persistent Volumes tables
-- This allows the frontend to receive automatic updates when storage metrics change

-- Enable REPLICA IDENTITY FULL for pvcs table (required for realtime)
ALTER TABLE public.pvcs REPLICA IDENTITY FULL;

-- Add pvcs to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.pvcs;

-- Enable REPLICA IDENTITY FULL for persistent_volumes table
ALTER TABLE public.persistent_volumes REPLICA IDENTITY FULL;

-- Add persistent_volumes to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.persistent_volumes;
