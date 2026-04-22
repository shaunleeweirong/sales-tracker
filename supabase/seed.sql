-- Demo seed. All users have password: password123
-- Sign in with shaun@test.com (admin), priya@test.com, marcos@test.com, jen@test.com

-- ─── Auth users ──────────────────────────────────────────────────────────────
-- The handle_new_user trigger auto-creates profiles from raw_user_meta_data.full_name
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'shaun@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Shaun Lee"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'priya@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Priya Nair"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated',
    'marcos@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Marcos Alvarez"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-4444-444444444444',
    'authenticated', 'authenticated',
    'jen@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Jen Okafor"}',
    now(), now(), '', '', '', ''
  );

-- Seed auth.identities so email login works on all Supabase versions
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  u.email,
  now(), now(), now()
from auth.users u
where u.email in ('shaun@test.com','priya@test.com','marcos@test.com','jen@test.com');

-- ─── Teams ───────────────────────────────────────────────────────────────────
insert into public.teams (id, name) values
  ('aaaa1111-0000-0000-0000-000000000000', 'Alpha'),
  ('bbbb1111-0000-0000-0000-000000000000', 'Bravo');

-- ─── Profile assignments (full_name already set by trigger) ──────────────────
update public.profiles set team_id = 'aaaa1111-0000-0000-0000-000000000000', role = 'admin'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set team_id = 'aaaa1111-0000-0000-0000-000000000000'
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set team_id = 'bbbb1111-0000-0000-0000-000000000000'
  where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set team_id = 'bbbb1111-0000-0000-0000-000000000000'
  where id = '44444444-4444-4444-4444-444444444444';

-- ─── Parent companies (quarterly targets in cents) ───────────────────────────
insert into public.parent_companies (id, name, target_revenue_cents) values
  ('c1110000-0000-0000-0000-000000000000', 'Acme Corp',         30000000),  -- $300k
  ('c2220000-0000-0000-0000-000000000000', 'BetaCo',            20000000),  -- $200k
  ('c3330000-0000-0000-0000-000000000000', 'Gamma Industries',  null),       -- not set yet
  ('c4440000-0000-0000-0000-000000000000', 'Delta Partners',    10000000);  -- $100k

-- ─── Child companies ─────────────────────────────────────────────────────────
insert into public.child_companies (id, parent_company_id, name) values
  ('cc110000-0000-0000-0000-000000000001', 'c1110000-0000-0000-0000-000000000000', 'Acme Brand'),
  ('cc110000-0000-0000-0000-000000000002', 'c1110000-0000-0000-0000-000000000000', 'Acme Retail'),
  ('cc110000-0000-0000-0000-000000000003', 'c1110000-0000-0000-0000-000000000000', 'Acme Labs'),
  ('cc220000-0000-0000-0000-000000000001', 'c2220000-0000-0000-0000-000000000000', 'BetaCo'),
  ('cc330000-0000-0000-0000-000000000001', 'c3330000-0000-0000-0000-000000000000', 'Gamma Consumer'),
  ('cc330000-0000-0000-0000-000000000002', 'c3330000-0000-0000-0000-000000000000', 'Gamma B2B'),
  ('cc440000-0000-0000-0000-000000000001', 'c4440000-0000-0000-0000-000000000000', 'Delta Pro');

