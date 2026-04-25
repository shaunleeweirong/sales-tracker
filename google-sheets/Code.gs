/**
 * Sales Tracker — Apps Script backing a single Google Sheet.
 *
 * Schema uses natural keys (no UUIDs):
 *   ParentCompanies:  name | target_revenue_cents
 *   AdAccounts:       linkedin_account_id | parent_company_name | last_7d_spend_cents | qtd_spend_cents | last_synced_at
 *   Opportunities:    name | linkedin_account_id | forecasted_pipeline_cents | probability_pct | expected_close_date | notes | go_to_market_notes | roles_and_responsibilities
 *   Quotas:           quarter | quota_cents
 * Derived (formula/script): Pipeline, Dashboard, Explorer
 *
 * Setup: Extensions → Apps Script → paste this file → save → reload sheet.
 */

// ─── Sheet names ────────────────────────────────────────────────────────────
const SHEETS = {
  PARENT: 'ParentCompanies',
  ADS: 'AdAccounts',
  OPPS: 'Opportunities',
  QUOTAS: 'Quotas',
  PIPELINE: 'Pipeline',
  DASHBOARD: 'Dashboard',
  EXPLORER: 'Explorer',
};

const PROBABILITY_BUCKETS = [5, 10, 25, 50, 75, 90, 100];

// ─── Menu ───────────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sales Tracker')
    .addItem('Setup tabs (first-time)', 'setupTabs')
    .addItem('Reset & recreate tabs', 'resetAllTabs')
    .addSeparator()
    .addItem('Import ad spend CSV…', 'showAdSpendDialog')
    .addItem('Import opportunities CSV…', 'showOppsDialog')
    .addSeparator()
    .addItem('Rebuild Explorer', 'rebuildExplorer')
    .addItem('Lock computed tabs', 'lockComputedTabs')
    .addItem('Check sheet structure', 'verifySheets')
    .addToUi();
}

// ─── Custom sheet functions (kept for back-compat; Dashboard no longer uses them) ──

/** @customfunction */
function currentQuarterLabel(asOf) {
  const d = asOf instanceof Date ? asOf : new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return d.getFullYear() + '-Q' + q;
}

/** @customfunction */
function daysRemainingInQuarter(asOf) {
  const d = asOf instanceof Date ? asOf : new Date();
  const startMonth = Math.floor(d.getMonth() / 3) * 3;
  const end = new Date(d.getFullYear(), startMonth + 3, 0);
  const ms = end.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round(ms / 86400000) + 1);
}

/** @customfunction */
function centsToUsd(cents) {
  if (cents == null || cents === '') return '';
  const n = Number(cents) / 100;
  return '$' + Math.round(n).toLocaleString('en-US');
}

// ─── CSV parsing helpers ────────────────────────────────────────────────────

function normalize_(s) {
  return String(s || '').trim().toLowerCase().replace(/[_\s]+/g, ' ');
}

function mapHeaders_(headers, aliases) {
  const normalized = headers.map(normalize_);
  const out = {};
  Object.keys(aliases).forEach(function (key) {
    const match = aliases[key].find(function (a) { return normalized.indexOf(a) >= 0; });
    out[key] = match ? normalized.indexOf(match) : -1;
  });
  return out;
}

function parseCurrencyToCents_(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase() === 'n/a') return null;
  const negative = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[$,\s()]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * (negative ? -1 : 1) * 100);
}

function parseDate_(raw) {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (t === '') return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return m[3] + '-' + pad2_(m[1]) + '-' + pad2_(m[2]);
  return null;
}
function pad2_(s) { return String(s).padStart(2, '0'); }

function snapProbability_(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/%/g, '').trim());
  if (!isFinite(n)) return null;
  if (PROBABILITY_BUCKETS.indexOf(n) >= 0) return n;
  let nearest = PROBABILITY_BUCKETS[0];
  let best = Math.abs(n - nearest);
  PROBABILITY_BUCKETS.forEach(function (b) {
    const diff = Math.abs(n - b);
    if (diff < best) { best = diff; nearest = b; }
  });
  return nearest;
}

// ─── Import dialogs ─────────────────────────────────────────────────────────

