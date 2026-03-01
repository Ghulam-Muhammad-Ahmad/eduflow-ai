"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PLAN_LIMITS,
  PLAN_DISPLAY_PRICES,
  PLAN_FEATURES,
  TIERS,
  CYCLES,
  hasTrial,
  getCheckoutPriceId,
  type PlanLine,
  type PlanTier,
  type BillingCycle,
} from "@/lib/billing";
import { openPaddleCheckout } from "./PaddleProvider";
import { Check } from "lucide-react";

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
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [redirecting, setRedirecting] = useState(false);
  const useRedirect = !!successUrl;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2">
        {CYCLES.map((c) => (
          <Button
            key={c}
            variant={cycle === c ? "default" : "outline"}
            size="sm"
            onClick={() => setCycle(c)}
          >
            {c === "monthly" ? "Monthly" : "Annual (save)"}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => {
          const limits = PLAN_LIMITS[planLine][tier];
          const prices = PLAN_DISPLAY_PRICES[planLine][tier];
          const features = PLAN_FEATURES[planLine][tier];
          const priceId = getCheckoutPriceId(planLine, tier, cycle);
          const isCurrent = currentPriceId && priceId === currentPriceId;
          const trial = hasTrial(tier);
          const displayPrice = cycle === "monthly" ? prices.monthly : prices.annual;

          return (
            <Card
              key={tier}
              className={`relative border-2 ${isCurrent ? "border-primary" : "border-border"}`}
            >
              {trial && (
                <Badge className="absolute right-3 top-3" variant="secondary">
                  14-day free trial
                </Badge>
              )}
              <CardHeader>
                <CardTitle>{TIER_LABELS[tier]}</CardTitle>
                <CardDescription>{limits.label}</CardDescription>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-foreground">{displayPrice}</span>
                  <span className="text-sm text-muted-foreground">/{cycle === "monthly" ? "month" : "year"}</span>
                </div>
                {limits.tutors != null && (
                  <p className="text-sm text-muted-foreground">
                    Up to {limits.tutors} tutor{limits.tutors !== 1 ? "s" : ""}, {limits.students} students
                  </p>
                )}
                {planLine === "student" && (
                  <p className="text-sm text-muted-foreground">For self-study</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {!priceId ? (
                  <p className="text-sm text-muted-foreground">
                    Configure price ID in env for this plan.
                  </p>
                ) : null}
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
                      : status && (status === "active" || status === "trialing")
                        ? "Upgrade"
                        : "Continue to payment"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
