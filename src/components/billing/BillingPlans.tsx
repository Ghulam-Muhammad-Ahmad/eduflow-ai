"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  PLAN_LIMITS,
  PLAN_DISPLAY_PRICES,
  PLAN_FEATURES,
  TIERS,
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

  const isAnnual = cycle === "annual";

  return (
    <div className="space-y-6">
      {/* Billing cycle toggle: pill layout with Monthly | Switch | Annually + save badge */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
        <div className="flex items-center gap-0 rounded-none border-0 bg-white px-4 py-[3px]">
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

      {/* Plan cards: title, description, price, billing note, features, CTA */}
      <div className="grid gap-x-2 gap-y-6 md:grid-cols-3">
        {TIERS.map((tier) => {
          const limits = PLAN_LIMITS[planLine][tier];
          const prices = PLAN_DISPLAY_PRICES[planLine][tier];
          const features = PLAN_FEATURES[planLine][tier];
          const priceId = getCheckoutPriceId(planLine, tier, cycle);
          const isCurrent = currentPriceId && priceId === currentPriceId;
          const trial = hasTrial(tier);
          const displayPrice = cycle === "monthly" ? prices.monthly : prices.annual;
          const priceSuffix = cycle === "monthly" ? "/month" : "/year";
          const billingNote =
            cycle === "annual"
              ? `billed annually or ${prices.monthly}/month billed monthly`
              : "billed monthly";

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
              <CardHeader className="space-y-1.5">
                <CardTitle className="text-xl">{TIER_LABELS[tier]}</CardTitle>
                <CardDescription>{limits.label}</CardDescription>
                <div className="pt-1">
                  <span className="text-2xl font-bold text-foreground">{displayPrice}</span>
                  <span className="text-sm text-muted-foreground">{priceSuffix}</span>
                </div>
                <p className="text-xs text-muted-foreground">{billingNote}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
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
                  className="mt-auto w-full"
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