function showAdSpendDialog() { showUploadDialog_('ad-spend', 'Import ad spend CSV'); }
function showOppsDialog()     { showUploadDialog_('opps',     'Import opportunities CSV'); }

function showUploadDialog_(kind, title) {
  const html = HtmlService.createHtmlOutput(
    '<style>body{font:13px -apple-system,Segoe UI,sans-serif;padding:16px}' +
    'button{margin-top:12px;padding:8px 14px;cursor:pointer}' +
    '#log{margin-top:10px;color:#333;white-space:pre-wrap;max-height:280px;overflow:auto;font:12px ui-monospace,Menlo,monospace}</style>' +
    '<p>Pick a CSV file exported from LinkedIn Campaign Manager or your CRM.</p>' +
    '<input type="file" id="f" accept=".csv,text/csv">' +
    '<div id="log"></div>' +
    '<button onclick="send()">Import</button>' +
    '<script>' +
    'function send(){var f=document.getElementById("f").files[0];' +
    'if(!f){document.getElementById("log").innerText="Pick a file first.";return;}' +
    'document.getElementById("log").innerText="Reading…";' +
    'var r=new FileReader();r.onload=function(e){' +
    'google.script.run.withSuccessHandler(function(res){' +
    'document.getElementById("log").innerText=res;}).withFailureHandler(function(err){' +
    'document.getElementById("log").innerText="Error: "+err.message;})' +
    '.handleCsvUpload("' + kind + '",e.target.result);};r.readAsText(f);}' +
    '</script>',
  ).setWidth(540).setHeight(440);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}

function formatImportResult_(summary, warnings) {
  if (!warnings || !warnings.length) return summary;
  const lines = warnings.slice(0, 30).map(function (w) {
    return '  Row ' + w.row + ' [' + w.level + ']: ' + w.message;
  });
  let extra = '\n\n' + warnings.length + ' message(s):\n' + lines.join('\n');
  if (warnings.length > 30) extra += '\n  …and ' + (warnings.length - 30) + ' more.';
  return summary + extra;
}

function handleCsvUpload(kind, text) {
  const rows = Utilities.parseCsv(text);
  if (!rows.length) throw new Error('CSV is empty');
  const headers = rows[0];
  const body = rows.slice(1).map(function (r) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = r[i]; });
    return obj;
  });
  if (kind === 'ad-spend') return importAdSpend_(headers, body);
  if (kind === 'opps')     return importOpps_(headers, body);
  throw new Error('Unknown import kind: ' + kind);
}

// ─── Ad-spend import (natural keys) ─────────────────────────────────────────

