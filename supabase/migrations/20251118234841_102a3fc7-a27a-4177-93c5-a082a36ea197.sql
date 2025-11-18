-- Remove the insecure public read policy for pending commands
-- The agent-get-commands edge function uses SERVICE_ROLE_KEY which bypasses RLS
-- This eliminates the security vulnerability where anyone could read pending commands

DROP POLICY IF EXISTS "Public can read pending commands" ON public.agent_commands;

-- Ensure only authenticated users can view their own commands (policy already exists)
-- The existing "Users can view own commands" policy handles authenticated access