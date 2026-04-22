"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { saveQuota } from "./actions";

export function QuotaEditor({
  userId,
  quarter,
  currentCents,
}: {
  userId: string;
  quarter: string;
  currentCents: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentCents / 100));
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        className="text-xs text-primary hover:underline"
        onClick={() => setEditing(true)}
      >
        edit quota
      </button>
    );
  }

  const onSave = () => {
    const dollars = Number(value.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(dollars) || dollars < 0) {
      toast.error("Enter a non-negative number");
      return;
    }
    startTransition(async () => {
      const res = await saveQuota(userId, quarter, Math.round(dollars * 100));
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Quota saved");
        setEditing(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-7 text-xs w-24"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <Button size="sm" className="h-7 text-xs" onClick={onSave} disabled={pending}>
        Save
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={() => {
          setEditing(false);
          setValue(String(currentCents / 100));
        }}
      >
        Cancel
      </Button>
    </div>
  );
}