function importAdSpend_(headers, rawRows) {
  const aliases = {
    parentCompany: ['parent company', 'parent account', 'parent', 'client', 'parent co'],
    linkedinAccountId: ['linkedin ad account id', 'linkedin account id', 'ad account id', 'account id', 'account'],
    last7dSpendCents: ['last 7 days spend', 'last 7d spend', 'sum l7d spend', '7 day spend', '7d spend', 'last 7 days', '7-day spend'],
    qtdSpendCents: ['qtd spend', 'qtd', 'quarter to date spend', 'quarter to date'],
  };
  const cols = mapHeaders_(headers, aliases);
  if (cols.parentCompany < 0 || cols.linkedinAccountId < 0) {
    throw new Error('Missing required columns: parent company, linkedin account id');
  }

  const parentSheet = ensureSheet_(SHEETS.PARENT, ['name', 'target_revenue_cents']);
  const adSheet = ensureSheet_(SHEETS.ADS, ['linkedin_account_id', 'parent_company_name', 'last_7d_spend_cents', 'qtd_spend_cents', 'last_synced_at']);

  const parents = indexBy_(parentSheet, 'name');
  const ads = indexBy_(adSheet, 'linkedin_account_id');

  let lastParent = '';
  let inserted = 0, updated = 0, skipped = 0;
  const warnings = [];
  const now = new Date();

  rawRows.forEach(function (r, i) {
    const rowNum = i + 2; // +1 header, +1 1-based
    const rawParent = String(r[headers[cols.parentCompany]] || '').trim();
    const linkedin = String(r[headers[cols.linkedinAccountId]] || '').trim();

    const pNorm = rawParent.toLowerCase();
    if (pNorm === 'grand total' || pNorm === 'total') return;

    if (rawParent) lastParent = rawParent;
    const parentName = rawParent || lastParent;
    if (!parentName) { skipped++; warnings.push({ row: rowNum, level: 'error', message: 'Missing parent company — row skipped' }); return; }
    if (!linkedin) { skipped++; warnings.push({ row: rowNum, level: 'error', message: 'Missing linkedin account id — row skipped' }); return; }

    if (!parents[parentName]) {
      parentSheet.appendRow([parentName, '']);
      parents[parentName] = { rowIndex: parentSheet.getLastRow(), name: parentName };
      warnings.push({ row: rowNum, level: 'info', message: 'New parent company "' + parentName + '" auto-created' });
    }

    const last7Raw = cols.last7dSpendCents >= 0 ? r[headers[cols.last7dSpendCents]] : '';
    const qtdRaw   = cols.qtdSpendCents    >= 0 ? r[headers[cols.qtdSpendCents]]    : '';
    const last7 = parseCurrencyToCents_(last7Raw);
    const qtd   = parseCurrencyToCents_(qtdRaw);
    if (last7 == null && String(last7Raw || '').trim() !== '') {
      warnings.push({ row: rowNum, level: 'warning', message: '7d spend "' + last7Raw + '" unparseable — stored as $0' });
    }
    if (qtd == null && String(qtdRaw || '').trim() !== '') {
      warnings.push({ row: rowNum, level: 'warning', message: 'QTD spend "' + qtdRaw + '" unparseable — stored as $0' });
    }
    const last7Final = Math.max(0, last7 || 0);
    const qtdFinal   = Math.max(0, qtd   || 0);

    const existing = ads[linkedin];
    if (existing) {
      const row = existing.rowIndex;
      adSheet.getRange(row, 2).setValue(parentName);
      adSheet.getRange(row, 3).setValue(last7Final);
      adSheet.getRange(row, 4).setValue(qtdFinal);
      adSheet.getRange(row, 5).setValue(now);
      updated++;
    } else {
      adSheet.appendRow([linkedin, parentName, last7Final, qtdFinal, now]);
      ads[linkedin] = { rowIndex: adSheet.getLastRow(), linkedin_account_id: linkedin, parent_company_name: parentName };
      inserted++;
    }
  });

  const summary = 'Inserted ' + inserted + ', updated ' + updated + ' ad account row(s). Skipped ' + skipped + '.';
  return formatImportResult_(summary, warnings);
}

// ─── Opportunity import (natural keys) ──────────────────────────────────────

