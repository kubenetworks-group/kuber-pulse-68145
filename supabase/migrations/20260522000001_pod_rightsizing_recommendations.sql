-- Pod rightsizing recommendations table
-- Stores AI-generated CPU/memory rightsizing suggestions per pod/container

create table if not exists public.pod_rightsizing_recommendations (
  id                    uuid primary key default gen_random_uuid(),
  cluster_id            uuid not null references public.clusters(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  pod_name              text not null,
  namespace             text not null,
  container_name        text not null default 'main',
  recommendation_type   text not null check (recommendation_type in (
                          'downsize_cpu', 'upsize_cpu',
                          'downsize_mem', 'upsize_mem',
                          'add_limits', 'add_requests'
                        )),
  resource_type         text not null default 'cpu' check (resource_type in ('cpu', 'memory', 'both')),
  priority              text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  current_request_cpu   text,
  recommended_request_cpu text,
  current_limit_cpu     text,
  current_request_mem   text,
  recommended_request_mem text,
  current_limit_mem     text,
  avg_usage_percent     numeric default 0,
  max_usage_percent     numeric default 0,
  p95_usage_percent     numeric default 0,
  potential_savings_month numeric default 0,
  ai_reasoning          text,
  status                text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'applied')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Index for common queries
create index if not exists idx_pod_rightsizing_cluster_status
  on public.pod_rightsizing_recommendations (cluster_id, status);

create index if not exists idx_pod_rightsizing_user
  on public.pod_rightsizing_recommendations (user_id);

-- RLS
alter table public.pod_rightsizing_recommendations enable row level security;

create policy "Users can view their own pod rightsizing recommendations"
  on public.pod_rightsizing_recommendations for select
  using (auth.uid() = user_id);

create policy "Users can update their own pod rightsizing recommendations"
  on public.pod_rightsizing_recommendations for update
  using (auth.uid() = user_id);

create policy "Service role can manage pod rightsizing recommendations"
  on public.pod_rightsizing_recommendations for all
  using (true)
  with check (true);

-- updated_at trigger
create or replace function public.set_pod_rightsizing_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_pod_rightsizing_updated_at
  before update on public.pod_rightsizing_recommendations
  for each row execute function public.set_pod_rightsizing_updated_at();
