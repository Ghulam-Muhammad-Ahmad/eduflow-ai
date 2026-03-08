"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWorkspaceStorageSummary } from "@/hooks/useStorage";
import {
  bytesToWholeMb,
  formatStorageSize,
  getStoragePercentage,
  getStorageSliderStepMb,
} from "@/lib/storage-quota";
import { cn } from "@/lib/utils";

interface MemberStorageCardProps {
  memberUserId: string;
  memberLabel: string;
  variant?: "default" | "compact";
  className?: string;
}

interface MemberStorageResponse {
  storageLimitBytes: number;
  storageUsedBytes: number;
  remainingBytes: number;
  maxAssignableBytes: number;
}

export function MemberStorageCard({
  memberUserId,
  memberLabel,
  variant = "default",
  className,
}: MemberStorageCardProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [storageLimitMb, setStorageLimitMb] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { workspaceStorage } = useWorkspaceStorageSummary(!!memberUserId);
  const { data, isLoading } = useQuery({
    queryKey: ["member-storage", memberUserId],
    queryFn: async (): Promise<MemberStorageResponse> => {
      const res = await fetch(`/api/storage/member?memberUserId=${encodeURIComponent(memberUserId)}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to load member storage");
      }
      return res.json();
    },
    enabled: !!memberUserId,
  });

  const limitBytes = data?.storageLimitBytes ?? 0;
  const usedBytes = data?.storageUsedBytes ?? 0;
  const remainingBytes = data?.remainingBytes ?? 0;
  const maxAssignableBytes = data?.maxAssignableBytes ?? 0;
  const currentLimitMb = bytesToWholeMb(limitBytes);
  const usedMb = bytesToWholeMb(usedBytes);
  const maxAssignableMb = Math.max(bytesToWholeMb(maxAssignableBytes), usedMb, currentLimitMb, 1);
  const storagePercentage = getStoragePercentage(usedBytes, limitBytes);
  const sliderStepMb = getStorageSliderStepMb(maxAssignableMb);

  useEffect(() => {
    if (!dialogOpen) return;
    setStorageLimitMb(currentLimitMb);
    setError(null);
  }, [dialogOpen, currentLimitMb]);

  const handleSave = async () => {
    if (!Number.isInteger(storageLimitMb) || storageLimitMb < 0) {
      setError("Enter 0 or a positive number");
      return;
    }
    if (storageLimitMb < usedMb) {
      setError(`Cannot set below already used (${formatStorageSize(usedBytes)})`);
      return;
    }

    if (currentLimitMb === 0 && storageLimitMb === 0) {
      setDialogOpen(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/storage/assign", {
        method: currentLimitMb === 0 ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId, storageLimitMb }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError((json.error as string) ?? "Failed to save storage limit");
        return;
      }

      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["member-storage", memberUserId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-storage-summary"] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-6", className)}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <div className={cn("flex gap-4", variant === "compact" ? "flex-col" : "items-start justify-between")}>
            <div className={cn("space-y-2", variant === "compact" && "w-full")}>
              <h2 className="font-semibold flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                Document storage
              </h2>
              <p className="text-sm text-muted-foreground">
                {limitBytes <= 0
                  ? "No storage assigned"
                  : `${formatStorageSize(remainingBytes)} remaining of ${formatStorageSize(limitBytes)} assigned`}
              </p>
              <p className="text-xs text-muted-foreground">
                Currently used: {formatStorageSize(usedBytes)}
              </p>
              {workspaceStorage && (
                <p className="text-xs text-muted-foreground">
                  Workspace unassigned: {formatStorageSize(workspaceStorage.unassignedBytes)}
                </p>
              )}
            </div>

            <div className={cn("flex items-center gap-4", variant === "compact" && "justify-between")}>
              <div className="relative h-20 w-20 shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted/30"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary transition-all duration-500"
                    strokeDasharray={`${storagePercentage} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
                  {limitBytes > 0 ? `${storagePercentage.toFixed(0)}%` : "0%"}
                </span>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm">
                    Edit limit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Storage limit for {memberLabel}</DialogTitle>
                    <DialogDescription>
                      {currentLimitMb === 0
                        ? "Set how much document storage this member can use. This comes from your workspace storage pool."
                        : `Current limit: ${formatStorageSize(limitBytes)}. Set a new limit for this member.`}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div>
                      <div className="flex items-center justify-between mt-2">
                        <Label htmlFor="storage-limit-slider">Storage limit</Label>
                        <span className="text-sm text-muted-foreground">
                          {formatStorageSize(storageLimitMb * 1024 * 1024)} / {formatStorageSize(maxAssignableMb * 1024 * 1024)}
                        </span>
                      </div>
                      <Slider
                        id="storage-limit-slider"
                        min={currentLimitMb === 0 ? 0 : usedMb}
                        max={maxAssignableMb}
                        step={sliderStepMb}
                        value={[storageLimitMb]}
                        onValueChange={([value]) => setStorageLimitMb(value)}
                        disabled={maxAssignableMb <= 0}
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {workspaceStorage
                          ? `Available to assign now: ${formatStorageSize(maxAssignableBytes)}`
                          : "Storage comes from your workspace pool."}
                      </p>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
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
          </div>
        </>
      )}
    </div>
  );
}