-- ─── Ad accounts (spend in cents; synced "today") ────────────────────────────
insert into public.ad_accounts (id, linkedin_account_id, parent_company_id, child_company_id, last_7d_spend_cents, qtd_spend_cents, last_synced_at) values
  ('aa110000-0000-0000-0000-000000000001', '512003421', 'c1110000-0000-0000-0000-000000000000', 'cc110000-0000-0000-0000-000000000001',  1820000,  6240000, now()),
  ('aa110000-0000-0000-0000-000000000002', '512998877', 'c1110000-0000-0000-0000-000000000000', 'cc110000-0000-0000-0000-000000000001',   640000,  2410000, now()),
  ('aa110000-0000-0000-0000-000000000003', '513112233', 'c1110000-0000-0000-0000-000000000000', 'cc110000-0000-0000-0000-000000000002',   490000,  1800000, now()),
  ('aa110000-0000-0000-0000-000000000004', '513445566', 'c1110000-0000-0000-0000-000000000000', 'cc110000-0000-0000-0000-000000000003',   210000,  1200000, now()),
  ('aa110000-0000-0000-0000-000000000005', '513778899', 'c1110000-0000-0000-0000-000000000000', 'cc110000-0000-0000-0000-000000000003',   120000,   800000, now()),
  ('aa220000-0000-0000-0000-000000000001', '600112233', 'c2220000-0000-0000-0000-000000000000', 'cc220000-0000-0000-0000-000000000001',  1190000,  4820000, now()),
  ('aa220000-0000-0000-0000-000000000002', '600445566', 'c2220000-0000-0000-0000-000000000000', 'cc220000-0000-0000-0000-000000000001',   310000,  1400000, now()),
  ('aa330000-0000-0000-0000-000000000001', '700001111', 'c3330000-0000-0000-0000-000000000000', 'cc330000-0000-0000-0000-000000000001',   880000,  3250000, now()),
  ('aa330000-0000-0000-0000-000000000002', '700002222', 'c3330000-0000-0000-0000-000000000000', 'cc330000-0000-0000-0000-000000000001',   420000,  1860000, now()),
  ('aa330000-0000-0000-0000-000000000003', '700003333', 'c3330000-0000-0000-0000-000000000000', 'cc330000-0000-0000-0000-000000000002',   310000,  1600000, now()),
  ('aa440000-0000-0000-0000-000000000001', '800001111', 'c4440000-0000-0000-0000-000000000000', 'cc440000-0000-0000-0000-000000000001',   320000,  1230000, now());

