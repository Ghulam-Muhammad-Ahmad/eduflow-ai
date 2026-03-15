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
  getCheckoutPriceId,
  getTierAndCycleFromPriceId,
  isTierHigherThan,
  type PlanLine,
  type PlanTier,
  type BillingCycle,
} from "@/lib/billing";
import { openPaddleCheckout } from "./PaddleProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";

/** Fetched from GET /api/paddle/plan-prices */
type PlanPricesResponse = Record<PlanTier, Record<BillingCycle, { formatted: string; ai_credits: number | null; doc_storage_gb: number | null } | null>>;

interface BillingPlansProps {
  planLine: PlanLine;
  workspaceId?: string | null;
  userId?: string | null;
  currentPriceId?: string | null;
  status?: string;
  onSelectPlan?: () => void;
  /** Redirect URL after Paddle checkout (for full-page checkout). */
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
  const [redirecting, setRedirecting] = useState(false);
  const [planPrices, setPlanPrices] = useState<PlanPricesResponse | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);
  const useRedirect = !!successUrl;

  useEffect(() => {
    if (currentTierAndCycle?.cycle === "annual") {
      setCycle("annual");
    }
  }, [currentTierAndCycle?.cycle]);

  useEffect(() => {
    let cancelled = false;
    setPricesLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/paddle/plan-prices?planLine=${encodeURIComponent(planLine)}`, { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          setPricesLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data?.plans) setPlanPrices(data.plans);
      } catch {
        // Fallback to PLAN_DISPLAY_PRICES
      } finally {
        if (!cancelled) setPricesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [planLine]);

  const handleSelect = async (tier: PlanTier, billingCycle: BillingCycle) => {
    const priceId = getCheckoutPriceId(planLine, tier, billingCycle);
    if (!priceId) {
      console.warn("Price ID not configured for", planLine, tier, billingCycle);
      return;
    }
    const customData: Record<string, string> = {};
    if (workspaceId) customData.workspaceId = workspaceId;
    if (userId) customData.userId = userId;
    if (useRedirect) {
      setRedirecting(true);
      await openPaddleCheckout({ priceId, customData, successUrl });
      setRedirecting(false);
    } else {
      openPaddleCheckout({ priceId, customData, successUrl });
    }
    onSelectPlan?.();
  };

  const isAnnual = cycle === "annual";

  /** Feature rows for comparison: label + value per tier (string or React node for check/dash) */
  const comparisonRows: { label: string; getValue: (t: PlanTier) => ReactNode }[] = [
    {
      label: "Tutors & students",
      getValue: (t) => PLAN_LIMITS[planLine][t].label,
    },
    {
      label: "AI credits / month",
      getValue: (t) => {
        const val = planPrices?.[t]?.[cycle]?.ai_credits;
        return val != null && val >= 0 ? val.toLocaleString() : "—";
      },
    },
    {
      label: "Storage",
      getValue: (t) => {
        const val = planPrices?.[t]?.[cycle]?.doc_storage_gb;
        return val != null && val >= 0 ? `${val} GB` : "—";
      },
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

        {pricesLoading ? (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="w-[200px] font-medium text-foreground">Plan</TableHead>
                  {TIERS.map((tier) => (
                    <TableHead key={tier} className="text-center font-medium text-foreground">
                      {TIER_LABELS[tier]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableCell className="align-top pt-4"></TableCell>
                  {TIERS.map((tier) => (
                    <TableCell key={tier} className="align-top pt-4 pb-2 text-center">
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="mt-2 h-8 w-16 mx-auto rounded-md" />
                    </TableCell>
                  ))}
                </TableRow>
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <TableRow key={i} className="border-b border-border last:border-0 hover:bg-transparent">
                    <TableCell>
                      <Skeleton className="h-4 w-32 rounded-md" />
                    </TableCell>
                    {TIERS.map((tier) => (
                      <TableCell key={tier} className="text-center">
                        <Skeleton className="h-4 w-8 mx-auto rounded-md" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="w-[200px] font-medium text-foreground">Plan</TableHead>
                  {TIERS.map((tier) => {
                    const priceId = getCheckoutPriceId(planLine, tier, cycle);
                    const isCurrent = currentPriceId && priceId === currentPriceId;
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
                    const priceId = getCheckoutPriceId(planLine, tier, cycle);
                    const isCurrent = currentPriceId && priceId === currentPriceId;
                    const trial = hasTrial(tier);
                    const prices = PLAN_DISPLAY_PRICES[planLine][tier];
                    const dynamic = planPrices?.[tier]?.[cycle];
                    const displayPrice = dynamic?.formatted ?? (cycle === "monthly" ? prices.monthly : prices.annual);
                    const priceSuffix = cycle === "monthly" ? "/mo" : "/yr";
                    return (
                      <TableCell
                        key={tier}
                        className={`align-top pt-4 pb-2 text-center ${isCurrent ? "bg-primary/5" : ""}`}
                      >
                        <Button
                          className="w-full"
                          variant={isCurrent ? "secondary" : "default"}
                          disabled={isCurrent || redirecting}
                          onClick={() => handleSelect(tier, cycle)}
                        >
                          {redirecting
                            ? "Redirecting…"
                            : isCurrent
                              ? "Current plan"
                              : trial
                                ? "Try it for free"
                                : status && (status === "active" || status === "trialing") && currentTier
                                  ? isTierHigherThan(currentTier, tier)
                                    ? "Downgrade"
                                    : "Upgrade"
                                  : "Continue to payment"}
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
                      const priceId = getCheckoutPriceId(planLine, tier, cycle);
                      const isCurrent = currentPriceId && priceId === currentPriceId;
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
        )}
      </div>
    </div>
  );
}
