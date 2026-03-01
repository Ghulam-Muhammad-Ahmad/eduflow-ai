/**
 * Plan tiers and Paddle price IDs (from .env NEXT_PUBLIC_PADDLE_PRICE_*).
 * Basic = 14-day free trial; Pro/Plus = no trial.
 */

export type PlanTier = "basic" | "pro" | "plus";
export type BillingCycle = "monthly" | "annual";
export type PlanLine = "student" | "tutor" | "business";

export const PLAN_LIMITS: Record<
  PlanLine,
  Record<PlanTier, { tutors?: number; students: number; label: string }>
> = {
  student: {
    basic: { students: 1, label: "Limited AI; save outputs; practice tests" },
    pro: { students: 1, label: "Higher AI; unlimited practice tests" },
    plus: { students: 1, label: "Max AI; priority support; export" },
  },
  tutor: {
    basic: { tutors: 1, students: 15, label: "1 tutor, up to 15 students; basic AI" },
    pro: { tutors: 1, students: 50, label: "1 tutor, up to 50 students; full AI" },
    plus: { tutors: 1, students: 100, label: "1 tutor, up to 100 students; max AI" },
  },
  business: {
    basic: { tutors: 3, students: 50, label: "Up to 3 tutors, 50 students" },
    pro: { tutors: 10, students: 200, label: "Up to 10 tutors, 200 students" },
    plus: { tutors: 20, students: 500, label: "Up to 20 tutors, 500 students" },
  },
};

/** Display prices (fallback when Paddle prices not fetched). Use env NEXT_PUBLIC_PLAN_PRICE_* to override. */
export const PLAN_DISPLAY_PRICES: Record<
  PlanLine,
  Record<PlanTier, { monthly: string; annual: string }>
> = {
  student: {
    basic: { monthly: "$9", annual: "$90" },
    pro: { monthly: "$19", annual: "$190" },
    plus: { monthly: "$29", annual: "$290" },
  },
  tutor: {
    basic: { monthly: "$29", annual: "$290" },
    pro: { monthly: "$49", annual: "$490" },
    plus: { monthly: "$79", annual: "$790" },
  },
  business: {
    basic: { monthly: "$79", annual: "$790" },
    pro: { monthly: "$149", annual: "$1,490" },
    plus: { monthly: "$249", annual: "$2,490" },
  },
};

/** Full feature list per plan (what's included). */
export const PLAN_FEATURES: Record<
  PlanLine,
  Record<PlanTier, string[]>
> = {
  student: {
    basic: [
      "AI study assistant (limited requests)",
      "Save outputs & notes",
      "Practice tests",
      "Join classrooms with code",
      "Basic support",
    ],
    pro: [
      "Everything in Basic",
      "Higher AI usage limits",
      "Unlimited practice tests",
      "Priority AI responses",
      "Email support",
    ],
    plus: [
      "Everything in Pro",
      "Maximum AI usage",
      "Export & download materials",
      "Priority support",
      "Early access to new features",
    ],
  },
  tutor: {
    basic: [
      "1 tutor, up to 15 students",
      "Create classrooms & assignments",
      "AI content generator (basic)",
      "Quizzes & grading",
      "Student records",
    ],
    pro: [
      "Everything in Basic",
      "Up to 50 students",
      "Full AI tools (worksheets, rubrics)",
      "AI checker & lesson planner",
      "Email support",
    ],
    plus: [
      "Everything in Pro",
      "Up to 100 students",
      "Priority AI & support",
      "Export & reporting",
      "Dedicated success manager",
    ],
  },
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
 * Paddle price IDs – must reference each env var statically so Next.js inlines them.
 * (Dynamic process.env[key] is not inlined by the bundler.)
 */
const PADDLE_PRICE_IDS_FROM_ENV: Record<string, string | undefined> = {
  BUSINESS_BASIC_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_BASIC_MONTHLY,
  BUSINESS_BASIC_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_BASIC_ANNUAL,
  BUSINESS_PRO_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PRO_MONTHLY,
  BUSINESS_PRO_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PRO_ANNUAL,
  BUSINESS_PLUS_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PLUS_MONTHLY,
  BUSINESS_PLUS_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_PLUS_ANNUAL,
  TUTOR_BASIC_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_TUTOR_BASIC_MONTHLY,
  TUTOR_BASIC_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_TUTOR_BASIC_ANNUAL,
  TUTOR_PRO_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_TUTOR_PRO_MONTHLY,
  TUTOR_PRO_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_TUTOR_PRO_ANNUAL,
  TUTOR_PLUS_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_TUTOR_PLUS_MONTHLY,
  TUTOR_PLUS_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_TUTOR_PLUS_ANNUAL,
  STUDENT_BASIC_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_STUDENT_BASIC_MONTHLY,
  STUDENT_BASIC_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_STUDENT_BASIC_ANNUAL,
  STUDENT_PRO_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_STUDENT_PRO_MONTHLY,
  STUDENT_PRO_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_STUDENT_PRO_ANNUAL,
  STUDENT_PLUS_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_STUDENT_PLUS_MONTHLY,
  STUDENT_PLUS_ANNUAL: process.env.NEXT_PUBLIC_PADDLE_PRICE_STUDENT_PLUS_ANNUAL,
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
