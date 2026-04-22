"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createChildCompany } from "../actions";

export function ChildCompanyAdder({ parentId }: { parentId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createChildCompany(parentId, trimmed);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Child added");
        setName("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-8 w-48"
        placeholder="Child company name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <Button size="sm" onClick={submit} disabled={pending}>+ Add</Button>
    </div>
  );
}
