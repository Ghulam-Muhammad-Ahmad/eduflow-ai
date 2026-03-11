"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useAIUsage } from "@/hooks/useAIUsage";
import { Coins, Lightbulb, Edit2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

interface MemberCreditsCardProps {
  memberUserId: string;
  memberLabel: string;
  /** "compact" shows circular progress and fits in a side-by-side card layout */
  variant?: "default" | "compact";
  /** When true, card is full width and shows a line chart of consumption this period */
  showConsumptionChart?: boolean;
  className?: string;
}

export function MemberCreditsCard({
  memberUserId,
  memberLabel,
  variant = "default",
  showConsumptionChart = false,
  className,
}: MemberCreditsCardProps) {
  const queryClient = useQueryClient();
  const { usage } = useAIUsage();
  const availableCredits = usage?.remainingCredits ?? 0;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creditLimit, setCreditLimit] = useState(0);
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

  const { data: usageHistory } = useQuery({
    queryKey: ["member-credits-usage-history", memberUserId],
    queryFn: async () => {
      const res = await fetch(`/api/credits/member/usage-history?memberUserId=${encodeURIComponent(memberUserId)}`);
      if (!res.ok) throw new Error("Failed to load usage history");
      return res.json() as Promise<{ points: { date: string; credits: number; cumulative: number }[] }>;
    },
    enabled: !!memberUserId && !!showConsumptionChart,
  });

  const limit = data?.creditsLimit ?? 0;
  const used = data?.creditsUsed ?? 0;
  const remaining = data?.remaining ?? 0;

  useEffect(() => {
    if (dialogOpen) {
      setCreditLimit(limit);
      setError(null);
    }
  }, [dialogOpen, limit]);

  const handleSave = async () => {
    const n = creditLimit;
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
      setCreditLimit(0);
      queryClient.invalidateQueries({ queryKey: ["member-credits", memberUserId] });
    } finally {
      setLoading(false);
    }
  };

  const percentRemaining = limit > 0 ? Math.round((remaining / limit) * 100) : 0;
  const Icon = variant === "compact" ? Lightbulb : Coins;

  const chartData = usageHistory?.points ?? [];
  const showChart = showConsumptionChart && chartData.length > 0;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-6",
        variant === "compact" && "flex flex-col",
        showConsumptionChart && "w-full",
        className
      )}
    >
      {(variant !== "compact" || !showChart) ? (
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          AI Credits
        </h2>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          {variant === "compact" ? (
            <div className="flex flex-1 flex-col gap-4">
              {showChart ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="font-semibold flex items-center gap-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      AI Credits
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <span className="text-muted-foreground">
                        {limit === 0 ? "No credits assigned" : `${remaining}/${limit} Credits Utilized`}
                      </span>
                      {/* <span className="text-muted-foreground">Used this period: {used} credits</span> */}
                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="sm" className="shrink-0">
                            <Edit2 className="h-4 w-4" />
                            <span className="text-sm">Edit Limit</span>
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
                          <div className="py-2 space-y-3">
                            <div>
                              <div className="flex items-center justify-between mt-2">
                                <Label htmlFor="credit-limit-slider-chart">Credit limit</Label>
                                <span className="text-sm text-muted-foreground">
                                  {creditLimit} / {limit === 0 ? Math.max(1, availableCredits) : Math.max(limit, availableCredits)} credits
                                </span>
                              </div>
                              <Slider
                                id="credit-limit-slider-chart"
                                min={limit === 0 ? 0 : used}
                                max={limit === 0 ? Math.max(1, availableCredits) : Math.max(limit, availableCredits)}
                                step={1}
                                value={[creditLimit]}
                                onValueChange={([v]) => setCreditLimit(v)}
                                disabled={limit === 0 && availableCredits === 0}
                                className="mt-2"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Deduct from workspace pool and assign to this member.
                              </p>
                            </div>
                            {error && <p className="text-sm text-destructive">{error}</p>}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={loading}>
                              {loading ? <Spinner size="sm" /> : "Save"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative h-24 w-24 shrink-0">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-primary transition-all duration-500"
                        strokeDasharray={`${percentRemaining} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums">
                      {limit > 0 ? `${percentRemaining}%` : "0%"}
                    </span>
                  </div>
                  <div className="text-center space-y-1 w-full">
                    <p className="text-sm text-muted-foreground">
                      {limit === 0 ? "No credits assigned" : `${remaining} remaining of ${limit} assigned`}
                    </p>
                    <p className="text-xs text-muted-foreground">Used this period: {used} credits</p>
                  </div>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="sm" className="w-full sm:w-auto shrink-0">
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
                <div className="py-2 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mt-2">
                      <Label htmlFor="credit-limit-slider">Credit limit</Label>
                      <span className="text-sm text-muted-foreground">
                        {creditLimit} / {limit === 0 ? Math.max(1, availableCredits) : Math.max(limit, availableCredits)} credits
                      </span>
                    </div>
                    <Slider
                      id="credit-limit-slider"
                      min={limit === 0 ? 0 : used}
                      max={limit === 0 ? Math.max(1, availableCredits) : Math.max(limit, availableCredits)}
                      step={1}
                      value={[creditLimit]}
                      onValueChange={([v]) => setCreditLimit(v)}
                      disabled={limit === 0 && availableCredits === 0}
                      className="mt-2"
                    />
                    {/* Segment bar: filled = assigned, muted = available */}
                    {(limit === 0 ? availableCredits > 0 : Math.max(limit, availableCredits) > 0) && (
                      <div className="flex gap-0.5 mt-2" aria-hidden>
                        {Array.from({ length: 20 }).map((_, i) => {
                          const sliderMax = limit === 0 ? Math.max(1, availableCredits) : Math.max(limit, availableCredits);
                          const segmentThreshold = (i + 1) / 20;
                          const filled = creditLimit / sliderMax >= segmentThreshold;
                          return (
                            <div
                              key={i}
                              className={`flex-1 min-w-[4px] rounded-sm transition-colors ${
                                filled ? "bg-primary" : "bg-muted"
                              }`}
                              style={{ height: 8 }}
                            />
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Deduct from workspace pool and assign to this member.
                    </p>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? <Spinner size="sm" /> : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
              </div>
              )}

              {showChart && (
                <div className="mt-4 w-full min-h-[200px]">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Consumption this period</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => format(parseISO(v), "d MMM")}
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                      />
                      <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" width={28} />
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.[0] ? (
                            <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                              <p className="text-muted-foreground">
                                {payload[0].payload?.date ? format(parseISO(payload[0].payload.date), "d MMM yyyy") : ""}
                              </p>
                              <p className="font-medium">
                                Credits used: {(payload[0].payload?.credits as number) ?? 0}
                              </p>
                              <p className="text-muted-foreground">
                                Cumulative: {(payload[0].payload?.cumulative as number) ?? 0}
                              </p>
                            </div>
                          ) : null
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulative"
                        name="Credits used"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
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
                    <div className="py-2 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mt-2">
                          <Label htmlFor="credit-limit-slider">Credit limit</Label>
                          <span className="text-sm text-muted-foreground">
                            {creditLimit} / {limit === 0 ? Math.max(1, availableCredits) : Math.max(limit, availableCredits)} credits
                          </span>
                        </div>
                        <Slider
                          id="credit-limit-slider"
                          min={limit === 0 ? 0 : used}
                          max={limit === 0 ? Math.max(1, availableCredits) : Math.max(limit, availableCredits)}
                          step={1}
                          value={[creditLimit]}
                          onValueChange={([v]) => setCreditLimit(v)}
                          disabled={limit === 0 && availableCredits === 0}
                          className="mt-2"
                        />
                        {(limit === 0 ? availableCredits > 0 : Math.max(limit, availableCredits) > 0) && (
                          <div className="flex gap-0.5 mt-2" aria-hidden>
                            {Array.from({ length: 20 }).map((_, i) => {
                              const sliderMax = limit === 0 ? Math.max(1, availableCredits) : Math.max(limit, availableCredits);
                              const segmentThreshold = (i + 1) / 20;
                              const filled = creditLimit / sliderMax >= segmentThreshold;
                              return (
                                <div
                                  key={i}
                                  className={`flex-1 min-w-[4px] rounded-sm transition-colors ${
                                    filled ? "bg-primary" : "bg-muted"
                                  }`}
                                  style={{ height: 8 }}
                                />
                              );
                            })}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Deduct from workspace pool and assign to this member.
                        </p>
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={loading}>
                        {loading ? <Spinner size="sm" /> : "Save"}
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
        </>
      )}
    </div>
  );
}
