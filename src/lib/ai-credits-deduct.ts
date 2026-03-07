/**
 * Server-only: check and deduct credits before an AI request.
 * Use in API routes; returns error payload for 402 or null on success.
 */

import type { AITaskType } from "@/types/ai";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getCreditWeight, getPlanFromPriceId, getCreditsForPlan, getDefaultCredits } from "./ai-credits";

export type DeductCreditsResult =
  | { status: 402; body: { error: string } }
  | null;

/** Fallback credits when subscription is active but price_id is not in env mapping. */
const FALLBACK_SUBSCRIPTION_CREDITS = 100;

/**
 * If the user is a workspace owner with an active/trialing subscription, ensure the
 * workspace has a credit pool for the current period (from plan/env). Credits are
 * workspace-only: owner, tutors, and students all use from this single pool; we do
 * not create a separate user-level subscription allocation for the owner.
 * Call before deductCreditsForRequest so owners can use from the pool.
 */
export async function ensureOwnerWorkspaceCreditPool(userId: string): Promise<void> {
  if (!supabaseAdmin) return;

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  const workspaceId = workspace?.id;
  if (!workspaceId) return;

  const { data: sub } = await supabaseAdmin
    .from("workspace_subscriptions")
    .select("status, price_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const status = ((sub?.status as string) ?? "").toLowerCase();
  if (status !== "active" && status !== "trialing") return;

  const priceId = (sub?.price_id as string | null)?.trim();
  let credits = 0;
  if (priceId) {
    const plan = getPlanFromPriceId(priceId);
    if (plan) {
      credits = getCreditsForPlan(plan.planLine, plan.tier);
    }
  }
  if (credits <= 0) {
    credits = getDefaultCredits() > 0 ? getDefaultCredits() : FALLBACK_SUBSCRIPTION_CREDITS;
  }

  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodStr = periodStart.toISOString().slice(0, 10);

  const { data: pool } = await supabaseAdmin
    .from("workspace_credit_pools")
    .select("credits_allocated")
    .eq("workspace_id", workspaceId)
    .eq("period", periodStr)
    .maybeSingle();

  if ((pool?.credits_allocated ?? 0) === 0) {
    await (supabaseAdmin.rpc as CallableFunction)("upsert_workspace_credit_pool", {
      _workspace_id: workspaceId,
      _period: periodStr,
      _credits_allocated: credits,
    });
  }
}

/**
 * Deduct credits for the given user and task type. Uses env-based weight.
 * Returns { status: 402, body } if insufficient credits; null on success.
 * Caller should return res.status(result.status).json(result.body) when result is non-null.
 */
export async function deductCreditsForRequest(
  userId: string,
  taskType: AITaskType
): Promise<DeductCreditsResult> {
  if (!supabaseAdmin) {
    return { status: 402, body: { error: "Server not configured" } };
  }
  const cost = getCreditWeight(taskType);
  if (cost <= 0) {
    return null;
  }
  const { data, error } = await (supabaseAdmin.rpc as CallableFunction)("check_and_deduct_credits", {
    _user_id: userId,
    _task_type: taskType,
    _credit_cost: cost,
  });
  if (error) {
    console.error("[deductCreditsForRequest] RPC error:", error);
    return { status: 402, body: { error: "Failed to check credits" } };
  }
  const ok = (data as { ok?: boolean })?.ok === true;
  if (!ok) {
    return {
      status: 402,
      body: { error: (data as { reason?: string })?.reason ?? "Insufficient credits" },
    };
  }
  return null;
}
