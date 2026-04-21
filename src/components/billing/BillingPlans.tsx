"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PLAN_LIMITS,
  PLAN_DISPLAY_PRICES,
  PLAN_FEATURES,
  TIERS,
  hasTrial,
  getTierAndCycleFromPriceId,
  isTierHigherThan,
  type PlanLine,
  type PlanTier,
  type BillingCycle,
} from "@/lib/billing";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";
import { toast } from "sonner";

interface BillingPlansProps {
  planLine: PlanLine;
  workspaceId?: string | null;
  userId?: string | null;
  currentPriceId?: string | null;
  status?: string;
  onSelectPlan?: () => void;
  /** Redirect URL after plan selection. */
  successUrl?: string;
}

const TIER_LABELS: Record<PlanTier, string> = {
  basic: "Basic",
  pro: "Pro",
  plus: "Plus",
};

export function BillingPlans({
  planLine,
  workspaceId,
  userId,
  currentPriceId,
  status,
  onSelectPlan,
  successUrl,
}: BillingPlansProps) {
  const currentTierAndCycle = useMemo(
    () => (currentPriceId ? getTierAndCycleFromPriceId(planLine, currentPriceId) : null),
    [planLine, currentPriceId]
  );
  const currentTier = currentTierAndCycle?.tier ?? null;
  const [cycle, setCycle] = useState<BillingCycle>(() => currentTierAndCycle?.cycle ?? "monthly");
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    if (currentTierAndCycle?.cycle === "annual") {
      setCycle("annual");
    }
  }, [currentTierAndCycle?.cycle]);

  const handleSelect = async (tier: PlanTier, billingCycle: BillingCycle) => {
    setSelecting(true);
    try {
      const res = await fetch("/api/plans/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || undefined,
          workspaceId: workspaceId || undefined,
          planTier: tier,
          billingCycle,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to select plan");
        return;
      }

      toast.success("Plan selected successfully!");
      onSelectPlan?.();

      if (successUrl) {
        window.location.href = successUrl;
      }
    } catch (e) {
      console.error("[BillingPlans] Plan selection error:", e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSelecting(false);
    }
  };

  const isAnnual = cycle === "annual";

  /** Feature rows for comparison: label + value per tier (string or React node for check/dash) */
  const comparisonRows: { label: string; getValue: (t: PlanTier) => ReactNode }[] = [
    {
      label: "Tutors & students",
      getValue: (t) => PLAN_LIMITS[planLine][t].label,
    },
    {
      label: "Owner dashboard",
      getValue: (t) =>
        PLAN_FEATURES[planLine][t].some((f) => f.toLowerCase().includes("owner dashboard")) ? (
          <Check className="h-4 w-4 text-primary inline-block" />
        ) : (
          "—"
        ),
    },
    {
      label: "Advanced analytics",
      getValue: (t) =>
        PLAN_FEATURES[planLine][t].some((f) => f.toLowerCase().includes("analytics")) ? (
          <Check className="h-4 w-4 text-primary inline-block" />
        ) : (
          "—"
        ),
    },
    {
      label: "Priority support",
      getValue: (t) =>
        PLAN_FEATURES[planLine][t].some((f) => f.toLowerCase().includes("priority")) ? (
          <Check className="h-4 w-4 text-primary inline-block" />
        ) : (
          "—"
        ),
    },
    {
      label: "Dedicated account manager",
      getValue: (t) =>
        PLAN_FEATURES[planLine][t].some((f) => f.toLowerCase().includes("account manager")) ? (
          <Check className="h-4 w-4 text-primary inline-block" />
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Section heading + toggle + comparison table */}
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold text-foreground">Choose the right plan for your team</h2>
          <p className="text-sm text-muted-foreground">
            Flexible pricing that grows with your educational needs.
          </p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
          <div className="flex items-center gap-0 rounded-none border-0 bg-none px-4 py-[3px]">
            <Label
              htmlFor="billing-cycle"
              className={`cursor-pointer px-3 text-sm font-medium transition-colors ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}
              onClick={() => setCycle("monthly")}
            >
              Monthly
            </Label>
            <Switch
              id="billing-cycle"
              checked={isAnnual}
              onCheckedChange={(checked) => setCycle(checked ? "annual" : "monthly")}
              className="data-[state=checked]:bg-primary"
            />
            <div className="flex items-center gap-2">
              <Label
                htmlFor="billing-cycle"
                className={`cursor-pointer px-3 text-sm font-medium transition-colors ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}
                onClick={() => setCycle("annual")}
              >
                Annually
              </Label>
              <Badge variant="secondary" className="rounded-md border border-primary/30 bg-primary/10 text-primary text-xs font-medium">
                Save
              </Badge>
            </div>
          </div>
        </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="w-[200px] font-medium text-foreground">Plan</TableHead>
              {TIERS.map((tier) => {
                const isCurrent = currentTier === tier;
                return (
                  <TableHead
                    key={tier}
                    className={`text-center font-medium text-foreground ${isCurrent ? "bg-primary/5" : ""}`}
                  >
                    {TIER_LABELS[tier]}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Row: CTA buttons */}
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableCell className="text-muted-foreground align-top pt-4"></TableCell>
              {TIERS.map((tier) => {
                const isCurrent = currentTier === tier;
                const prices = PLAN_DISPLAY_PRICES[planLine][tier];
                const displayPrice = cycle === "monthly" ? prices.monthly : prices.annual;
                const priceSuffix = cycle === "monthly" ? "/mo" : "/yr";
                return (
                  <TableCell
                    key={tier}
                    className={`align-top pt-4 pb-2 text-center ${isCurrent ? "bg-primary/5" : ""}`}
                  >
                    <Button
                      className="w-full"
                      variant={isCurrent ? "secondary" : "default"}
                      disabled={isCurrent || selecting}
                      onClick={() => handleSelect(tier, cycle)}
                    >
                      {selecting ? "Selecting…" : isCurrent ? "Current plan" : "Select plan"}
                    </Button>
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-foreground">{displayPrice}</span>
                      <span className="text-sm text-muted-foreground">{priceSuffix}</span>
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
            {/* Feature rows */}
            {comparisonRows.map((row) => (
              <TableRow key={row.label} className="border-b border-border last:border-0 hover:bg-transparent">
                <TableCell className="font-medium text-foreground">{row.label}</TableCell>
                {TIERS.map((tier) => {
                  const isCurrent = currentTier === tier;
                  return (
                    <TableCell
                      key={tier}
                      className={`text-center text-muted-foreground ${isCurrent ? "bg-primary/5" : ""}`}
                    >
                      {row.getValue(tier)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </div>
    </div>
  );
}
