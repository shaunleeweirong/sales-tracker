# Spreadsheet blueprint

The script's **Setup tabs (first-time)** menu item creates every tab and formula for you. This document exists mainly to describe the schema and explain what each tab does. You shouldn't need to paste formulas by hand.

## Tabs

### Data tabs (you type or import into these)

| Tab | Columns |
|---|---|
| `ParentCompanies` | `name`, `target_revenue` |
| `AdAccounts` | `linkedin_account_id`, `parent_company_name`, `last_7d_spend`, `qtd_spend`, `last_synced_at` |
| `Opportunities` | `name`, `linkedin_account_id`, `forecasted_pipeline`, `probability_pct`, `expected_close_date`, `notes`, `go_to_market_notes`, `roles_and_responsibilities` |
| `Quotas` | `quarter`, `quota` |

Keys are **natural** — `parent_company_name` matches a row in ParentCompanies.name, `linkedin_account_id` matches an AdAccounts row. No hidden UUIDs, no `id` columns to worry about.

**Rules to keep the app sane:**
- Money fields are **whole dollars** (e.g. `500000` = $500,000). Decimals work (e.g. `409.21`) but get rounded for display.
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
| `B4` (Quota) | `=IFERROR(VLOOKUP(B1,Quotas!A:B,2,FALSE),0)` |
| `B5` (QTD revenue) | `=SUM(AdAccounts!D:D)` |
| `B6` (Daily run rate) | `=IFERROR(ROUND(SUM(AdAccounts!C:C)/7),0)` |
| `B7` (Projected EOQ) | `=B5+B6*B2` |
| `B8` (Pace %) | `=IF(B4=0,,ROUND(100*B7/B4,1))` |
| `B10` (Weighted pipeline) | `=IFERROR(ROUND(SUMPRODUCT(Opportunities!C2:C,Opportunities!D2:D)/100),0)` |
| `B11` (Weighted vs quota %) | `=IF(B4=0,,ROUND(100*B10/B4,1))` |

The `$1,234` display strings in column C use native `TEXT` — no dependency on any custom function. Note: the `/100` in `B10` is probability conversion (e.g. 75 → 0.75), not a unit conversion.

## Explorer columns

- **Name** — indented by depth (company / ad account / opportunity)
- **Detail** — at company: ad-account count; at ad account: opp count + 7d spend + daily run rate; at opp: blank
- **QTD / Forecast** — QTD spend at the first two levels; forecast at opp level. If an ad account's QTD exceeds what's covered by 100%-probability opps, you'll see `⚠ only $Xk at 100%` appended.
- **Weighted** — rolled up at each level
- **Target Revenue** — company's revenue target as a dollar amount (blank at ad-account / opp rows)
- **% of Revenue to Target** — company QTD ad spend ÷ Target Revenue, e.g. `191%` (blank if no target set)
- **Probability** — opportunity's probability bucket (blank at company / ad-account rows)
- **Close** — opportunity's expected close date

Rebuild is **idempotent** — run it any time after adding/editing data.

## Optional: conditional formatting on Explorer

1. Column F (% of Revenue to Target) below 100%:
   - Range: `Explorer!F:F`
   - Custom formula: `=AND(ISNUMBER(SEARCH("%", F1)), VALUE(SUBSTITUTE(F1,"%",""))<100)` → red text
2. Column C contains `⚠`:
   - Range: `Explorer!C:C`
   - Custom formula: `=REGEXMATCH(C1, "⚠")` → orange text
