-- Add unique constraint to organizations table to prevent duplicate user_ids
-- First, remove duplicate entries keeping only the most recent one
DELETE FROM organizations a
USING organizations b
WHERE a.user_id = b.user_id
  AND a.created_at < b.created_at;

-- Now add the unique constraint
ALTER TABLE organizations
ADD CONSTRAINT organizations_user_id_key UNIQUE (user_id);