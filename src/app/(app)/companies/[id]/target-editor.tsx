"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateTarget } from "../actions";
import { formatCents } from "@/lib/forecast";

export function TargetEditor({
  parentId,
  currentCents,
}: {
  parentId: string;
  currentCents: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    currentCents != null ? String(currentCents / 100) : "",
  );
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold tabular-nums">
          {currentCents != null ? formatCents(currentCents) : "—"}
        </span>
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => setEditing(true)}
        >
          edit
        </button>
      </div>
    );
  }

  const save = () => {
    const stripped = value.replace(/[$,\s]/g, "");
    const cents = stripped === "" ? null : Math.round(Number(stripped) * 100);
    if (cents != null && (!Number.isFinite(cents) || cents < 0)) {
      toast.error("Enter a non-negative number");
      return;
    }
    startTransition(async () => {
      const res = await updateTarget(parentId, cents);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Target saved");
        setEditing(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-8 w-32"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 300000"
        autoFocus
      />
      <Button size="sm" onClick={save} disabled={pending}>Save</Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
    </div>
  );
}
