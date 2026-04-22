# Sales Tracker

LinkedIn Ads sales tracker — quota pacing, pipeline rollups, and ad-account spend attribution for a sales team.

Built with Next.js 16 (App Router), React 19, Supabase (auth + Postgres + RLS), Tailwind v4, and shadcn/ui.

## Prerequisites

- **Node.js 20+**
- **pnpm** — the repo uses `pnpm-lock.yaml`. Enable via corepack:
  ```bash
  corepack enable
  corepack prepare pnpm@latest --activate
  ```
- **Supabase CLI** — for running the database locally and applying migrations:
  ```bash
  brew install supabase/tap/supabase
  # or: https://supabase.com/docs/guides/cli
  ```

## Setup

```bash
git clone https://github.com/shaunleeweirong/sales-tracker.git
cd sales-tracker
pnpm install
cp .env.local.example .env.local
```

### Environment variables

`.env.local` needs three Supabase values:

| Variable | Used in | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server Supabase clients | `supabase start` output or Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server Supabase clients | same |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only admin client (`src/lib/supabase/server.ts`) | same — **never expose to the browser** |

**Local dev (recommended):**
```bash
supabase start          # boots Postgres + Auth + Studio in Docker
# copy the printed API URL, anon key, and service_role key into .env.local
```

**Pointing at an existing Supabase project:**
Grab the three values from the Supabase dashboard under Project Settings → API.

### Database

```bash
supabase db reset        # applies all migrations in supabase/migrations/ and runs supabase/seed.sql
```

Migrations include the schema, row-level security policies, and reporting views (`v_rep_pacing`, `v_ad_account_forecast`, `v_opportunities_weighted`).

## Run

```bash
pnpm dev
```

Open http://localhost:3000 — unauthenticated requests redirect to `/login`. Sign up / sign in through Supabase auth, then promote your user to `admin` if you need the admin tabs (CSV import, quotas, teams).

## Scripts

```bash
pnpm dev          # Next.js dev server
pnpm build        # production build
pnpm start        # run production build
pnpm lint         # ESLint
pnpm exec vitest  # run the Vitest suite in src/lib/__tests__
```

## Project structure

```
src/
  app/
    (app)/            # authenticated app (dashboard, companies, opportunities, explorer, admin)
    login/            # public auth page
    layout.tsx        # root layout
  components/         # shared UI + shadcn/ui primitives
  lib/                # forecast math, Supabase clients, CSV import, quarter helpers
  proxy.ts            # Next.js middleware — refreshes the Supabase session on every request
  types/db.ts         # generated Supabase types
supabase/
  migrations/         # schema, views, RLS policies
  seed.sql            # sample data
```

## Deployment

Configured for Vercel (see `vercel.json`). Set the same three Supabase env vars in the Vercel project's environment settings.
