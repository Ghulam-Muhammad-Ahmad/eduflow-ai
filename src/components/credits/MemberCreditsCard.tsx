"use client";

import { useState, useEffect } from "react";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creditLimit, setCreditLimit] = useState("");
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

  const limit = data?.creditsLimit ?? 0;
  const used = data?.creditsUsed ?? 0;
  const remaining = data?.remaining ?? 0;

  useEffect(() => {
    if (dialogOpen) {
      setCreditLimit(limit > 0 ? String(limit) : "");
      setError(null);
    }
  }, [dialogOpen, limit]);

  const handleSave = async () => {
    const n = creditLimit.trim() === "" ? 0 : parseInt(creditLimit, 10);
    if (!Number.isInteger(n) || n < 0) {
      setError("Enter 0 or a positive number");
      return;
    }
    if (data && n < data.creditsUsed) {
      setError(`Cannot set below already used (${used} credits this period)`);
      return;
    }
    if (limit === 0 && n === 0) {
      setDialogOpen(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (limit === 0 && n > 0) {
        const res = await fetch("/api/credits/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberUserId, credits: n }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((json.error as string) || "Failed to set credit limit");
          return;
        }
      } else if (limit > 0) {
        const res = await fetch("/api/credits/assign", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberUserId, creditsLimit: n }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((json.error as string) || "Failed to update limit");
          return;
        }
      }
      setDialogOpen(false);
      setCreditLimit("");
      queryClient.invalidateQueries({ queryKey: ["member-credits", memberUserId] });
    } finally {
      setLoading(false);
    }
  };

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
              <p className="text-2xl font-bold">{limit === 0 ? "0" : remaining}</p>
              <p className="text-sm text-muted-foreground">
                {limit === 0 ? "No credits assigned" : `${remaining} remaining of ${limit} assigned`}
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Edit credit limit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>AI credit limit for {memberLabel}</DialogTitle>
                  <DialogDescription>
                    {limit === 0
                      ? "Set how many AI credits this member can use. Deducts from your workspace pool."
                      : `Current limit: ${limit}. Set a new limit (min ${used} — already used this period).`}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  <Input
                    type="number"
                    min={limit === 0 ? 0 : used}
                    placeholder={limit === 0 ? "e.g. 50" : String(limit)}
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                  />
                  {error && <p className="text-sm text-destructive mt-2">{error}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-xs text-muted-foreground">
            Used this period: {used} credits
          </p>
        </>
      )}
    </div>
  );
}
