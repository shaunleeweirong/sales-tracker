-- Remove the Team concept entirely.
-- Each user is their own rep; quotas are already per-user. The team layer
-- only added filtering/grouping noise on a per-user-isolated dataset.

-- Views that reference team columns must be dropped before the columns go.
drop view if exists public.v_rep_pacing;
drop view if exists public.v_opportunities_weighted;

alter table public.opportunities drop column if exists team_id;
alter table public.profiles     drop column if exists team_id;

drop table if exists public.teams;

-- Recreate views without the team columns.
create or replace view public.v_opportunities_weighted as
  select
    o.*,
    (o.forecasted_pipeline_cents * o.probability_pct / 100)::bigint as weighted_pipeline_cents
  from public.opportunities o;

create or replace view public.v_rep_pacing as
  with quarter_label as (
    select public.current_quarter_label() as label
  ),
  rep_ad_accounts as (
    select distinct o.owner_user_id as user_id, o.ad_account_id
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
  left join public.user_quotas uq
    on uq.user_id = p.id
   and uq.quarter = (select label from quarter_label)
  left join rep_revenue rr on rr.user_id = p.id
  left join rep_pipeline rp on rp.user_id = p.id;

-- Preserve the RLS-respecting behavior from migration 005.
alter view public.v_opportunities_weighted set (security_invoker = on);
alter view public.v_rep_pacing set (security_invoker = on);
