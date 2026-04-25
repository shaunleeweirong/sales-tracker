# Spreadsheet blueprint

The script's **Setup tabs (first-time)** menu item creates every tab and formula for you. This document exists mainly to describe the schema and explain what each tab does. You shouldn't need to paste formulas by hand.

## Tabs

### Data tabs (you type or import into these)

| Tab | Columns |
|---|---|
| `ParentCompanies` | `name`, `target_revenue_cents` |
| `AdAccounts` | `linkedin_account_id`, `parent_company_name`, `last_7d_spend_cents`, `qtd_spend_cents`, `last_synced_at` |
| `Opportunities` | `name`, `linkedin_account_id`, `forecasted_pipeline_cents`, `probability_pct`, `expected_close_date`, `notes`, `go_to_market_notes`, `roles_and_responsibilities` |
| `Quotas` | `quarter`, `quota_cents` |

Keys are **natural** — `parent_company_name` matches a row in ParentCompanies.name, `linkedin_account_id` matches an AdAccounts row. No hidden UUIDs, no `id` columns to worry about.

**Rules to keep the app sane:**
- Money fields are **integer cents** (e.g. `50000000` = $500,000).
- `probability_pct` must be one of `5, 10, 25, 50, 75, 90, 100`.
- `expected_close_date` is `YYYY-MM-DD` text.
- `quarter` is `YYYY-Q1/2/3/4` text (e.g. `2026-Q2`).
- If you rename a parent company, update every `parent_company_name` in `AdAccounts` that references the old name (Find & Replace works fine).

### Derived tabs (populated automatically)

| Tab | How it's populated |
|---|---|
| `Pipeline` | Single `QUERY` formula in `A1`. Groups opportunities by probability bucket (5/10/25/50/75/90/100), sums forecast + weighted amounts. |
| `Dashboard` | Native formulas (no custom functions, no auth required). Shows quarter, days remaining, quota, QTD revenue, daily run rate, projected EOQ, pace vs quota, weighted pipeline. |
| `Explorer` | Rewritten by the `rebuildExplorer` script. Shows Company → Ad Account → Opportunity tree with collapsible row groups. |

Do **not** type into the derived tabs — run **Sales Tracker → Lock computed tabs** after setup to get a warning prompt if you try.

## Dashboard formulas (reference only — the script writes these)

| Cell | Formula |
|---|---|
| `B1` (Quarter) | `=YEAR(TODAY())&"-Q"&(INT((MONTH(TODAY())-1)/3)+1)` |
| `B2` (Days remaining) | `=DATE(YEAR(TODAY()),(INT((MONTH(TODAY())-1)/3)+1)*3+1,0)-TODAY()+1` |
| `B4` (Quota cents) | `=IFERROR(VLOOKUP(B1,Quotas!A:B,2,FALSE),0)` |
| `B5` (QTD revenue cents) | `=SUM(AdAccounts!D:D)` |
| `B6` (Daily run rate cents) | `=IFERROR(ROUND(SUM(AdAccounts!C:C)/7),0)` |
| `B7` (Projected EOQ cents) | `=B5+B6*B2` |
| `B8` (Pace %) | `=IF(B4=0,,ROUND(100*B7/B4,1))` |
| `B10` (Weighted pipeline cents) | `=IFERROR(ROUND(SUMPRODUCT(Opportunities!C2:C,Opportunities!D2:D)/100),0)` |
| `B11` (Weighted vs quota %) | `=IF(B4=0,,ROUND(100*B10/B4,1))` |

The `$1,234` display strings in column C use native `TEXT` — no dependency on any custom function.

## Explorer columns

- **Name** — indented by depth (company / ad account / opportunity)
- **Detail** — at company: ad-account count; at ad account: opp count + 7d spend + daily run rate; at opp: blank
- **QTD / Forecast** — QTD spend at the first two levels; forecast at opp level. If an ad account's QTD exceeds what's covered by 100%-probability opps, you'll see `⚠ only $Xk at 100%` appended.
- **Weighted** — rolled up at each level
- **Target / Prob** — company's target & % achieved; opp's probability
- **Close** — opportunity's expected close date

Rebuild is **idempotent** — run it any time after adding/editing data.

## Optional: conditional formatting on Explorer

1. Column E contains `% of target` below 100%:
   - Range: `Explorer!E:E`
   - Custom formula: `=AND(ISNUMBER(SEARCH("%", E1)), VALUE(IFERROR(REGEXEXTRACT(E1, "(\d+)% of target"),"200"))<100)` → red text
2. Column C contains `⚠`:
   - Range: `Explorer!C:C`
   - Custom formula: `=REGEXMATCH(C1, "⚠")` → orange text
