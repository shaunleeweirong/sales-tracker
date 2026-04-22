-- Sales Tracker initial schema
-- All monetary values stored as bigint cents to avoid float drift.

create extension if not exists "uuid-ossp";

-- ─── teams ───────────────────────────────────────────────────────────────────
create table public.teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ─── profiles (1:1 with auth.users) ──────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  team_id uuid references public.teams(id) on delete set null,
  role text not null default 'rep' check (role in ('rep', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_team_id_idx on public.profiles(team_id);

-- Auto-create a profile row when an auth.user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── user_quotas ─────────────────────────────────────────────────────────────
create table public.user_quotas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quarter text not null,                          -- e.g. '2026-Q2'
  quota_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, quarter)
);
create index user_quotas_quarter_idx on public.user_quotas(quarter);

-- ─── parent_companies ────────────────────────────────────────────────────────
create table public.parent_companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  target_revenue_cents bigint,                    -- quarterly target, nullable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── child_companies ─────────────────────────────────────────────────────────
create table public.child_companies (
  id uuid primary key default uuid_generate_v4(),
  parent_company_id uuid not null references public.parent_companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (parent_company_id, name)
);
create index child_companies_parent_idx on public.child_companies(parent_company_id);

-- ─── ad_accounts ─────────────────────────────────────────────────────────────
create table public.ad_accounts (
  id uuid primary key default uuid_generate_v4(),
  linkedin_account_id text not null unique,
  parent_company_id uuid not null references public.parent_companies(id) on delete cascade,
  child_company_id uuid references public.child_companies(id) on delete set null,
  last_7d_spend_cents bigint not null default 0,
  qtd_spend_cents bigint not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ad_accounts_parent_idx on public.ad_accounts(parent_company_id);
create index ad_accounts_child_idx on public.ad_accounts(child_company_id);

-- ─── opportunities ───────────────────────────────────────────────────────────
create table public.opportunities (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  parent_company_id uuid not null references public.parent_companies(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  forecasted_pipeline_cents bigint not null default 0,
  probability_pct smallint not null check (probability_pct in (5, 10, 25, 50, 75, 90, 100)),
  expected_close_date date,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index opportunities_parent_idx on public.opportunities(parent_company_id);
create index opportunities_owner_idx on public.opportunities(owner_user_id);
create index opportunities_team_idx on public.opportunities(team_id);
create index opportunities_status_idx on public.opportunities(status);
create index opportunities_close_idx on public.opportunities(expected_close_date);

-- ─── opportunity_ad_accounts (m2m) ───────────────────────────────────────────
create table public.opportunity_ad_accounts (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  primary key (opportunity_id, ad_account_id)
);
create index opp_ad_accounts_acct_idx on public.opportunity_ad_accounts(ad_account_id);

-- ─── csv_imports ─────────────────────────────────────────────────────────────
create table public.csv_imports (
  id uuid primary key default uuid_generate_v4(),
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  file_name text not null,
  row_count integer not null default 0,
  status text not null default 'success' check (status in ('success', 'partial', 'failed')),
  error_log jsonb
);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger t_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger t_user_quotas_updated before update on public.user_quotas
  for each row execute function public.set_updated_at();
create trigger t_parent_companies_updated before update on public.parent_companies
  for each row execute function public.set_updated_at();
create trigger t_ad_accounts_updated before update on public.ad_accounts
  for each row execute function public.set_updated_at();
create trigger t_opportunities_updated before update on public.opportunities
  for each row execute function public.set_updated_at();

-- ─── date helper: days remaining in current calendar quarter ─────────────────
create or replace function public.days_remaining_in_current_quarter(as_of date default current_date)
returns integer
language sql
immutable
as $$
  select greatest(
    0,
    (date_trunc('quarter', as_of)::date + interval '3 months - 1 day')::date - as_of
  )::integer + 1;  -- inclusive of today
$$;

create or replace function public.current_quarter_label(as_of date default current_date)
returns text
language sql
immutable
as $$
  select to_char(date_trunc('quarter', as_of), 'YYYY') || '-Q' ||
         extract(quarter from as_of)::int;
$$;