function importOpps_(headers, rawRows) {
  const aliases = {
    name: ['name', 'opportunity', 'opportunity name', 'deal', 'deal name'],
    linkedinAccountId: ['linkedin ad account id', 'linkedin account id', 'ad account id', 'account id', 'account'],
    forecastedCents: ['forecasted pipeline', 'forecasted revenue', 'forecast', 'pipeline', 'forecasted pipeline usd', 'forecast usd', 'amount'],
    probabilityPct: ['probability', 'probability %', 'probability pct', 'prob', 'prob %'],
    expectedCloseDate: ['expected close date', 'close date', 'expected close', 'target close', 'target close date'],
    goToMarketNotes: ['go to market notes', 'go-to-market notes', 'gtm notes', 'go to market', 'gtm', 'go to market strategy notes'],
    rolesAndResponsibilities: ['roles and responsibilities', 'roles & responsibilities', 'roles', 'responsibilities', 'raci'],
    notes: ['notes', 'internal notes', 'comments'],
  };
  const cols = mapHeaders_(headers, aliases);
  if (cols.name < 0 || cols.linkedinAccountId < 0 || cols.probabilityPct < 0) {
    throw new Error('Missing required columns: name, linkedin account id, probability');
  }

  const OPP_HEADERS = [
    'name', 'linkedin_account_id', 'forecasted_pipeline_cents', 'probability_pct',
    'expected_close_date', 'notes', 'go_to_market_notes', 'roles_and_responsibilities',
  ];
  const oppsSheet = ensureSheet_(SHEETS.OPPS, OPP_HEADERS);
  const ads = indexBy_(ensureSheet_(SHEETS.ADS, []), 'linkedin_account_id');

  // Build composite-key index of existing opps: lower(name).trim() + '|' + linkedin_account_id
  const existing = {};
  const oppValues = oppsSheet.getLastRow() > 1
    ? oppsSheet.getRange(2, 1, oppsSheet.getLastRow() - 1, OPP_HEADERS.length).getValues()
    : [];
  oppValues.forEach(function (row, i) {
    const key = String(row[0] || '').trim().toLowerCase() + '|' + String(row[1] || '').trim();
    if (key !== '|') existing[key] = { rowIndex: i + 2, values: row };
  });

  let inserted = 0, updated = 0, skipped = 0;
  const warnings = [];

  rawRows.forEach(function (r, i) {
    const rowNum = i + 2;
    const name = String(r[headers[cols.name]] || '').trim();
    const acctId = String(r[headers[cols.linkedinAccountId]] || '').trim();
    const probRaw = r[headers[cols.probabilityPct]];

    if (!name && !acctId && !probRaw) return; // entirely blank row — silent skip
    if (!name)   { skipped++; warnings.push({ row: rowNum, level: 'error', message: 'Missing opportunity name — row skipped' }); return; }
    if (!acctId) { skipped++; warnings.push({ row: rowNum, level: 'error', message: 'Missing linkedin account id — row skipped' }); return; }

    const prob = snapProbability_(probRaw);
    if (prob == null) {
      skipped++;
      warnings.push({ row: rowNum, level: 'error', message: 'Probability "' + probRaw + '" unparseable — row skipped' });
      return;
    }
    if (String(prob) !== String(probRaw).replace(/%/g, '').trim()) {
      warnings.push({ row: rowNum, level: 'warning', message: 'Probability ' + probRaw + ' snapped to ' + prob + '%' });
    }
    if (!ads[acctId]) {
      skipped++;
      warnings.push({ row: rowNum, level: 'error', message: 'Ad account ' + acctId + ' not found in AdAccounts — import ad spend first' });
      return;
    }

    const forecastRaw = cols.forecastedCents >= 0 ? r[headers[cols.forecastedCents]] : '';
    const forecast = parseCurrencyToCents_(forecastRaw);
    if (forecast == null && String(forecastRaw || '').trim() !== '') {
      warnings.push({ row: rowNum, level: 'warning', message: 'Forecast "' + forecastRaw + '" unparseable — stored as $0' });
    }
    const closeRaw = cols.expectedCloseDate >= 0 ? r[headers[cols.expectedCloseDate]] : '';
    const closeDate = parseDate_(closeRaw);
    if (closeDate == null && String(closeRaw || '').trim() !== '') {
      warnings.push({ row: rowNum, level: 'warning', message: 'Close date "' + closeRaw + '" unparseable — stored as blank' });
    }
    const notes = cols.notes >= 0 ? String(r[headers[cols.notes]] || '') : '';
    const gtm   = cols.goToMarketNotes >= 0 ? String(r[headers[cols.goToMarketNotes]] || '') : '';
    const raci  = cols.rolesAndResponsibilities >= 0 ? String(r[headers[cols.rolesAndResponsibilities]] || '') : '';

    const key = name.toLowerCase() + '|' + acctId;
    const match = existing[key];

    if (match) {
      // Upsert: overwrite always-evolving fields, preserve manual notes when CSV is silent.
      const newRow = match.values.slice();
      newRow[0] = name;
      newRow[1] = acctId;
      newRow[2] = Math.max(0, forecast || 0);
      newRow[3] = prob;
      newRow[4] = closeDate || '';
      if (notes.trim() !== '') newRow[5] = notes;
      if (gtm.trim()   !== '') newRow[6] = gtm;
      if (raci.trim()  !== '') newRow[7] = raci;
      oppsSheet.getRange(match.rowIndex, 1, 1, OPP_HEADERS.length).setValues([newRow]);
      updated++;
    } else {
      const newRow = [
        name, acctId, Math.max(0, forecast || 0), prob,
        closeDate || '', notes, gtm, raci,
      ];
      oppsSheet.appendRow(newRow);
      existing[key] = { rowIndex: oppsSheet.getLastRow(), values: newRow };
      inserted++;
    }
  });

  const summary = 'Inserted ' + inserted + ', updated ' + updated + ' opportunity row(s). Skipped ' + skipped + '.';
  return formatImportResult_(summary, warnings);
}

