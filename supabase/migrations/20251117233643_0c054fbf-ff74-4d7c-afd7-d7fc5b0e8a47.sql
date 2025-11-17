-- Add pending_agent status to clusters
ALTER TABLE clusters 
DROP CONSTRAINT IF EXISTS clusters_status_check;

ALTER TABLE clusters 
ADD CONSTRAINT clusters_status_check 
CHECK (status IN ('connecting', 'healthy', 'warning', 'error', 'pending_agent'));