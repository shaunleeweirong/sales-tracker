"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import type { ParsedOppRow } from "@/lib/opp-import";

type Row = Omit<ParsedOppRow, "rowIndex"> & { rowIndex: number };

export async function commitOppImport(payload: { rows: Row[] }) {
  const { userId } = await getUserAndProfile();
  const supabase = await createClient();

  const errors: { rowIndex: number; message: string }[] = [];
  const warnings: { rowIndex: number; message: string }[] = [];

  // Resolve ad accounts for this user
  const acctIds = [...new Set(payload.rows.map((r) => r.linkedinAccountId))];
  const { data: accounts, error: accErr } = await supabase
    .from("ad_accounts")
    .select("id, linkedin_account_id, parent_company_id")
    .eq("owner_user_id", userId)
    .in("linkedin_account_id", acctIds);
  if (accErr) return { error: `accounts: ${accErr.message}` };
  const acctByLinkedin = new Map(
    (accounts ?? []).map((a) => [
      a.linkedin_account_id,
      { id: a.id, parentId: a.parent_company_id },
    ]),
  );

  // Resolve optional owners by name (case-insensitive match on profiles.full_name)
  const ownerNames = [
    ...new Set(
      payload.rows.map((r) => r.ownerName).filter((n): n is string => Boolean(n)),
    ),
  ];
  const ownerIdByName = new Map<string, string>();
  if (ownerNames.length) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name");
    (profs ?? []).forEach((p) => {
      if (p.full_name) ownerIdByName.set(p.full_name.toLowerCase(), p.id);
    });
  }

  const inserts: Array<{
    name: string;
    ad_account_id: string;
    parent_company_id: string;
    forecasted_pipeline_cents: number;
    probability_pct: number;
    expected_close_date: string | null;
    owner_user_id: string | null;
    go_to_market_notes: string | null;
    roles_and_responsibilities: string | null;
    notes: string | null;
  }> = [];

  for (const r of payload.rows) {
    const acct = acctByLinkedin.get(r.linkedinAccountId);
    if (!acct) {
      errors.push({
        rowIndex: r.rowIndex,
        message: `Ad account ${r.linkedinAccountId} not found — import spend first`,
      });
      continue;
    }
    let ownerId = userId;
    if (r.ownerName) {
      const found = ownerIdByName.get(r.ownerName.toLowerCase());
      if (found) {
        ownerId = found;
      } else {
        warnings.push({
          rowIndex: r.rowIndex,
          message: `Owner "${r.ownerName}" not found — defaulted to you`,
        });
      }
    }
    inserts.push({
      name: r.name,
      ad_account_id: acct.id,
      parent_company_id: acct.parentId,
      forecasted_pipeline_cents: r.forecastedCents,
      probability_pct: r.probabilityPct,
      expected_close_date: r.expectedCloseDate,
      owner_user_id: ownerId,
      go_to_market_notes: r.goToMarketNotes,
      roles_and_responsibilities: r.rolesAndResponsibilities,
      notes: r.notes,
    });
  }

  if (inserts.length) {
    const { error: insErr } = await supabase.from("opportunities").insert(inserts);
    if (insErr) return { error: `opportunities: ${insErr.message}` };
  }

  return {
    ok: true,
    imported: inserts.length,
    skipped: errors.length,
    errors,
    warnings,
  };
}
