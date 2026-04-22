-- Derived views for weighted pipeline, ad-account forecasts, and per-rep pacing.

-- Weighted pipeline per opportunity.
create or replace view public.v_opportunities_weighted as
  select
    o.*,
    (o.forecasted_pipeline_cents * o.probability_pct / 100)::bigint as weighted_pipeline_cents
  from public.opportunities o;

-- Ad account forecast: straight-line projection using 7-day run rate
-- plus any spend already logged this quarter.
create or replace view public.v_ad_account_forecast as
  select
    a.*,
    pc.name as parent_company_name,
    pc.target_revenue_cents,
    (a.last_7d_spend_cents / 7)::bigint as daily_run_rate_cents,
    (
      a.qtd_spend_cents
      + (a.last_7d_spend_cents / 7) * public.days_remaining_in_current_quarter()
    )::bigint as projected_eoq_spend_cents,
    case
      when coalesce(pc.target_revenue_cents, 0) = 0 then null
      else round(
        100.0 * (
          a.qtd_spend_cents
          + (a.last_7d_spend_cents / 7) * public.days_remaining_in_current_quarter()
        ) / pc.target_revenue_cents,
        1
      )
    end as projection_vs_target_pct
  from public.ad_accounts a
  join public.parent_companies pc on pc.id = a.parent_company_id;

-- Per-rep pacing for the current quarter.
-- Revenue is attributed via opportunities the rep owns, linked to ad accounts.
-- Ad accounts are deduped per rep so overlapping opportunities don't double-count.
create or replace view public.v_rep_pacing as
  with quarter_label as (
    select public.current_quarter_label() as label
  ),
  rep_ad_accounts as (
    select distinct o.owner_user_id as user_id, o.team_id, oaa.ad_account_id
    from public.opportunities o
    join public.opportunity_ad_accounts oaa on oaa.opportunity_id = o.id
    where o.owner_user_id is not null
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
        as weighted_open_pipeline_cents
    from public.opportunities o
    where o.status = 'open' and o.owner_user_id is not null
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
    coalesce(rp.weighted_open_pipeline_cents, 0) as weighted_open_pipeline_cents
  from public.profiles p
  left join public.teams t on t.id = p.team_id
  left join public.user_quotas uq
    on uq.user_id = p.id
   and uq.quarter = (select label from quarter_label)
  left join rep_revenue rr on rr.user_id = p.id
  left join rep_pipeline rp on rp.user_id = p.id;
