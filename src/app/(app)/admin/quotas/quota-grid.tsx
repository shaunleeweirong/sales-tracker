"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveQuotaAdmin } from "./actions";

type Row = { userId: string; name: string; team: string; quotaCents: number };

export function QuotaGrid({ quarter, rows }: { quarter: string; rows: Row[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.userId, String(r.quotaCents / 100)])),
  );
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const updates = rows
        .map((r) => {
          const raw = values[r.userId] ?? "";
          const stripped = raw.replace(/[$,\s]/g, "");
          const cents = stripped === "" ? 0 : Math.round(Number(stripped) * 100);
          return { userId: r.userId, quarter, quotaCents: cents };
        })
        .filter((u) => Number.isFinite(u.quotaCents));
      const res = await saveQuotaAdmin(updates);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Quotas saved");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rep</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="w-48 text-right">Quota ($)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.userId}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.team}</TableCell>
                <TableCell className="text-right">
                  <Input
                    value={values[r.userId] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [r.userId]: e.target.value }))
                    }
                    className="h-8 text-right tabular-nums ml-auto"
                    inputMode="numeric"
                  />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                  No reps yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
