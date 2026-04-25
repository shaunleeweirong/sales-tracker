"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROBABILITY_BUCKETS, formatCents } from "@/lib/forecast";
import { saveOpportunity } from "./actions";

type Option = { id: string; label: string };

export type OppFormInitial = {
  id?: string;
  name: string;
  parentCompanyId: string;
  ownerUserId: string | null;
  forecastedCents: number;
  probabilityPct: number;
  expectedCloseDate: string | null;
  notes: string | null;
  goToMarketNotes: string | null;
  rolesAndResponsibilities: string | null;
  adAccountId: string | null;
};

export function OpportunityForm({
  initial,
  companies,
  owners,
  adAccountsByCompany,
}: {
  initial: OppFormInitial;
  companies: Option[];
  owners: Option[];
  adAccountsByCompany: Record<string, { id: string; linkedin_account_id: string }[]>;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof OppFormInitial>(k: K, v: OppFormInitial[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const availableAccounts = adAccountsByCompany[state.parentCompanyId] ?? [];
  const weighted = Math.round((state.forecastedCents * state.probabilityPct) / 100);

  function submit() {
    if (!state.name.trim()) return toast.error("Name is required");
    if (!state.parentCompanyId) return toast.error("Pick a parent company");
    if (!state.adAccountId) return toast.error("Pick an ad account");
    startTransition(async () => {
      const res = await saveOpportunity(state);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Saved");
        router.push("/opportunities");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex flex-col gap-1">
        <Label>Name</Label>
        <Input
          value={state.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g. Q2 Renewal"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label>Parent Company</Label>
        <Select
          value={state.parentCompanyId || undefined}
          onValueChange={(v) => {
            if (!v) return;
            setState((s) => ({ ...s, parentCompanyId: v, adAccountId: null }));
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select company">
              {(v: string) => companies.find((c) => c.id === v)?.label ?? "Select company"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Ad Account ID <span className="text-destructive">*</span></Label>
        {availableAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ad accounts on this company yet (import a CSV or add one from the company page).
          </p>
        ) : (
          <Select
            value={state.adAccountId ?? undefined}
            onValueChange={(v) => v && update("adAccountId", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an ad account">
                {(v: string) => {
                  const a = availableAccounts.find((x) => x.id === v);
                  return a ? (
                    <span className="font-mono">{a.linkedin_account_id}</span>
                  ) : (
                    "Select an ad account"
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="font-mono">{a.linkedin_account_id}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label>Owner</Label>
        <Select
          value={state.ownerUserId ?? undefined}
          onValueChange={(v) => update("ownerUserId", v || null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select owner">
              {(v: string) => owners.find((o) => o.id === v)?.label ?? "Select owner"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label>Forecasted pipeline (USD)</Label>
          <Input
            type="number"
            min={0}
            value={state.forecastedCents / 100}
            onChange={(e) =>
              update("forecastedCents", Math.round(Number(e.target.value || 0) * 100))
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Probability</Label>
          <Select
            value={String(state.probabilityPct)}
            onValueChange={(v) => v && update("probabilityPct", Number(v))}
          >
            <SelectTrigger>
              <SelectValue>{(v: string) => `${v}%`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROBABILITY_BUCKETS.map((p) => (
                <SelectItem key={p} value={String(p)}>{p}%</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Expected close date</Label>
        <Input
          type="date"
          value={state.expectedCloseDate ?? ""}
          onChange={(e) => update("expectedCloseDate", e.target.value || null)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label>Go-to-market strategy notes</Label>
        <Textarea
          value={state.goToMarketNotes ?? ""}
          onChange={(e) => update("goToMarketNotes", e.target.value || null)}
          rows={3}
          placeholder="Positioning, offer, target audience, sequencing…"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label>Roles and Responsibilities</Label>
        <Textarea
          value={state.rolesAndResponsibilities ?? ""}
          onChange={(e) => update("rolesAndResponsibilities", e.target.value || null)}
          rows={3}
          placeholder="Who owns what — e.g. AE leads commercial, SE owns creative, Legal owns DPA."
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label>Internal notes</Label>
        <Textarea
          value={state.notes ?? ""}
          onChange={(e) => update("notes", e.target.value || null)}
          rows={2}
        />
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-sm">
        <span className="text-muted-foreground">Weighted pipeline preview: </span>
        <span className="font-medium">
          {formatCents(state.forecastedCents)} × {state.probabilityPct}% ={" "}
          {formatCents(weighted)}
        </span>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={() => router.push("/opportunities")}>Cancel</Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : state.id ? "Save changes" : "Create"}
        </Button>
      </div>
    </div>
  );
}
