-- Per-user data isolation.
-- Each rep's companies, ad accounts, and spend data are scoped to their own view.
-- Admins keep cross-user visibility via the service-role client (bypasses RLS).

-- ─── parent_companies ────────────────────────────────────────────────────────
alter table public.parent_companies
  add column if not exists owner_user_id uuid
    references public.profiles(id) on delete cascade;

-- Name is globally unique today; scope to owner so reps can share a client name.
alter table public.parent_companies drop constraint if exists parent_companies_name_key;
create unique index if not exists parent_companies_owner_name_idx
  on public.parent_companies(owner_user_id, name);

-- Enforce not-null now that any existing rows have been cleaned up.
alter table public.parent_companies alter column owner_user_id set not null;
create index if not exists parent_companies_owner_idx
  on public.parent_companies(owner_user_id);

-- ─── child_companies ─────────────────────────────────────────────────────────
alter table public.child_companies
  add column if not exists owner_user_id uuid
    references public.profiles(id) on delete cascade;

alter table public.child_companies drop constraint if exists child_companies_parent_company_id_name_key;
create unique index if not exists child_companies_owner_parent_name_idx
  on public.child_companies(owner_user_id, parent_company_id, name);

alter table public.child_companies alter column owner_user_id set not null;
create index if not exists child_companies_owner_idx
  on public.child_companies(owner_user_id);

-- ─── ad_accounts ─────────────────────────────────────────────────────────────
alter table public.ad_accounts
  add column if not exists owner_user_id uuid
    references public.profiles(id) on delete cascade;

alter table public.ad_accounts drop constraint if exists ad_accounts_linkedin_account_id_key;
create unique index if not exists ad_accounts_owner_linkedin_idx
  on public.ad_accounts(owner_user_id, linkedin_account_id);

alter table public.ad_accounts alter column owner_user_id set not null;
create index if not exists ad_accounts_owner_idx
  on public.ad_accounts(owner_user_id);

-- ─── views: respect RLS of underlying tables ────────────────────────────────
-- Without this, views run with their creator's (postgres) privileges and
-- bypass RLS on parent_companies/ad_accounts/opportunities.
alter view public.v_ad_account_forecast set (security_invoker = on);
alter view public.v_opportunities_weighted set (security_invoker = on);
alter view public.v_rep_pacing set (security_invoker = on);

-- ─── RLS: enable + policies ─────────────────────────────────────────────────
-- Helper: every policy below is "owner-only". Admins bypass via service-role.

alter table public.parent_companies enable row level security;
create policy "parent_companies owner-all"
  on public.parent_companies for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

alter table public.child_companies enable row level security;
create policy "child_companies owner-all"
  on public.child_companies for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

alter table public.ad_accounts enable row level security;
create policy "ad_accounts owner-all"
  on public.ad_accounts for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

alter table public.opportunities enable row level security;
create policy "opportunities owner-all"
  on public.opportunities for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

alter table public.csv_imports enable row level security;
create policy "csv_imports uploader-all"
  on public.csv_imports for all to authenticated
  using (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());

alter table public.user_quotas enable row level security;
create policy "user_quotas self-all"
  on public.user_quotas for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- Admin cross-user quota management bypasses RLS via the service-role client.

-- profiles and teams stay open to authenticated users (needed for dropdowns
-- such as RepSelect and opportunity-owner pickers). Tighten later if needed.
