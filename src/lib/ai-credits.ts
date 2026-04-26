/**
 * AI credits config – server-only.
 * Plan credits and feature weights from env; price_id → plan mapping for webhook.
 */

import type { PlanLine, PlanTier } from "./billing";
import type { AITaskType } from "@/types/ai";
import { getTierAndCycleFromPriceId } from "./billing";

// Credits per plan (monthly pool) – business (owner) plans only
const CREDITS_PER_PLAN: Record<string, number> = {
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
  contract_generation: "AI_CREDIT_WEIGHT_CONTRACT_GENERATION",
  contract_revision: "AI_CREDIT_WEIGHT_CONTRACT_REVISION",
  teacher_test_generation: "AI_CREDIT_WEIGHT_TEACHER_TEST_GENERATION",
  teacher_evaluation: "AI_CREDIT_WEIGHT_TEACHER_EVALUATION",
  tutor_matching: "AI_CREDIT_WEIGHT_TUTOR_MATCHING",
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


/** Default credits when user/workspace has no subscription (e.g. free tier). */
export function getDefaultCredits(): number {
  return AI_CREDITS_DEFAULT;
}

/** Map price_id to plan (planLine + tier). Used by Paddle webhook and credit pool setup. */
export function getPlanFromPriceId(priceId: string): { planLine: PlanLine; tier: PlanTier } | null {
  // All business plans are "business" planLine; find the tier from price_id
  const planLine: PlanLine = "business";
  const tierAndCycle = getTierAndCycleFromPriceId(planLine, priceId);
  if (tierAndCycle) {
    return { planLine, tier: tierAndCycle.tier };
  }
  return null;
}
