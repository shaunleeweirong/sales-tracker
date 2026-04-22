"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all";

export function PipelineFilters({
  owners,
  teams,
  selectedOwner,
  selectedTeam,
}: {
  owners: { id: string; full_name: string | null }[];
  teams: { id: string; name: string }[];
  selectedOwner?: string;
  selectedTeam?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function navigate(key: string, value: string | null) {
    if (!value) return;
    const q = new URLSearchParams(params ? params.toString() : "");
    if (value === ALL) q.delete(key);
    else q.set(key, value);
    router.push(`/pipeline?${q.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedOwner ?? ALL} onValueChange={(v) => navigate("owner", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Owner">
            {(v: string) => {
              if (v === ALL) return "All owners";
              const o = owners.find((x) => x.id === v);
              return o?.full_name ?? "Owner";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All owners</SelectItem>
          {owners.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.full_name ?? o.id.slice(0, 8)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={selectedTeam ?? ALL} onValueChange={(v) => navigate("team", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Team">
            {(v: string) => {
              if (v === ALL) return "All teams";
              const t = teams.find((x) => x.id === v);
              return t?.name ?? "Team";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All teams</SelectItem>
          {teams.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
