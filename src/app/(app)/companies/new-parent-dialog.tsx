"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createParent } from "./actions";

export function NewParentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const targetCents = target ? Math.round(Number(target.replace(/[$,]/g, "")) * 100) : null;
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    startTransition(async () => {
      const res = await createParent(name.trim(), targetCents);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Company added");
        setOpen(false);
        setName("");
        setTarget("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>+ New parent company</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New parent company</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="np-name">Name</Label>
            <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="np-target">Quarterly target revenue (USD, optional)</Label>
            <Input
              id="np-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. 300000"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
