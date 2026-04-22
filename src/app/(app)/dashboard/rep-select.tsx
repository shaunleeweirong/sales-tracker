"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RepSelect({
  reps,
  selected,
}: {
  reps: { id: string; full_name: string | null }[];
  selected: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <Select
      value={selected}
      onValueChange={(v) => {
        if (!v) return;
        const q = new URLSearchParams(params ? params.toString() : "");
        q.set("userId", v);
        router.push(`/dashboard?${q.toString()}`);
      }}
    >
      <SelectTrigger className="w-56">
        <SelectValue>
          {(v: string) => {
            const r = reps.find((x) => x.id === v);
            return r?.full_name ?? (v ? v.slice(0, 8) : "Select rep");
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {reps.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.full_name ?? r.id.slice(0, 8)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
