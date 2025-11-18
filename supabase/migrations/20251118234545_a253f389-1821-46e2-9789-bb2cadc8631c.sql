-- Remove email column from profiles table to improve security
-- Email should only be stored in auth.users and accessed through Supabase Auth
-- This prevents potential exposure through SQL injection or other vulnerabilities

ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;