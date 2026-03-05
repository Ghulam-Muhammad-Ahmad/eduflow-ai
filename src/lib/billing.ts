/**
 * Plan tiers and Paddle price IDs for workspace (owner) plans only.
 * Only business plans are used; tutors and students get access via the owner's workspace.
 * Basic = 14-day free trial; Pro/Plus = no trial.
 */

export type PlanTier = "basic" | "pro" | "plus";
export type BillingCycle = "monthly" | "annual";
/** Only business (owner) plans are used for checkout. */
export type PlanLine = "business";

export const PLAN_LIMITS: Record<
  PlanLine,
  Record<PlanTier, { tutors?: number; students: number; label: string }>
> = {
  business: {
    basic: { tutors: 3, students: 50, label: "Up to 3 tutors, 50 students" },
    pro: { tutors: 10, students: 200, label: "Up to 10 tutors, 200 students" },
    plus: { tutors: 20, students: 500, label: "Up to 20 tutors, 500 students" },
  },
};

/** Display prices (fallback when Paddle prices not fetched). */
export const PLAN_DISPLAY_PRICES: Record<
  PlanLine,
  Record<PlanTier, { monthly: string; annual: string }>
> = {
  business: {
    basic: { monthly: "$79", annual: "$790" },
    pro: { monthly: "$149", annual: "$1,490" },
    plus: { monthly: "$249", annual: "$2,490" },
  },
};

/** Full feature list per plan (what's included). */
export const PLAN_FEATURES: Record<PlanLine, Record<PlanTier, string[]>> = {
  business: {
    basic: [
      "Up to 3 tutors, 50 students",
      "Owner dashboard",
      "Invite tutors & students",
      "Centralized billing",
      "Basic reporting",
    ],
    pro: [
      "Everything in Basic",
      "Up to 10 tutors, 200 students",
      "Advanced analytics",
      "Custom branding (coming soon)",
      "Priority support",
    ],
    plus: [
      "Everything in Pro",
      "Up to 20 tutors, 500 students",
      "API access (coming soon)",
      "Dedicated account manager",
      "SLA & custom contracts",
    ],
  },
};

/**
 * Paddle price IDs for business plans only (from .env NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_*).
 * Must reference each env var statically so Next.js inlines them.
 */
const PADDLE_PRICE_IDS_FROM_ENV: Record<string, string | undefined> = {
  BUSINESS_BASIC_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_BASIC_MONTHLY,
  BUSINESS_BASIC_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_BASIC_ANNUAL,
  BUSINESS_PRO_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PRO_MONTHLY,
  BUSINESS_PRO_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PRO_ANNUAL,
  BUSINESS_PLUS_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PLUS_MONTHLY,
  BUSINESS_PLUS_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PLUS_ANNUAL,
};

function getPriceId(line: PlanLine, tier: PlanTier, cycle: BillingCycle): string | null {
  const suffix = `${line.toUpperCase()}_${tier.toUpperCase()}_${cycle.toUpperCase()}`;
  const value = PADDLE_PRICE_IDS_FROM_ENV[suffix]?.trim();
  return value || null;
}

export function getCheckoutPriceId(
  line: PlanLine,
  tier: PlanTier,
  cycle: BillingCycle
): string | null {
  return getPriceId(line, tier, cycle);
}

export const TIERS: PlanTier[] = ["basic", "pro", "plus"];
export const CYCLES: BillingCycle[] = ["monthly", "annual"];

export function hasTrial(tier: PlanTier): boolean {
  return tier === "basic";
}
