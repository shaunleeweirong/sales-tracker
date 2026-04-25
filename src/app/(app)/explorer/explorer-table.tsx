"use client";

import { useMemo, useState, useTransition, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Building2, Target, AlertTriangle, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents, formatCentsAbbrev } from "@/lib/forecast";
import { cn } from "@/lib/utils";
import { updateTarget } from "../companies/actions";
import { toast } from "sonner";
import { QuickNewOppDialog } from "./quick-new-opp-dialog";

type Company = { id: string; name: string; target_revenue_cents: number | null };
type Account = {
  id: string;
  linkedin_account_id: string;
  parent_company_id: string;
  child_company_id: string | null;
  last_7d_spend_cents: number;
  daily_run_rate_cents: number;
  qtd_spend_cents: number;
  projected_eoq_spend_cents: number;
};
type Opp = {
  id: string;
  name: string;
  probability_pct: number;
  forecasted_pipeline_cents: number;
  weighted_pipeline_cents: number;
  expected_close_date: string | null;
  parent_company_id: string;
  ad_account_id: string;
  owner_user_id: string | null;
};
type ChildCo = { id: string; name: string };
type Profile = { id: string; full_name: string | null };

export function ExplorerTable({
  companies,
  accounts,
  opps,
  childCompanies,
  profiles,
  selfUserId,
}: {
  companies: Company[];
  accounts: Account[];
  opps: Opp[];
  childCompanies: ChildCo[];
  profiles: Profile[];
  selfUserId: string;
}) {
  const [openCompanies, setOpenCompanies] = useState<Set<string>>(new Set());
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const childMap = useMemo(
    () => new Map(childCompanies.map((c) => [c.id, c.name])),
    [childCompanies],
  );
  const ownerMap = useMemo(
    () =>
      new Map(profiles.map((p) => [p.id, p.full_name ?? p.id.slice(0, 6)])),
    [profiles],
  );

  const accountsByCompany = useMemo(() => {
    const m = new Map<string, Account[]>();
    for (const a of accounts) {
      (m.get(a.parent_company_id) ?? m.set(a.parent_company_id, []).get(a.parent_company_id))!.push(a);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.linkedin_account_id.localeCompare(b.linkedin_account_id));
    return m;
  }, [accounts]);

  const oppsByAccount = useMemo(() => {
    const m = new Map<string, Opp[]>();
    for (const o of opps) {
      (m.get(o.ad_account_id) ?? m.set(o.ad_account_id, []).get(o.ad_account_id))!.push(o);
    }
    for (const arr of m.values()) arr.sort((a, b) => b.probability_pct - a.probability_pct);
    return m;
  }, [opps]);

  const accountWeighted = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of opps) {
      m.set(o.ad_account_id, (m.get(o.ad_account_id) ?? 0) + o.weighted_pipeline_cents);
    }
    return m;
  }, [opps]);

  const account100pctCoverage = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of opps) {
      if (o.probability_pct === 100) {
        m.set(o.ad_account_id, (m.get(o.ad_account_id) ?? 0) + o.forecasted_pipeline_cents);
      }
    }
    return m;
  }, [opps]);

  const accountOwners = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const o of opps) {
      if (!o.owner_user_id) continue;
      if (!m.has(o.ad_account_id)) m.set(o.ad_account_id, new Set());
      m.get(o.ad_account_id)!.add(o.owner_user_id);
    }
    return m;
  }, [opps]);

  const companyRollup = useMemo(() => {
    const m = new Map<string, { qtd: number; weighted: number; accountCount: number }>();
    for (const c of companies) {
      m.set(c.id, { qtd: 0, weighted: 0, accountCount: 0 });
    }
    for (const a of accounts) {
      const r = m.get(a.parent_company_id);
      if (!r) continue;
      r.qtd += a.qtd_spend_cents;
      r.accountCount += 1;
    }
    for (const o of opps) {
      const r = m.get(o.parent_company_id);
      if (r) r.weighted += o.weighted_pipeline_cents;
    }
    return m;
  }, [companies, accounts, opps]);

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function expandAll() {
    setOpenCompanies(new Set(companies.map((c) => c.id)));
    setOpenAccounts(new Set(accounts.map((a) => a.id)));
  }
  function collapseAll() {
    setOpenCompanies(new Set());
    setOpenAccounts(new Set());
  }

  const filteredCompanies = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return companies;
    return companies.filter((c) => {
      const haystackParts: string[] = [c.name];
      for (const a of accountsByCompany.get(c.id) ?? []) {
        haystackParts.push(a.linkedin_account_id);
        if (a.child_company_id) {
          const childName = childMap.get(a.child_company_id);
          if (childName) haystackParts.push(childName);
        }
        for (const o of oppsByAccount.get(a.id) ?? []) {
          haystackParts.push(o.name);
          if (o.owner_user_id) {
            const owner = ownerMap.get(o.owner_user_id);
            if (owner) haystackParts.push(owner);
          }
        }
      }
      const haystack = haystackParts.join(" ").toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [query, companies, accountsByCompany, oppsByAccount, childMap, ownerMap]);

  const totalQtd = filteredCompanies.reduce(
    (s, c) => s + (companyRollup.get(c.id)?.qtd ?? 0),
    0,
  );
  const totalWeighted = filteredCompanies.reduce(
    (s, c) => s + (companyRollup.get(c.id)?.weighted ?? 0),
    0,
  );
  const totalAccounts = filteredCompanies.reduce(
    (s, c) => s + (accountsByCompany.get(c.id)?.length ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, ad accounts, opportunities, owners…"
            className="pl-8 h-9"
          />
        </div>
        <Button size="sm" variant="outline" onClick={expandAll}>
          Expand all
        </Button>
        <Button size="sm" variant="outline" onClick={collapseAll}>
          Collapse all
        </Button>
      </div>

      <div className="rounded-lg border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32%]">Name</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead className="text-right">
                QTD / Forecast
                <InfoTip text="QTD: actual ad spend recorded this quarter from CSV imports. Forecast: the rep's estimated deal value for this opportunity." />
              </TableHead>
              <TableHead className="text-right">
                Weighted
                <InfoTip text="Forecast × probability%. Risk-adjusted pipeline value. A $100k deal at 50% probability = $50k weighted." />
              </TableHead>
              <TableHead className="text-right">
                Target / Prob
                <InfoTip text="Target: the quarterly revenue goal set for this company. Prob: the rep's confidence this opportunity will close." />
              </TableHead>
              <TableHead>Owner / Close</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCompanies.map((c) => {
              const rollup = companyRollup.get(c.id)!;
              const target = c.target_revenue_cents;
              const pctToTarget =
                target && target > 0 ? Math.round((100 * rollup.weighted) / target) : null;
              const companyOpen = openCompanies.has(c.id);
              const companyAccounts = accountsByCompany.get(c.id) ?? [];

              return (
                <RowGroup key={c.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-accent/40 font-medium"
                    onClick={() => toggle(openCompanies, c.id, setOpenCompanies)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            companyOpen && "rotate-90",
                          )}
                        />
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rollup.accountCount} ad account{rollup.accountCount === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentsAbbrev(rollup.qtd)} QTD
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentsAbbrev(rollup.weighted)} weighted
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <InlineTargetEditor parentId={c.id} currentCents={target} />
                      {pctToTarget != null && (
                        <div
                          className={cn(
                            "text-xs mt-0.5",
                            pctToTarget >= 100
                              ? "text-emerald-600"
                              : pctToTarget >= 80
                                ? "text-amber-600"
                                : "text-rose-600",
                          )}
                        >
                          {pctToTarget}% of target
                        </div>
                      )}
                    </TableCell>
                    <TableCell />
                  </TableRow>

                  {companyOpen &&
                    companyAccounts.map((a) => {
                      const accountOpen = openAccounts.has(a.id);
                      const accountOpps = oppsByAccount.get(a.id) ?? [];
                      return (
                        <RowGroup key={a.id}>
                          {(() => {
                            const coverage = account100pctCoverage.get(a.id) ?? 0;
                            const qtdUncovered = a.qtd_spend_cents > 0 && coverage < a.qtd_spend_cents;
                            const acctWeighted = accountWeighted.get(a.id) ?? 0;
                            return (
                              <TableRow
                                className="cursor-pointer hover:bg-accent/30 bg-muted/20"
                                onClick={() => toggle(openAccounts, a.id, setOpenAccounts)}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2 pl-6">
                                    <ChevronRight
                                      className={cn(
                                        "h-4 w-4 text-muted-foreground transition-transform",
                                        accountOpen && "rotate-90",
                                      )}
                                    />
                                    <span className="font-mono text-sm">
                                      {a.linkedin_account_id}
                                    </span>
                                    {a.child_company_id && (
                                      <Badge variant="secondary" className="text-xs">
                                        {childMap.get(a.child_company_id) ?? "—"}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {accountOpps.length} opp
                                  {accountOpps.length === 1 ? "" : "s"} · 7d{" "}
                                  {formatCentsAbbrev(a.last_7d_spend_cents)} · run/day{" "}
                                  {formatCentsAbbrev(a.daily_run_rate_cents)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {qtdUncovered ? (
                                    <div className="flex items-center justify-end gap-1 text-amber-600">
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                      <span>{formatCentsAbbrev(a.qtd_spend_cents)} QTD</span>
                                    </div>
                                  ) : (
                                    <span>{formatCentsAbbrev(a.qtd_spend_cents)} QTD</span>
                                  )}
                                  {qtdUncovered && (
                                    <div className="text-xs text-amber-600">
                                      only {formatCentsAbbrev(coverage)} at 100%
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatCentsAbbrev(acctWeighted)} weighted
                                </TableCell>
                                <TableCell />
                                <TableCell className="text-sm text-muted-foreground">
                                  {[...(accountOwners.get(a.id) ?? [])].map((id) => ownerMap.get(id) ?? id.slice(0, 6)).join(", ") || "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })()}

                          {accountOpen &&
                            accountOpps.map((o) => (
                              <TableRow key={o.id} className="hover:bg-accent/20">
                                <TableCell>
                                  <div className="flex items-center gap-2 pl-14">
                                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                                    <Link
                                      href={`/opportunities/${o.id}/edit`}
                                      className="font-medium hover:underline"
                                    >
                                      {o.name}
                                    </Link>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{o.probability_pct}%</Badge>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatCentsAbbrev(o.forecasted_pipeline_cents)} forecast
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {formatCentsAbbrev(o.weighted_pipeline_cents)} weighted
                                </TableCell>
                                <TableCell />
                                <TableCell className="text-sm text-muted-foreground">
                                  {o.expected_close_date ?? "—"}
                                </TableCell>
                              </TableRow>
                            ))}

                          {accountOpen && (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="pl-14 py-2 text-sm text-muted-foreground"
                              >
                                <div className="flex items-center gap-3">
                                  {accountOpps.length === 0 && (
                                    <span className="italic">
                                      No opportunities on this ad account yet.
                                    </span>
                                  )}
                                  <QuickNewOppDialog
                                    parentCompanyId={c.id}
                                    parentCompanyName={c.name}
                                    childCompanyName={
                                      a.child_company_id
                                        ? childMap.get(a.child_company_id) ?? null
                                        : null
                                    }
                                    adAccountId={a.id}
                                    linkedinAccountId={a.linkedin_account_id}
                                    selfUserId={selfUserId}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </RowGroup>
                      );
                    })}

                  {companyOpen && companyAccounts.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="pl-12 text-sm text-muted-foreground italic"
                      >
                        No ad accounts imported for this company yet.
                      </TableCell>
                    </TableRow>
                  )}
                </RowGroup>
              );
            })}

            {filteredCompanies.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  {query
                    ? `No matches for "${query}".`
                    : "No companies yet. Import a CSV or add one from Companies."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">
                Totals · {filteredCompanies.length}{" "}
                {filteredCompanies.length === 1 ? "company" : "companies"}
                {query && filteredCompanies.length !== companies.length && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    (of {companies.length})
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {totalAccounts} ad account{totalAccounts === 1 ? "" : "s"}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {formatCents(totalQtd)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {formatCents(totalWeighted)}
              </TableCell>
              <TableCell />
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function InfoTip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 240) });
  };

  return (
    <span className="inline-flex items-center">
      <button
        ref={btnRef}
        className="ml-1 text-muted-foreground hover:text-foreground focus:outline-none"
        onClick={toggle}
        onBlur={() => setTimeout(() => setPos(null), 150)}
      >
        <Info className="h-3 w-3" />
      </button>
      {pos && createPortal(
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-[9999] w-56 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}

function InlineTargetEditor({
  parentId,
  currentCents,
}: {
  parentId: string;
  currentCents: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentCents != null ? String(currentCents / 100) : "");
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        {currentCents != null ? (
          <span>{formatCentsAbbrev(currentCents)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        <button
          className="text-xs text-primary hover:underline"
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        >
          edit target
        </button>
      </div>
    );
  }

  const save = (e: React.MouseEvent) => {
    e.stopPropagation();
    const stripped = value.replace(/[$,\s]/g, "");
    const cents = stripped === "" ? null : Math.round(Number(stripped) * 100);
    if (cents != null && (!Number.isFinite(cents) || cents < 0)) {
      toast.error("Enter a non-negative number");
      return;
    }
    startTransition(async () => {
      const res = await updateTarget(parentId, cents);
      if (res.error) toast.error(res.error);
      else { toast.success("Target saved"); setEditing(false); router.refresh(); }
    });
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        className="h-7 w-28 text-right text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 300000"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") save(e as unknown as React.MouseEvent); if (e.key === "Escape") setEditing(false); }}
      />
      <Button size="sm" className="h-7 px-2 text-xs" onClick={save} disabled={pending}>Save</Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setEditing(false); }}>✕</Button>
    </div>
  );
}