// ─── Sheet utilities ────────────────────────────────────────────────────────

function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers && headers.length) sh.appendRow(headers);
  } else if (sh.getLastRow() === 0 && headers && headers.length) {
    sh.appendRow(headers);
  }
  return sh;
}

function indexBy_(sheet, keyCol) {
  const last = sheet.getLastRow();
  if (last < 1) return {};
  const values = sheet.getRange(1, 1, last, sheet.getLastColumn()).getValues();
  const headers = values[0];
  const keyIdx = headers.indexOf(keyCol);
  if (keyIdx < 0) return {};
  const out = {};
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const key = String(row[keyIdx]);
    if (!key) continue;
    const entry = { rowIndex: i + 1 };
    headers.forEach(function (h, j) { entry[h] = row[j]; });
    out[key] = entry;
  }
  return out;
}

// ─── One-click setup ────────────────────────────────────────────────────────

function setupTabs() {
  const ss = SpreadsheetApp.getActive();

  const dataTabs = [
    { name: SHEETS.PARENT, headers: ['name', 'target_revenue_cents'] },
    { name: SHEETS.ADS, headers: ['linkedin_account_id', 'parent_company_name', 'last_7d_spend_cents', 'qtd_spend_cents', 'last_synced_at'] },
    { name: SHEETS.OPPS, headers: ['name', 'linkedin_account_id', 'forecasted_pipeline_cents', 'probability_pct', 'expected_close_date', 'notes', 'go_to_market_notes', 'roles_and_responsibilities'] },
    { name: SHEETS.QUOTAS, headers: ['quarter', 'quota_cents'] },
  ];
  dataTabs.forEach(function (t) {
    const sh = ensureSheet_(t.name, t.headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, t.headers.length).setFontWeight('bold');
  });

  // Pipeline — single QUERY formula (uses Opportunities C=forecast, D=probability).
  const pipeline = ensureSheet_(SHEETS.PIPELINE, []);
  if (pipeline.getRange('A1').getFormula() === '' && pipeline.getRange('A1').getValue() === '') {
    pipeline.getRange('A1').setFormula(
      '=QUERY({Opportunities!D2:D, Opportunities!C2:C, ARRAYFORMULA(Opportunities!C2:C*Opportunities!D2:D/100)},' +
      '"select Col1, count(Col1), sum(Col2), sum(Col3) where Col1 is not null group by Col1 order by Col1 desc ' +
      'label Col1 \'Probability %\', count(Col1) \'Count\', sum(Col2) \'Forecast (cents)\', sum(Col3) \'Weighted (cents)\'", 0)'
    );
  }

  // Dashboard — native formulas only (no custom functions).
  const dash = ensureSheet_(SHEETS.DASHBOARD, []);
  const hasLayout = dash.getRange('A1').getValue() !== '' || dash.getRange('B1').getFormula() !== '';
  if (!hasLayout) {
    const layout = [
      ['A1', 'Quarter', null],
      ['B1', null, '=YEAR(TODAY())&"-Q"&(INT((MONTH(TODAY())-1)/3)+1)'],
      ['A2', 'Days remaining', null],
      ['B2', null, '=DATE(YEAR(TODAY()),(INT((MONTH(TODAY())-1)/3)+1)*3+1,0)-TODAY()+1'],
      ['A4', 'Quota', null],
      ['B4', null, '=IFERROR(VLOOKUP(B1,Quotas!A:B,2,FALSE),0)'],
      ['C4', null, '="$"&TEXT(ROUND(B4/100),"#,##0")'],
      ['A5', 'QTD revenue', null],
      ['B5', null, '=SUM(AdAccounts!D:D)'],
      ['C5', null, '="$"&TEXT(ROUND(B5/100),"#,##0")'],
      ['A6', 'Daily run rate', null],
      ['B6', null, '=IFERROR(ROUND(SUM(AdAccounts!C:C)/7),0)'],
      ['C6', null, '="$"&TEXT(ROUND(B6/100),"#,##0")'],
      ['A7', 'Projected EOQ', null],
      ['B7', null, '=B5+B6*B2'],
      ['C7', null, '="$"&TEXT(ROUND(B7/100),"#,##0")'],
      ['A8', 'Pace vs quota (%)', null],
      ['B8', null, '=IF(B4=0,,ROUND(100*B7/B4,1))'],
      ['A10', 'Weighted pipeline (open)', null],
      ['B10', null, '=IFERROR(ROUND(SUMPRODUCT(Opportunities!C2:C,Opportunities!D2:D)/100),0)'],
      ['C10', null, '="$"&TEXT(ROUND(B10/100),"#,##0")'],
      ['A11', 'Weighted / quota (%)', null],
      ['B11', null, '=IF(B4=0,,ROUND(100*B10/B4,1))'],
    ];
    layout.forEach(function (row) {
      const cell = dash.getRange(row[0]);
      if (row[1] != null) cell.setValue(row[1]).setFontWeight('bold');
      if (row[2] != null) cell.setFormula(row[2]);
    });
    dash.autoResizeColumns(1, 3);
  }

  ensureSheet_(SHEETS.EXPLORER, []);

  // Data validation on Opportunities for guardrails on manual entry.
  applyOpportunityValidation_();

  const def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() <= 1 && def.getLastColumn() <= 1) ss.deleteSheet(def);

  SpreadsheetApp.getUi().alert(
    'Setup complete.\n\n7 tabs ready: ParentCompanies, AdAccounts, Opportunities, Quotas, Pipeline, Dashboard, Explorer.\n\nNext: add a row to Quotas (e.g. "2026-Q2" | 50000000), then import sample CSVs via the menu.'
  );
}

