# Sales Tracker — Google Sheets edition

A port of the Next.js sales-tracker app to a single Google Sheet + Apps Script. Same numbers, far less infrastructure. Intended for solo use.

## What it does

- Keeps a list of parent companies, child companies, ad accounts, and opportunities
- Imports ad spend and opportunity CSVs with the same column-alias tolerance as the web app
- Shows a pipeline breakdown by probability bucket (5/10/25/50/75/90/100)
- Shows a dashboard with quota, QTD revenue, daily run rate, projected end-of-quarter revenue, pacing vs quota, and weighted open pipeline
- Shows an **Explorer** tree view: Company → Ad Account → Opportunity, with collapsible rows and aggregate rollups at each level (rebuilt on demand via the menu)

## One-time setup (~2 minutes)

1. **Create a blank Google Sheet** in your Drive.
2. **Open Extensions → Apps Script.** Paste the contents of `Code.gs` into the editor, replacing any default. Save (⌘S / Ctrl-S). Close the Apps Script tab.
3. **Reload the spreadsheet.** A new "Sales Tracker" menu appears next to Help.
4. **Run Sales Tracker → Setup tabs (first-time).** All 7 tabs are created automatically with the correct headers and formulas.
5. **Run Sales Tracker → Lock computed tabs.** Adds a warning prompt if you try to edit Pipeline, Dashboard, or Explorer.
6. **Set your quota.** On the `Quotas` tab, add a row like `2026-Q2 | 500000` (whole dollars).

## Daily use

### Importing ad spend
1. Export a CSV from LinkedIn Campaign Manager (or wherever). Required columns: parent company, LinkedIn ad account id. Recommended: last 7d spend, QTD spend, child/brand.
2. Click **Sales Tracker → Import ad spend CSV…**, pick the file, click Import.
3. Rows are upserted by `linkedin_account_id`. Parent/child companies are auto-created if new.

### Adding opportunities
**By hand:** add a row to the `Opportunities` tab. Columns: `name`, `linkedin_account_id` (must already exist in `AdAccounts`), `forecasted_pipeline`, `probability_pct` (one of 5/10/25/50/75/90/100), `expected_close_date` (`YYYY-MM-DD`), and optional free-text notes.

**By CSV:** **Sales Tracker → Import opportunities CSV…**. Required columns: name, linkedin ad account id, probability. The LinkedIn ad account must already exist in `AdAccounts`.

### Checking your numbers
Open the `Dashboard` tab. Everything recomputes automatically.

### Exploring the tree
Open the `Explorer` tab and click **Sales Tracker → Rebuild Explorer** whenever you want a fresh snapshot (after imports, after adding opps, etc.). Click the `+/−` toggles in the row gutter to expand/collapse each company or ad account. The rebuild is safe to run as often as you like.

### Auto-managed "Confirmed QTD spend" opportunities
Each rebuild also syncs the Opportunities tab so every AdAccount with `qtd_spend > 0` has one 100%-probability opp named **"Confirmed QTD spend"** whose `forecasted_pipeline` matches the current `qtd_spend`. This is what keeps the Explorer's ⚠ coverage warnings in check — confirmed money already spent is treated as closed-won. Don't rename these rows; the script finds them by name + linkedin_account_id and overwrites forecast/probability/close-date on every sync. You can edit `notes`, `go_to_market_notes`, and `roles_and_responsibilities` freely — those are preserved. If you want to retire one (e.g. the ad account is gone), delete the row by hand; the script never deletes.

## Sample CSVs

See `sample-csv/ad-spend.csv` and `sample-csv/opportunities.csv` for correct header names and a row or two of example data. Header matching is forgiving — aliases like "Account ID", "Forecast USD", "Target Close" all work (see `Code.gs` for the full alias list).

## Migrating data from the existing app (optional)

If you've accumulated real data in the Supabase-backed app and want to carry it over, run these from the project root against your local Supabase (the container must be running — `supabase start`). The exports use natural keys so they slot straight into the Sheets schema:

```bash
mkdir -p google-sheets/data
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
\copy (select name, round(target_revenue_cents/100.0)::bigint as target_revenue from parent_companies) to 'google-sheets/data/parent_companies.csv' with csv header
\copy (select a.linkedin_account_id, pc.name as parent_company_name, round(a.last_7d_spend_cents/100.0)::bigint as last_7d_spend, round(a.qtd_spend_cents/100.0)::bigint as qtd_spend, a.last_synced_at from ad_accounts a join parent_companies pc on pc.id = a.parent_company_id) to 'google-sheets/data/ad_accounts.csv' with csv header
\copy (select o.name, a.linkedin_account_id, round(o.forecasted_pipeline_cents/100.0)::bigint as forecasted_pipeline, o.probability_pct, o.expected_close_date, o.notes, o.go_to_market_notes, o.roles_and_responsibilities from opportunities o join ad_accounts a on a.id = o.ad_account_id) to 'google-sheets/data/opportunities.csv' with csv header
\copy (select quarter, round(quota_cents/100.0)::bigint as quota from user_quotas) to 'google-sheets/data/quotas.csv' with csv header
SQL
```

Then in each sheet tab: File → Import → Upload → pick the CSV → "Append to current sheet". Skip this step if you're starting fresh.

## Known limits vs the web app (all by design)

- **No auth / RLS.** Sharing this sheet with someone gives them everything. Solo use only.
- **No referential integrity.** Deleting a company won't cascade; orphaned ids are your responsibility.
- **No opportunity form.** You type rows directly or import CSV.
- **No LinkedIn API sync.** CSV only, same as the web app.
- **History.** Google's built-in version history only — no row-level audit log.

## Troubleshooting

- **"Sales Tracker" menu missing** → reload the sheet (Cmd-R). Apps Script menus only appear after `onOpen` fires.
- **"Missing required columns" on import** → your CSV is missing one of the required headers. The aliases are in `Code.gs` — extend them if your export uses a different name.
- **Dashboard shows 0 everywhere** → make sure `currentQuarterLabel()` and `daysRemainingInQuarter()` aren't returning `#NAME?`. If they are, the script didn't save or you forgot to reload the sheet.
- **Custom function `daysRemainingInQuarter()` returns 1 day off** → custom functions are cached. Edit the formula and re-enter it to force recompute.
