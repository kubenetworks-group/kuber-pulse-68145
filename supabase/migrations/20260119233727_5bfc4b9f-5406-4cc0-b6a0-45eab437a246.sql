-- Add separate tracking for storage analyses and chat messages
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS storage_analyses_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS storage_analyses_reset_at timestamp with time zone DEFAULT (date_trunc('month', now()) + interval '1 month'),
ADD COLUMN IF NOT EXISTS chat_messages_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS chat_messages_reset_at timestamp with time zone DEFAULT (date_trunc('month', now()) + interval '1 month');

-- Update existing rows to have proper reset dates
UPDATE public.subscriptions 
SET 
  storage_analyses_reset_at = COALESCE(storage_analyses_reset_at, date_trunc('month', now()) + interval '1 month'),
  chat_messages_reset_at = COALESCE(chat_messages_reset_at, date_trunc('month', now()) + interval '1 month')
WHERE storage_analyses_reset_at IS NULL OR chat_messages_reset_at IS NULL;