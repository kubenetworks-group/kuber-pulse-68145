-- Create table for storing user consents (LGPD compliance)
create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  terms_accepted boolean not null default false,
  privacy_policy_accepted boolean not null default false,
  marketing_consent boolean not null default false,
  consent_date timestamp with time zone not null default now(),
  ip_address text,
  user_agent text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Enable RLS
alter table public.user_consents enable row level security;

-- RLS Policies
create policy "Users can view own consents"
  on public.user_consents
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own consents"
  on public.user_consents
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own consents"
  on public.user_consents
  for update
  using (auth.uid() = user_id);

-- Create index for performance
create index idx_user_consents_user_id on public.user_consents(user_id);

-- Trigger for updated_at
create trigger update_user_consents_updated_at
  before update on public.user_consents
  for each row
  execute function public.update_updated_at_column();