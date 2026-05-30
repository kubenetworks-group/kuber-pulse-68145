-- Fix: replace expression index lower(email) with a plain UNIQUE constraint.
-- The function already normalises to lowercase before insert, so a plain
-- UNIQUE on email is sufficient and works with Supabase upsert onConflict:'email'.

-- First, normalize any existing mixed-case emails so the new constraint won't fail.
UPDATE public.leads SET email = lower(email) WHERE email <> lower(email);

-- Drop the expression index that was incompatible with ON CONFLICT (email).
DROP INDEX IF EXISTS public.leads_email_unique;

-- Add a proper unique constraint that PostgREST / Supabase upsert can use.
ALTER TABLE public.leads
  ADD CONSTRAINT leads_email_key UNIQUE (email);