// ─── Data validation on Opportunities (B = linkedin id, D = probability) ───
// Re-applies whenever setupTabs runs. Safe to call independently if you want
// to refresh the rule (e.g. after pasting a new linkedin id list).

function applyOpportunityValidation_() {
  const ss = SpreadsheetApp.getActive();
  const opps = ss.getSheetByName(SHEETS.OPPS);
  const ads = ss.getSheetByName(SHEETS.ADS);
  if (!opps || !ads) return;

  // linkedin_account_id (column B): must exist in AdAccounts!A2:A
  const linkedinRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ads.getRange('A2:A'), true)
    .setAllowInvalid(false)
    .setHelpText('Pick a LinkedIn ad account ID that already exists in the AdAccounts tab. Import ad spend first if you don\'t see your account.')
    .build();
  opps.getRange('B2:B1000').setDataValidation(linkedinRule);

  // probability_pct (column D): must be one of the allowed buckets
  const probRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(PROBABILITY_BUCKETS.map(String), true)
    .setAllowInvalid(false)
    .setHelpText('Use 5, 10, 25, 50, 75, 90, or 100.')
    .build();
  opps.getRange('D2:D1000').setDataValidation(probRule);
}

// ─── Reset & recreate (destructive) ─────────────────────────────────────────
// Wipes all Sales Tracker tabs and rebuilds them with the current schema.
// Use when migrating from an older schema (e.g. dropping ChildCompanies).

function resetAllTabs() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    'Reset all Sales Tracker tabs?',
    'This DELETES existing ParentCompanies, ChildCompanies (if present), AdAccounts, Opportunities, Quotas, Pipeline, Dashboard, and Explorer tabs — including all data in them — then recreates them with the current schema. Your Quotas rows and any data you\'ve entered will be lost. Continue?',
    ui.ButtonSet.OK_CANCEL,
  );
  if (resp !== ui.Button.OK) return;

  const ss = SpreadsheetApp.getActive();
  const toDelete = [
    SHEETS.PARENT, 'ChildCompanies', SHEETS.ADS, SHEETS.OPPS, SHEETS.QUOTAS,
    SHEETS.PIPELINE, SHEETS.DASHBOARD, SHEETS.EXPLORER,
  ];
  // Need at least one sheet present at any time — add a scratch first.
  const scratch = ss.insertSheet('_scratch_' + Date.now());
  toDelete.forEach(function (n) {
    const sh = ss.getSheetByName(n);
    if (sh) ss.deleteSheet(sh);
  });
  setupTabs();
  // Remove the scratch sheet now that real tabs exist.
  const s = ss.getSheetByName(scratch.getName());
  if (s) ss.deleteSheet(s);
}

