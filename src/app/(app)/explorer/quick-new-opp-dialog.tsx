"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROBABILITY_BUCKETS, formatCents } from "@/lib/forecast";
import { saveOpportunity } from "../opportunities/actions";

type Props = {
  parentCompanyId: string;
  parentCompanyName: string;
  childCompanyName: string | null;
  adAccountId: string;
  linkedinAccountId: string;
  selfUserId: string;
  selfTeamId: string | null;
};

export function QuickNewOppDialog({
  parentCompanyId,
  parentCompanyName,
  childCompanyName,
  adAccountId,
  linkedinAccountId,
  selfUserId,
  selfTeamId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [forecastedCents, setForecastedCents] = useState(0);
  const [probabilityPct, setProbabilityPct] = useState(25);
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  const weighted = Math.round((forecastedCents * probabilityPct) / 100);

  function reset() {
    setName("");
    setForecastedCents(0);
    setProbabilityPct(25);
    setCloseDate("");
    setNotes("");
  }

  function submit() {
    if (!name.trim()) return toast.error("Name is required");
    if (forecastedCents <= 0) return toast.error("Forecasted amount must be > 0");
    startTransition(async () => {
      const res = await saveOpportunity({
        name: name.trim(),
        parentCompanyId,
        adAccountId,
        ownerUserId: selfUserId,
        teamId: selfTeamId,
        forecastedCents,
        probabilityPct,
        expectedCloseDate: closeDate || null,
        notes: notes.trim() || null,
        goToMarketNotes: null,
        rolesAndResponsibilities: null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Opportunity created");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Add opportunity
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New opportunity</DialogTitle>
          <div className="text-sm text-muted-foreground">
            {parentCompanyName}
            {childCompanyName ? ` → ${childCompanyName}` : ""}
            {" · "}
            <span className="font-mono">{linkedinAccountId}</span>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>Name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q2 Renewal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label>Forecasted (USD)</Label>
              <Input
                type="number"
                min={0}
                value={forecastedCents / 100}
                onChange={(e) =>
                  setForecastedCents(Math.round(Number(e.target.value || 0) * 100))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Probability</Label>
              <Select
                value={String(probabilityPct)}
                onValueChange={(v) => v && setProbabilityPct(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue>{(v: string) => `${v}%`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROBABILITY_BUCKETS.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {p}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Expected close date</Label>
            <Input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Short context — GTM strategy / R&R can be added later from the opp page."
            />
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">Weighted pipeline: </span>
            <span className="font-medium">
              {formatCents(forecastedCents)} × {probabilityPct}% = {formatCents(weighted)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Creating…" : "Create opportunity"}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  );
}
