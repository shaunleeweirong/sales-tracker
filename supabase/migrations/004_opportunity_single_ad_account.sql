-- One opportunity → one ad account. Drop the m2m, add a scalar FK.
-- Ad-account-side constraint: must belong to the same parent company as the opp.

-- Drop dependent views first
drop view if exists public.v_rep_pacing;
drop view if exists public.v_opportunities_weighted;

-- Add nullable column, backfill from m2m (pick one ad account per opp), then NOT NULL
alter table public.opportunities
  add column if not exists ad_account_id uuid references public.ad_accounts(id) on delete restrict;

update public.opportunities o
set ad_account_id = sub.ad_account_id
from (
  select distinct on (opportunity_id)
    opportunity_id,
    ad_account_id
  from public.opportunity_ad_accounts
  order by opportunity_id, ad_account_id
) sub
where sub.opportunity_id = o.id
  and o.ad_account_id is null;

-- Seeded rows may not have m2m entries yet; skip NOT NULL if any nulls remain
do $$
begin
  if not exists (select 1 from public.opportunities where ad_account_id is null) then
    alter table public.opportunities alter column ad_account_id set not null;
  end if;
end$$;

create index if not exists opportunities_ad_account_idx on public.opportunities(ad_account_id);

-- Drop the m2m table
drop table if exists public.opportunity_ad_accounts;

-- Rebuild weighted view with scalar ad account + its LinkedIn id
create view public.v_opportunities_weighted as
  select
    o.*,
    (o.forecasted_pipeline_cents * o.probability_pct / 100)::bigint as weighted_pipeline_cents,
    a.linkedin_account_id as ad_account_linkedin_id
  from public.opportunities o
  left join public.ad_accounts a on a.id = o.ad_account_id;

-- Rebuild rep pacing view: now revenue comes directly from the one ad account
-- attached to each opportunity owned by the rep.
create view public.v_rep_pacing as
  with quarter_label as (
    select public.current_quarter_label() as label
  ),
  rep_ad_accounts as (
    select distinct o.owner_user_id as user_id, o.team_id, o.ad_account_id
    from public.opportunities o
    where o.owner_user_id is not null and o.ad_account_id is not null
  ),
  rep_revenue as (
    select
      raa.user_id,
      sum(a.qtd_spend_cents)::bigint as qtd_revenue_cents,
      sum(
        a.qtd_spend_cents
        + (a.last_7d_spend_cents / 7) * public.days_remaining_in_current_quarter()
      )::bigint as projected_revenue_cents
    from rep_ad_accounts raa
    join public.ad_accounts a on a.id = raa.ad_account_id
    group by raa.user_id
  ),
  rep_pipeline as (
    select
      o.owner_user_id as user_id,
      sum(o.forecasted_pipeline_cents * o.probability_pct / 100)::bigint
        as weighted_pipeline_cents
    from public.opportunities o
    where o.owner_user_id is not null
    group by o.owner_user_id
  )
  select
    p.id as user_id,
    p.full_name,
    p.team_id,
    t.name as team_name,
    (select label from quarter_label) as quarter,
    coalesce(uq.quota_cents, 0) as quota_cents,
    coalesce(rr.qtd_revenue_cents, 0) as qtd_revenue_cents,
    coalesce(rr.projected_revenue_cents, 0) as projected_revenue_cents,
    case
      when coalesce(uq.quota_cents, 0) = 0 then null
      else round(100.0 * coalesce(rr.projected_revenue_cents, 0) / uq.quota_cents, 1)
    end as projected_vs_quota_pct,
    coalesce(rp.weighted_pipeline_cents, 0) as weighted_pipeline_cents
  from public.profiles p
  left join public.teams t on t.id = p.team_id
  left join public.user_quotas uq
    on uq.user_id = p.id
   and uq.quarter = (select label from quarter_label)
  left join rep_revenue rr on rr.user_id = p.id
  left join rep_pipeline rp on rp.user_id = p.id;