// ─── Protection ─────────────────────────────────────────────────────────────

function lockComputedTabs() {
  const ss = SpreadsheetApp.getActive();
  const targets = [
    { name: SHEETS.PIPELINE, note: 'Generated by Sales Tracker — do not edit by hand.' },
    { name: SHEETS.DASHBOARD, note: 'Generated by Sales Tracker — do not edit by hand.' },
    { name: SHEETS.EXPLORER, note: 'Rewritten by "Rebuild Explorer" — edits will be lost.' },
  ];
  let applied = 0;
  targets.forEach(function (t) {
    const sh = ss.getSheetByName(t.name);
    if (!sh) return;
    const existing = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    existing.forEach(function (p) { if (p.getDescription() === t.note) p.remove(); });
    const protection = sh.protect().setDescription(t.note).setWarningOnly(true);
    protection.removeEditors(protection.getEditors());
    applied++;
  });
  SpreadsheetApp.getUi().alert(
    'Protected ' + applied + ' computed tab(s). You\'ll see a warning prompt before editing Pipeline, Dashboard, or Explorer.'
  );
}

function verifySheets() {
  const required = [SHEETS.PARENT, SHEETS.ADS, SHEETS.OPPS, SHEETS.QUOTAS];
  const ss = SpreadsheetApp.getActive();
  const missing = required.filter(function (n) { return !ss.getSheetByName(n); });
  const ui = SpreadsheetApp.getUi();
  if (missing.length === 0) ui.alert('All 4 data tabs present.');
  else ui.alert('Missing tabs: ' + missing.join(', ') + '\n\nRun "Setup tabs" or "Reset & recreate tabs".');
}

// ─── Explorer rebuild ───────────────────────────────────────────────────────

