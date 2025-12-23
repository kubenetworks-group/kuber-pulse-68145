-- Create table to store backup codes (hashed for security)
CREATE TABLE public.mfa_backup_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  code_prefix TEXT NOT NULL, -- First 4 chars for identification
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;

-- Users can view their own backup codes
CREATE POLICY "Users can view own backup codes"
ON public.mfa_backup_codes
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own backup codes
CREATE POLICY "Users can create own backup codes"
ON public.mfa_backup_codes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own backup codes (mark as used)
CREATE POLICY "Users can update own backup codes"
ON public.mfa_backup_codes
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own backup codes
CREATE POLICY "Users can delete own backup codes"
ON public.mfa_backup_codes
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_mfa_backup_codes_user_id ON public.mfa_backup_codes(user_id);
CREATE INDEX idx_mfa_backup_codes_lookup ON public.mfa_backup_codes(user_id, used);