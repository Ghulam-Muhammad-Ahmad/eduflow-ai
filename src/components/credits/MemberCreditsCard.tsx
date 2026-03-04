"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Coins, Loader2 } from "lucide-react";

interface MemberCreditsCardProps {
  memberUserId: string;
  memberLabel: string;
}

export function MemberCreditsCard({ memberUserId, memberLabel }: MemberCreditsCardProps) {
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [creditsToAssign, setCreditsToAssign] = useState("");
  const [newLimit, setNewLimit] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["member-credits", memberUserId],
    queryFn: async () => {
      const res = await fetch(`/api/credits/member?memberUserId=${encodeURIComponent(memberUserId)}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<{ creditsLimit: number; creditsUsed: number; remaining: number }>;
    },
    enabled: !!memberUserId,
  });

  const doAssign = async () => {
    const n = parseInt(creditsToAssign, 10);
    if (!Number.isInteger(n) || n <= 0) {
      setError("Enter a positive number");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/credits/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId, credits: n }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Failed to assign credits");
        return;
      }
      setAssignOpen(false);
      setCreditsToAssign("");
      queryClient.invalidateQueries({ queryKey: ["member-credits", memberUserId] });
    } finally {
      setLoading(false);
    }
  };

  const doEdit = async () => {
    const n = parseInt(newLimit, 10);
    if (!Number.isInteger(n) || n < 0) {
      setError("Enter a non-negative number");
      return;
    }
    if (data && n < data.creditsUsed) {
      setError("New limit cannot be less than already used");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/credits/assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId, creditsLimit: n }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Failed to update limit");
        return;
      }
      setEditOpen(false);
      setNewLimit("");
      queryClient.invalidateQueries({ queryKey: ["member-credits", memberUserId] });
    } finally {
      setLoading(false);
    }
  };

  const limit = data?.creditsLimit ?? 0;
  const used = data?.creditsUsed ?? 0;
  const remaining = data?.remaining ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-semibold mb-4 flex items-center gap-2">
        <Coins className="h-5 w-5 text-muted-foreground" />
        AI Credits
      </h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-2xl font-bold">{remaining}</p>
              <p className="text-sm text-muted-foreground">remaining of {limit} assigned</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Assign credits
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign credits to {memberLabel}</DialogTitle>
                    <DialogDescription>
                      Deduct from your workspace pool and add to this member&apos;s limit.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Credits to assign"
                      value={creditsToAssign}
                      onChange={(e) => setCreditsToAssign(e.target.value)}
                    />
                    {error && <p className="text-sm text-destructive mt-2">{error}</p>}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAssignOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={doAssign} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Edit limit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit credit limit for {memberLabel}</DialogTitle>
                    <DialogDescription>
                      Set a new total limit. Cannot be less than already used ({used}).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-2">
                    <Input
                      type="number"
                      min={used}
                      placeholder={String(limit)}
                      value={newLimit}
                      onChange={(e) => setNewLimit(e.target.value)}
                    />
                    {error && <p className="text-sm text-destructive mt-2">{error}</p>}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={doEdit} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Used this period: {used} credits
          </p>
        </>
      )}
    </div>
  );
}