function rebuildExplorer() {
  const parents = readRows_(SHEETS.PARENT);
  const ads = readRows_(SHEETS.ADS);
  const opps = readRows_(SHEETS.OPPS);

  const headers = ['Name', 'Detail', 'QTD / Forecast', 'Weighted', 'Target / Prob', 'Close'];
  const sheet = ensureSheet_(SHEETS.EXPLORER, headers);

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  let guard = 0;
  while (sheet.getRowGroupDepth(2) > 0 && guard++ < 50) {
    const g = sheet.getRowGroup(2, sheet.getRowGroupDepth(2));
    if (!g) break;
    g.remove();
  }

  parents.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });

  const rows = [];
  const outerGroups = [];
  const innerGroups = [];

  parents.forEach(function (p) {
    const adsForP = ads.filter(function (a) { return a.parent_company_name === p.name; });
    const linkedinIdsForP = adsForP.map(function (a) { return a.linkedin_account_id; });
    const oppsForP = opps.filter(function (o) { return linkedinIdsForP.indexOf(o.linkedin_account_id) >= 0; });

    const companyQtd = sumField_(adsForP, 'qtd_spend_cents');
    const companyWeighted = oppsForP.reduce(function (s, o) {
      return s + (Number(o.forecasted_pipeline_cents) || 0) * (Number(o.probability_pct) || 0) / 100;
    }, 0);
    const target = Number(p.target_revenue_cents) || 0;
    const targetPct = target > 0 ? Math.round((100 * companyQtd) / target) : null;

    rows.push([
      p.name,
      adsForP.length + ' ad accounts',
      fmtCentsShort_(companyQtd) + ' QTD',
      fmtCentsShort_(companyWeighted) + ' weighted',
      target ? (fmtCentsShort_(target) + (targetPct != null ? ' · ' + targetPct + '% of target' : '')) : '—',
      '',
    ]);

    const companyChildStart = rows.length + 2;

    adsForP.sort(function (a, b) { return String(a.linkedin_account_id).localeCompare(String(b.linkedin_account_id)); });
    adsForP.forEach(function (a) {
      const oppsForA = opps.filter(function (o) { return o.linkedin_account_id === a.linkedin_account_id; });
      const adQtd = Number(a.qtd_spend_cents) || 0;
      const ad7d = Number(a.last_7d_spend_cents) || 0;
      const dailyRate = Math.round(ad7d / 7);
      const adWeighted = oppsForA.reduce(function (s, o) {
        return s + (Number(o.forecasted_pipeline_cents) || 0) * (Number(o.probability_pct) || 0) / 100;
      }, 0);
      const sumAt100 = oppsForA
        .filter(function (o) { return Number(o.probability_pct) === 100; })
        .reduce(function (s, o) { return s + (Number(o.forecasted_pipeline_cents) || 0); }, 0);
      const coverageWarning = adQtd > sumAt100 ? ' ⚠ only ' + fmtCentsShort_(sumAt100) + ' at 100%' : '';

      rows.push([
        '  ' + a.linkedin_account_id,
        oppsForA.length + ' opps · 7d ' + fmtCentsShort_(ad7d) + ' · run/day ' + fmtCentsShort_(dailyRate),
        fmtCentsShort_(adQtd) + ' QTD' + coverageWarning,
        fmtCentsShort_(adWeighted) + ' weighted',
        '',
        '',
      ]);

      const accountChildStart = rows.length + 2;

      oppsForA.sort(function (x, y) {
        return String(x.expected_close_date || '').localeCompare(String(y.expected_close_date || ''));
      });
      oppsForA.forEach(function (o) {
        const forecast = Number(o.forecasted_pipeline_cents) || 0;
        const prob = Number(o.probability_pct) || 0;
        const weighted = Math.round((forecast * prob) / 100);
        rows.push([
          '    ' + o.name,
          '',
          fmtCentsShort_(forecast) + ' forecast',
          fmtCentsShort_(weighted) + ' weighted',
          prob + '%',
          o.expected_close_date || '',
        ]);
      });

      const accountChildEnd = rows.length + 1;
      if (accountChildEnd >= accountChildStart) innerGroups.push({ start: accountChildStart, end: accountChildEnd });
    });

    const companyChildEnd = rows.length + 1;
    if (companyChildEnd >= companyChildStart) outerGroups.push({ start: companyChildStart, end: companyChildEnd });
  });

  // Unlinked opportunities — opps whose linkedin_account_id has no match in AdAccounts.
  const validIds = {};
  ads.forEach(function (a) { validIds[String(a.linkedin_account_id)] = true; });
  const orphans = opps.filter(function (o) { return !validIds[String(o.linkedin_account_id)]; });
  if (orphans.length) {
    rows.push([
      'Unlinked opportunities',
      orphans.length + ' opp(s) — fix the linkedin_account_id to link',
      '',
      '',
      '',
      '',
    ]);
    const orphanStart = rows.length + 2;
    orphans.sort(function (x, y) { return String(x.name || '').localeCompare(String(y.name || '')); });
    orphans.forEach(function (o) {
      const forecast = Number(o.forecasted_pipeline_cents) || 0;
      const prob = Number(o.probability_pct) || 0;
      const weighted = Math.round((forecast * prob) / 100);
      rows.push([
        '  ' + (o.name || '(unnamed)'),
        'linkedin id: ' + (o.linkedin_account_id || '(blank)'),
        fmtCentsShort_(forecast) + ' forecast',
        fmtCentsShort_(weighted) + ' weighted',
        prob + '%',
        o.expected_close_date || '',
      ]);
    });
    const orphanEnd = rows.length + 1;
    if (orphanEnd >= orphanStart) outerGroups.push({ start: orphanStart, end: orphanEnd });
  }

  if (!rows.length) {
    SpreadsheetApp.getUi().alert('No data yet — import ad spend and opportunities first.');
    return;
  }

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  outerGroups.forEach(function (g) {
    sheet.getRange(g.start, 1, g.end - g.start + 1, 1).shiftRowGroupDepth(1);
  });
  innerGroups.forEach(function (g) {
    sheet.getRange(g.start, 1, g.end - g.start + 1, 1).shiftRowGroupDepth(1);
  });

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function readRows_(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const headers = values[0];
  return values.slice(1).map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function sumField_(rows, field) {
  return rows.reduce(function (s, r) { return s + (Number(r[field]) || 0); }, 0);
}

function fmtCentsShort_(cents) {
  const n = (Number(cents) || 0) / 100;
  const abs = Math.abs(n);
  if (abs >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (abs >= 1000) return '$' + Math.round(n / 1000) + 'k';
  return '$' + Math.round(n);
}
