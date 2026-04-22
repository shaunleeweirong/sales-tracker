"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createTeam, assignRep, setRole } from "./actions";

type Team = { id: string; name: string };
type Rep = { id: string; name: string; teamId: string | null; role: string };

const UNASSIGNED = "__none";

export function TeamsManager({ teams, reps }: { teams: Team[]; reps: Rep[] }) {
  const router = useRouter();
  const [newTeam, setNewTeam] = useState("");
  const [pending, startTransition] = useTransition();

  function addTeam() {
    if (!newTeam.trim()) return;
    startTransition(async () => {
      const res = await createTeam(newTeam.trim());
      if (res.error) toast.error(res.error);
      else {
        toast.success("Team created");
        setNewTeam("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium">Teams</h2>
          <div className="flex items-center gap-1">
            <Input
              className="h-8 w-48"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              placeholder="New team name"
              onKeyDown={(e) => e.key === "Enter" && addTeam()}
            />
            <Button size="sm" onClick={addTeam} disabled={pending}>+ Add</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <Badge key={t.id} variant="secondary">{t.name}</Badge>
          ))}
          {teams.length === 0 && (
            <span className="text-sm text-muted-foreground">No teams yet.</span>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Reps</h2>
        <div className="rounded-lg border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reps.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>
                    <Select
                      value={r.teamId ?? UNASSIGNED}
                      onValueChange={(v) => {
                        if (!v) return;
                        startTransition(async () => {
                          const res = await assignRep(r.id, v === UNASSIGNED ? null : v);
                          if (res.error) toast.error(res.error);
                          else router.refresh();
                        });
                      }}
                    >
                      <SelectTrigger className="w-44 h-8">
                        <SelectValue>
                          {(v: string) => {
                            if (v === UNASSIGNED) return "— Unassigned —";
                            return teams.find((t) => t.id === v)?.name ?? "—";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>— Unassigned —</SelectItem>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.role}
                      onValueChange={(v) => {
                        if (!v) return;
                        startTransition(async () => {
                          const res = await setRole(r.id, v as "rep" | "admin");
                          if (res.error) toast.error(res.error);
                          else router.refresh();
                        });
                      }}
                    >
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rep">rep</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {reps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    No reps signed up yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
