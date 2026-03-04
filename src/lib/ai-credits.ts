/**
 * AI credits config – server-only.
 * Plan credits and feature weights from env; price_id → plan mapping for webhook.
 */

import type { PlanLine, PlanTier } from "./billing";
import type { AITaskType } from "@/types/ai";

// Credits per plan (monthly pool) – same key pattern as billing.ts
const CREDITS_PER_PLAN: Record<string, number> = {
  STUDENT_BASIC: parseInt(process.env.AI_CREDITS_STUDENT_BASIC ?? "50", 10),
  STUDENT_PRO: parseInt(process.env.AI_CREDITS_STUDENT_PRO ?? "200", 10),
  STUDENT_PLUS: parseInt(process.env.AI_CREDITS_STUDENT_PLUS ?? "500", 10),
  TUTOR_BASIC: parseInt(process.env.AI_CREDITS_TUTOR_BASIC ?? "100", 10),
  TUTOR_PRO: parseInt(process.env.AI_CREDITS_TUTOR_PRO ?? "400", 10),
  TUTOR_PLUS: parseInt(process.env.AI_CREDITS_TUTOR_PLUS ?? "1000", 10),
  BUSINESS_BASIC: parseInt(process.env.AI_CREDITS_BUSINESS_BASIC ?? "300", 10),
  BUSINESS_PRO: parseInt(process.env.AI_CREDITS_BUSINESS_PRO ?? "1200", 10),
  BUSINESS_PLUS: parseInt(process.env.AI_CREDITS_BUSINESS_PLUS ?? "3000", 10),
};

const AI_CREDITS_DEFAULT = parseInt(process.env.AI_CREDITS_DEFAULT ?? "0", 10);

// Feature weight (credits per use) – map AITaskType to env key suffix
const WEIGHT_ENV_KEYS: Record<AITaskType, string> = {
  content_generation: "AI_CREDIT_WEIGHT_CONTENT_GENERATION",
  checker: "AI_CREDIT_WEIGHT_CHECKER",
  lesson_planning: "AI_CREDIT_WEIGHT_LESSON_PLANNING",
  study_materials: "AI_CREDIT_WEIGHT_STUDY_MATERIALS",
  rubric_generation: "AI_CREDIT_WEIGHT_RUBRIC_GENERATION",
  paper_generation: "AI_CREDIT_WEIGHT_PAPER_GENERATION",
  worksheet_generation: "AI_CREDIT_WEIGHT_WORKSHEET_GENERATION",
  quiz_questions: "AI_CREDIT_WEIGHT_QUIZ_QUESTIONS",
  differentiation: "AI_CREDIT_WEIGHT_DIFFERENTIATION",
  concept_explanation: "AI_CREDIT_WEIGHT_CONCEPT_EXPLANATION",
  practice_questions: "AI_CREDIT_WEIGHT_PRACTICE_QUESTIONS",
  flashcards: "AI_CREDIT_WEIGHT_FLASHCARDS",
  study_plan: "AI_CREDIT_WEIGHT_STUDY_PLAN",
};

const DEFAULT_WEIGHT = 1;

/** Credits allocated per plan (monthly). Used by Paddle webhook and pool setup. */
export function getCreditsForPlan(planLine: PlanLine, tier: PlanTier): number {
  const key = `${planLine.toUpperCase()}_${tier.toUpperCase()}` as keyof typeof CREDITS_PER_PLAN;
  const val = CREDITS_PER_PLAN[key];
  return typeof val === "number" && !Number.isNaN(val) ? val : AI_CREDITS_DEFAULT;
}

/** Credit cost for one use of a feature. Default 1 if env not set. */
export function getCreditWeight(taskType: AITaskType): number {
  const envKey = WEIGHT_ENV_KEYS[taskType];
  const raw = process.env[envKey];
  const n = parseInt(raw ?? "", 10);
  return typeof n === "number" && !Number.isNaN(n) && n >= 0 ? n : DEFAULT_WEIGHT;
}

/** For env-based lookup by key (e.g. "CHECKER" -> weight). */
export function getCreditWeightByFeatureName(featureKey: string): number {
  const envKey = `AI_CREDIT_WEIGHT_${featureKey.toUpperCase().replace(/-/g, "_")}`;
  const raw = process.env[envKey];
  const n = parseInt(raw ?? "", 10);
  return typeof n === "number" && !Number.isNaN(n) && n >= 0 ? n : DEFAULT_WEIGHT;
}

// Build reverse map: price_id -> { planLine, tier }
// Same env vars as billing.ts (PADDLE_PRICE_*)
const PADDLE_PRICE_IDS: Record<string, string | undefined> = {
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

let priceIdToPlan: Map<string, { planLine: PlanLine; tier: PlanTier }> | null = null;

function buildPriceIdToPlan(): Map<string, { planLine: PlanLine; tier: PlanTier }> {
  const map = new Map<string, { planLine: PlanLine; tier: PlanTier }>();
  // Key format: STUDENT_BASIC_MONTHLY -> planLine=student, tier=basic (ignore monthly/annual)
  const lineTierFromKey = (key: string): { planLine: PlanLine; tier: PlanTier } | null => {
    const parts = key.split("_");
    if (parts.length < 3) return null;
    const cycle = parts[parts.length - 1].toLowerCase(); // monthly | annual
    const tierPart = parts[parts.length - 2].toLowerCase();
    const linePart = parts.slice(0, -2).join("_").toLowerCase();
    if ((cycle !== "monthly" && cycle !== "annual") || !["basic", "pro", "plus"].includes(tierPart))
      return null;
    if (!["student", "tutor", "business"].includes(linePart)) return null;
    return { planLine: linePart as PlanLine, tier: tierPart as PlanTier };
  };
  for (const [key, priceId] of Object.entries(PADDLE_PRICE_IDS)) {
    const trimmed = priceId?.trim();
    if (!trimmed) continue;
    const parsed = lineTierFromKey(key);
    if (parsed) map.set(trimmed, parsed);
  }
  return map;
}

/** Resolve price_id from Paddle to plan_line and tier. Used by webhook to set credit pool. */
export function getPlanFromPriceId(priceId: string): { planLine: PlanLine; tier: PlanTier } | null {
  if (!priceIdToPlan) priceIdToPlan = buildPriceIdToPlan();
  return priceIdToPlan.get(priceId.trim()) ?? null;
}

/** Default credits when user/workspace has no subscription (e.g. free tier). */
export function getDefaultCredits(): number {
  return AI_CREDITS_DEFAULT;
}