-- ─── Opportunities (one ad account each) ────────────────────────────────────
-- Demo shows same ad account appearing on multiple opps (Acme Q2 Renewal + Beta Upsell example).
insert into public.opportunities (id, name, parent_company_id, ad_account_id, owner_user_id, team_id, forecasted_pipeline_cents, probability_pct, expected_close_date, notes, go_to_market_notes, roles_and_responsibilities) values
  ('0ddd0000-0000-0000-0000-000000000001', 'Acme Q2 Renewal',      'c1110000-0000-0000-0000-000000000000', 'aa110000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000000', 10000000, 90,  '2026-06-30', 'Verbal from CMO',
    'Position as performance-tier renewal; lead with Q1 ROAS lift.',
    E'Shaun — lead, commercial owner\nPriya — analytics + pitch deck\nSE team — creative strategy'),
  ('0ddd0000-0000-0000-0000-000000000010', 'Acme Brand Cross-sell', 'c1110000-0000-0000-0000-000000000000', 'aa110000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000000',  3000000, 50,  '2026-08-15', null,
    'Secondary pitch against the same Brand ad account — add sponsored content tier.',
    E'Shaun — lead\nPriya — deck'),
  ('0ddd0000-0000-0000-0000-000000000002', 'Acme Retail Expansion','c1110000-0000-0000-0000-000000000000', 'aa110000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'aaaa1111-0000-0000-0000-000000000000',  4000000, 50,  '2026-06-28', null,
    'Expand current Retail campaigns into DACH. Needs local creative + language QA before proposal.',
    E'Priya — account lead\nLocalisation team — creative QA'),
  ('0ddd0000-0000-0000-0000-000000000003', 'Acme Labs Pilot',      'c1110000-0000-0000-0000-000000000000', 'aa110000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000000',  2000000, 25,  '2026-07-15', null,
    'New audience: startup founders. Budget limited; start with 2-week test on Labs audience.',
    E'Shaun — sponsor\nJen — SE support'),
  ('0ddd0000-0000-0000-0000-000000000004', 'Beta Brand Launch',    'c2220000-0000-0000-0000-000000000000', 'aa220000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'aaaa1111-0000-0000-0000-000000000000',  8000000, 75,  '2026-06-15', null,
    'Brand awareness push — Video + sponsored content. Creatives ready; procurement in flight.',
    E'Priya — AE lead\nClient CMO + CFO as signers'),
  ('0ddd0000-0000-0000-0000-000000000005', 'Beta Upsell',          'c2220000-0000-0000-0000-000000000000', 'aa220000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'aaaa1111-0000-0000-0000-000000000000',  2500000, 10,  '2026-08-01', null, null, null),
  ('0ddd0000-0000-0000-0000-000000000006', 'Gamma Consumer Scale', 'c3330000-0000-0000-0000-000000000000', 'aa330000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'bbbb1111-0000-0000-0000-000000000000',  6000000, 75,  '2026-06-20', null,
    'Scale proven Q1 playbook: lookalike targeting + 3 ad variants.',
    E'Marcos — owner\nMedia planning — budget pacing'),
  ('0ddd0000-0000-0000-0000-000000000007', 'Gamma B2B Pilot',      'c3330000-0000-0000-0000-000000000000', 'aa330000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'bbbb1111-0000-0000-0000-000000000000',  3500000, 50,  '2026-06-30', null, null, null),
  ('0ddd0000-0000-0000-0000-000000000008', 'Gamma Mega Deal',      'c3330000-0000-0000-0000-000000000000', 'aa330000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'bbbb1111-0000-0000-0000-000000000000', 20000000,  5,  '2026-09-30', 'Early-stage convo',
    'Enterprise-wide LinkedIn commitment. Blocker: need legal redlines on data-processing addendum.',
    E'Marcos — exec sponsor\nLegal — DPA review'),
  ('0ddd0000-0000-0000-0000-000000000009', 'Delta Retention',      'c4440000-0000-0000-0000-000000000000', 'aa440000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'bbbb1111-0000-0000-0000-000000000000',  1500000,100,  '2026-04-30', 'Closed early in quarter', null, null);

-- ─── Confirmed (100%) opportunities to cover QTD spend ──────────────────────
-- Acme Corp: all 5 accounts covered. BetaCo: both accounts covered.
-- Delta Partners: covered by Delta Retention above. Gamma Industries: intentionally uncovered → shows warning.
insert into public.opportunities (id, name, parent_company_id, ad_account_id, owner_user_id, team_id, forecasted_pipeline_cents, probability_pct, expected_close_date, notes, go_to_market_notes, roles_and_responsibilities) values
  ('0fff0000-0000-0000-0000-000000000001', 'Acme Brand Always-on Q2',     'c1110000-0000-0000-0000-000000000000', 'aa110000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000000', 7000000, 100, '2026-06-30', 'Committed. PO received.', null, null),
  ('0fff0000-0000-0000-0000-000000000002', 'Acme Brand Always-on Secondary','c1110000-0000-0000-0000-000000000000', 'aa110000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000000', 3000000, 100, '2026-06-30', 'Signed IO on file.',      null, null),
  ('0fff0000-0000-0000-0000-000000000003', 'Acme Retail Confirmed',        'c1110000-0000-0000-0000-000000000000', 'aa110000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'aaaa1111-0000-0000-0000-000000000000', 2000000, 100, '2026-05-31', 'Renewal signed.',          null, null),
  ('0fff0000-0000-0000-0000-000000000004', 'Acme Labs Confirmed',          'c1110000-0000-0000-0000-000000000000', 'aa110000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000000', 1500000, 100, '2026-05-31', 'Test budget approved.',    null, null),
  ('0fff0000-0000-0000-0000-000000000005', 'Acme Labs Always-on 2',        'c1110000-0000-0000-0000-000000000000', 'aa110000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'aaaa1111-0000-0000-0000-000000000000', 1000000, 100, '2026-06-15', 'Standing budget.',         null, null),
  ('0fff0000-0000-0000-0000-000000000006', 'Beta Brand Confirmed',         'c2220000-0000-0000-0000-000000000000', 'aa220000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'aaaa1111-0000-0000-0000-000000000000', 5500000, 100, '2026-06-15', 'MSA executed.',            null, null),
  ('0fff0000-0000-0000-0000-000000000007', 'Beta Retention Confirmed',     'c2220000-0000-0000-0000-000000000000', 'aa220000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'aaaa1111-0000-0000-0000-000000000000', 2000000, 100, '2026-05-15', 'Auto-renew confirmed.',    null, null);

-- ─── Quotas for 2026-Q2 ──────────────────────────────────────────────────────
insert into public.user_quotas (user_id, quarter, quota_cents) values
  ('11111111-1111-1111-1111-111111111111', '2026-Q2', 50000000),  -- Shaun  $500k
  ('22222222-2222-2222-2222-222222222222', '2026-Q2', 45000000),  -- Priya  $450k
  ('33333333-3333-3333-3333-333333333333', '2026-Q2', 50000000),  -- Marcos $500k
  ('44444444-4444-4444-4444-444444444444', '2026-Q2', 47500000);  -- Jen    $475k
