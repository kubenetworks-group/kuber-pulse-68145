-- Tabela de leads capturados na landing page
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  company text,
  cluster_size text,         -- '1-5', '6-20', '21-100', '100+'
  vertical text,             -- 'fintech', 'healthtech', 'aiml', 'saas', 'other'
  ab_variant text,           -- 'a', 'b', 'c'
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  status text not null default 'new',  -- 'new', 'contacted', 'demo_scheduled', 'converted'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Email único (case-insensitive)
create unique index leads_email_unique on public.leads(lower(email));

-- Index para listagem por status/data no painel admin
create index leads_status_created_idx on public.leads(status, created_at desc);

-- RLS habilitado — inserção pública via edge function (service role bypassa RLS)
alter table public.leads enable row level security;
