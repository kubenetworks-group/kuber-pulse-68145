-- LGPD Enhancements: consent versioning and delete account RPC

-- Add version tracking to user_consents
alter table public.user_consents
  add column if not exists terms_version text not null default 'v1.2',
  add column if not exists policy_version text not null default 'v1.2';

-- Function for users to delete their own account (LGPD Art. 18 - right to erasure)
-- This function runs with elevated privileges to cascade delete all user data
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Delete user data in dependency order
  -- (most tables cascade via foreign keys, but we handle main ones explicitly)
  delete from public.user_consents     where user_id = v_user_id;
  delete from public.notifications     where user_id = v_user_id;
  delete from public.audit_logs        where user_id = v_user_id;
  delete from public.agent_api_keys    where user_id = v_user_id;
  delete from public.subscriptions     where user_id = v_user_id;
  delete from public.usage_tracking    where user_id = v_user_id;
  delete from public.clusters          where user_id = v_user_id;
  delete from public.profiles          where id = v_user_id;

  -- Delete the auth user (triggers cascade on auth.users)
  delete from auth.users where id = v_user_id;
end;
$$;

-- Grant execute permission to authenticated users only
revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;

comment on function public.delete_user_account() is
  'LGPD Art. 18: Allows an authenticated user to permanently delete their account and all associated data.';
