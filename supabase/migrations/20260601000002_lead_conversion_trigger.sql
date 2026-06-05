-- When a new user signs up, automatically mark the matching lead as converted.
-- This fires on every INSERT into auth.users (the existing handle_new_user trigger
-- already runs; this is a separate trigger so we don't touch that function).

CREATE OR REPLACE FUNCTION public.handle_lead_conversion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.leads
  SET
    status     = 'converted',
    updated_at = NOW()
  WHERE email = LOWER(NEW.email)
    AND status <> 'converted';   -- idempotent

  RETURN NEW;
END;
$$;

-- Drop if exists so re-running migration is safe
DROP TRIGGER IF EXISTS on_auth_user_created_convert_lead ON auth.users;

CREATE TRIGGER on_auth_user_created_convert_lead
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_conversion();
