-- Add retry tracking columns to agent_commands table
ALTER TABLE agent_commands 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient retry queries
CREATE INDEX IF NOT EXISTS idx_agent_commands_retry 
ON agent_commands(status, next_retry_at) 
WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN agent_commands.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN agent_commands.max_retries IS 'Maximum number of retry attempts allowed';
COMMENT ON COLUMN agent_commands.next_retry_at IS 'Timestamp when next retry should be attempted';