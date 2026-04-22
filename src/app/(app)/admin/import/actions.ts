"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";

type Row = {
  parentCompany: string;
  childCompany: string;
  linkedinAccountId: string;
  last7dSpendCents: number;
  qtdSpendCents: number;
};

export async function commitImport(payload: {
  fileName: string;
  rows: Row[];
  warnings: number;
}) {
  const { userId } = await getUserAndProfile();
  const supabase = await createClient();

  const syncedAt = new Date().toISOString();

  // Unique parent names → upsert (scoped to the uploading user)
  const parentNames = [...new Set(payload.rows.map((r) => r.parentCompany))];
  const { data: parents, error: pErr } = await supabase
    .from("parent_companies")
    .upsert(
      parentNames.map((name) => ({ name, owner_user_id: userId })),
      { onConflict: "owner_user_id,name", ignoreDuplicates: false },
    )
    .select("id, name");
  if (pErr) return { error: `parents: ${pErr.message}` };
  const parentIdByName = new Map((parents ?? []).map((p) => [p.name, p.id]));

  // Handle any parents that existed but weren't returned
  const missingParents = parentNames.filter((n) => !parentIdByName.has(n));
  if (missingParents.length) {
    const { data: existing } = await supabase
      .from("parent_companies")
      .select("id, name")
      .eq("owner_user_id", userId)
      .in("name", missingParents);
    (existing ?? []).forEach((p) => parentIdByName.set(p.name, p.id));
  }

  // Unique (parent, child) → upsert child companies (scoped to uploader)
  const childPairs = [
    ...new Map(
      payload.rows.map((r) => [
        `${r.parentCompany}::${r.childCompany}`,
        {
          parent_company_id: parentIdByName.get(r.parentCompany)!,
          name: r.childCompany,
          owner_user_id: userId,
        },
      ]),
    ).values(),
  ];
  if (childPairs.length) {
    const { error: cErr } = await supabase
      .from("child_companies")
      .upsert(childPairs, {
        onConflict: "owner_user_id,parent_company_id,name",
        ignoreDuplicates: true,
      });
    if (cErr) return { error: `children: ${cErr.message}` };
  }
  const { data: allChildren } = await supabase
    .from("child_companies")
    .select("id, name, parent_company_id")
    .eq("owner_user_id", userId)
    .in("parent_company_id", [...parentIdByName.values()]);
  const childIdByKey = new Map(
    (allChildren ?? []).map((c) => [`${c.parent_company_id}::${c.name}`, c.id]),
  );

  // Upsert ad accounts — overwrite spend + sync timestamp (per-uploader)
  const accountRows = payload.rows.map((r) => {
    const parentId = parentIdByName.get(r.parentCompany)!;
    const childId = childIdByKey.get(`${parentId}::${r.childCompany}`) ?? null;
    return {
      linkedin_account_id: r.linkedinAccountId,
      parent_company_id: parentId,
      child_company_id: childId,
      owner_user_id: userId,
      last_7d_spend_cents: r.last7dSpendCents,
      qtd_spend_cents: r.qtdSpendCents,
      last_synced_at: syncedAt,
    };
  });
  const { error: aErr } = await supabase
    .from("ad_accounts")
    .upsert(accountRows, { onConflict: "owner_user_id,linkedin_account_id" });
  if (aErr) return { error: `accounts: ${aErr.message}` };

  await supabase.from("csv_imports").insert({
    uploaded_by: userId,
    file_name: payload.fileName,
    row_count: payload.rows.length,
    status: payload.warnings > 0 ? "partial" : "success",
  });

  return { ok: true, imported: payload.rows.length };
}
