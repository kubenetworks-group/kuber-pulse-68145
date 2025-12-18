-- Create whatsapp_approvals table
CREATE TABLE public.whatsapp_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  anomaly_id UUID REFERENCES agent_anomalies(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_params JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  whatsapp_message_id TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
  user_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.whatsapp_approvals ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_approvals
CREATE POLICY "Users can view own approvals" ON public.whatsapp_approvals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own approvals" ON public.whatsapp_approvals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own approvals" ON public.whatsapp_approvals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert approvals" ON public.whatsapp_approvals FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update approvals" ON public.whatsapp_approvals FOR UPDATE USING (true);

-- Add WhatsApp columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verification_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verification_expires_at TIMESTAMPTZ;

-- Add WhatsApp approval columns to auto_heal_settings
ALTER TABLE public.auto_heal_settings ADD COLUMN IF NOT EXISTS require_whatsapp_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE public.auto_heal_settings ADD COLUMN IF NOT EXISTS approval_timeout_minutes INTEGER DEFAULT 30;